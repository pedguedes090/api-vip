const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { JSDOM } = require('jsdom');

// Create downloads directory if it doesn't exist
const DOWNLOADS_DIR = path.join(__dirname, '..', 'downloads', 'threads');
fs.ensureDirSync(DOWNLOADS_DIR);

// Default headers for Threads requests
const DEFAULT_HEADERS = {
    'authority': 'www.threads.net',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'accept-language': 'en-US,en;q=0.9',
    'cache-control': 'no-cache',
    'pragma': 'no-cache',
    'sec-ch-ua': '"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
};

// Helper function to parse script content
async function parseScriptContent(html) {
    const dom = new JSDOM(html);
    const scripts = Array.from(dom.window.document.querySelectorAll("script"));

    for (let i = 0; i < scripts.length; i++) {
        const script = scripts[i];
        if (script.textContent.includes("username") && script.textContent.includes("original_width")) {
            return JSON.parse(script.textContent)["require"][0][3][0]["__bbox"]["require"][0][3][1]["__bbox"]["result"];
        }
    }
    throw new Error("Không thể tìm thấy dữ liệu video/ảnh");
}

// Get media information from Threads
async function getThreadsMediaInfo(url) {
    if (!url || !url.trim()) {
        throw new Error("Vui lòng nhập URL Threads");
    }
    if (!url.includes('threads.net') && !url.includes('threads.com')) {
        throw new Error("URL không hợp lệ");
    }

    try {
        const response = await axios.get(url, { headers: DEFAULT_HEADERS });
        if (response.status !== 200) {
            throw new Error(`Lỗi: ${response.status} ${response.statusText}`);
        }

        const result = await parseScriptContent(response.data);
        const post = result.data.data.edges[0].node.thread_items[0].post;

        // Determine media type and get URLs
        let mediaType = 'unknown';
        let mediaUrls = [];
        let thumbnail = '';

        if (post.carousel_media) {
            mediaType = 'carousel';
            mediaUrls = post.carousel_media.map(item => {
                if (item.video_versions && item.video_versions.length > 0) {
                    return item.video_versions[0].url;
                } else if (item.image_versions2 && item.image_versions2.candidates.length > 0) {
                    return item.image_versions2.candidates[0].url;
                }
                return null;
            }).filter(Boolean);
            thumbnail = post.carousel_media[0]?.image_versions2?.candidates[0]?.url || '';
        } else if (post.video_versions && post.video_versions.length > 0) {
            mediaType = 'video';
            mediaUrls = [post.video_versions[0].url];
            thumbnail = post.image_versions2?.candidates[0]?.url || '';
        } else if (post.image_versions2 && post.image_versions2.candidates.length > 0) {
            mediaType = 'image';
            mediaUrls = [post.image_versions2.candidates[0].url];
            thumbnail = mediaUrls[0];
        } else if (post.audio && post.audio.audio_src) {
            mediaType = 'audio';
            mediaUrls = [post.audio.audio_src];
            thumbnail = post.image_versions2?.candidates[0]?.url || '';
        }

        if (mediaUrls.length === 0) {
            throw new Error("Không tìm thấy URL media để tải xuống");
        }

        return {
            url: url,
            mediaType: mediaType,
            mediaUrls: mediaUrls,
            thumbnail: thumbnail,
            caption: post.caption?.text || '',
            author: {
                username: post.user?.username || '',
                fullName: post.user?.full_name || ''
            }
        };
    } catch (error) {
        throw new Error(`Lỗi khi lấy thông tin: ${error.message}`);
    }
}

module.exports = {
    displayName: 'Threads',

    // Validate if the URL is from Threads
    validateUrl: (url) => {
        return url.includes('threads.net/') || url.includes('threads.com/');
    },

    // Get media information
    getMediaInfo: async (url) => {
        try {
            const info = await getThreadsMediaInfo(url);
            return {
                title: info.caption,
                thumbnail: info.thumbnail,
                mediaType: info.mediaType,
                author: info.author
            };
        } catch (error) {
            throw new Error('Lỗi khi lấy thông tin: ' + error.message);
        }
    },

    // Download media
    downloadVideo: async (url) => {
        try {
            const info = await getThreadsMediaInfo(url);
            const downloadResults = [];

            for (let i = 0; i < info.mediaUrls.length; i++) {
                const mediaUrl = info.mediaUrls[i];
                if (!mediaUrl) continue;

                console.log(`Đang tải ${info.mediaType} ${i + 1}/${info.mediaUrls.length}:`, mediaUrl);

                const response = await axios({
                    method: 'GET',
                    url: mediaUrl,
                    responseType: 'arraybuffer'
                });

                const extension = info.mediaType === 'audio' ? 'mp3' : 
                                info.mediaType === 'video' ? 'mp4' : 'jpg';
                const fileName = `threads_${Date.now()}_${i + 1}.${extension}`;
                const filePath = path.join(DOWNLOADS_DIR, fileName);

                fs.writeFileSync(filePath, Buffer.from(response.data));
                console.log('Đã lưu vào', filePath);

                downloadResults.push({
                    type: info.mediaType,
                    quality: 'default',
                    path: filePath
                });
            }

            if (downloadResults.length === 0) {
                throw new Error("Không thể tải xuống media");
            }

            return {
                title: info.caption,
                thumbnail: info.thumbnail,
                mediaType: info.mediaType,
                author: info.author,
                downloadResults
            };
        } catch (error) {
            throw new Error('Lỗi khi tải xuống: ' + error.message);
        }
    }
}; 