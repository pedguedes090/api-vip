const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

// Create downloads directory if it doesn't exist
const DOWNLOADS_DIR = path.join(__dirname, '..', 'downloads', 'tiktok');
fs.ensureDirSync(DOWNLOADS_DIR);

// Helper function to get aweme ID from URL
async function getAwemeIdFromUrl(url) {
    // Nếu là link rút gọn, fetch để lấy link gốc
    if (url.includes('vt.tiktok.com')) {
        const response = await axios.head(url, { 
            maxRedirects: 0,
            validateStatus: status => status >= 200 && status < 400
        });
        const location = response.headers.location;
        console.log('Link gốc:', location);
        return extractIdFromUrl(location);
    } else {
        // Nếu là link gốc, lấy id luôn
        return extractIdFromUrl(url);
    }
}

// Helper function to extract ID from URL
function extractIdFromUrl(url) {
    // Tìm id trong link dạng .../video/ID... hoặc .../photo/ID...
    const match = url.match(/(?:video|photo)\/(\d+)/);
    return match ? match[1] : null;
}

// Get media information from TikTok
async function getTikTokMediaInfo(videoUrl) {
    if (!videoUrl || !videoUrl.trim()) {
        throw new Error("Please specify the TikTok URL");
    }

    try {
        const awemeId = await getAwemeIdFromUrl(videoUrl);
        if (!awemeId) {
            throw new Error("Không tìm thấy aweme_id trong link!");
        }

        const response = await axios.options('https://api16-normal-c-alisg.tiktokv.com/aweme/v1/aweme/detail/', {
            params: {
                'aweme_id': awemeId
            }
        });

        const videoData = response.data?.aweme_detail;
        if (!videoData) {
            throw new Error("Could not fetch video information");
        }

        // Check for images first
        const images = videoData.image_post_info?.images;
        if (Array.isArray(images) && images.length > 0) {
            const imageUrls = images.map(img => img.display_image?.url_list?.[0]).filter(Boolean);
            return {
                url: videoUrl,
                awemeId: awemeId,
                mediaType: 'image',
                mediaUrls: imageUrls,
                title: videoData.desc || `TikTok Image ${awemeId}`,
                thumbnail: imageUrls[0] || '',
                author: {
                    username: videoData.author?.unique_id || '',
                    nickname: videoData.author?.nickname || ''
                }
            };
        }

        // If no images, check for video
        const downloadUrl = videoData.video?.download_addr?.url_list?.[0] || 
                          videoData.video?.download_no_watermark_addr?.url_list?.[1];

        if (!downloadUrl) {
            throw new Error("Không tìm thấy link video không watermark!");
        }

        return {
            url: videoUrl,
            awemeId: awemeId,
            mediaType: 'video',
            mediaUrls: [downloadUrl],
            title: videoData.desc || `TikTok Video ${awemeId}`,
            thumbnail: videoData.video?.cover?.url_list?.[0] || '',
            author: {
                username: videoData.author?.unique_id || '',
                nickname: videoData.author?.nickname || ''
            }
        };
    } catch (error) {
        throw new Error(`Failed to get TikTok media information: ${error.message}`);
    }
}

module.exports = {
    displayName: 'TikTok',

    // Validate if the URL is from TikTok
    validateUrl: (url) => {
        return url.includes('tiktok.com/');
    },

    // Get media information
    getMediaInfo: async (url) => {
        try {
            const info = await getTikTokMediaInfo(url);
            const thumbnails = info.mediaType === 'image' ? 
                info.mediaUrls : 
                [info.thumbnail];

            return {
                title: info.title,
                thumbnails: thumbnails,
                mediaType: info.mediaType,
                author: info.author,
                qualities: {
                    default: info.mediaUrls[0]
                }
            };
        } catch (error) {
            throw new Error('Failed to get TikTok media information: ' + error.message);
        }
    },

    // Download media
    downloadVideo: async (url) => {
        try {
            const info = await getTikTokMediaInfo(url);
            const downloadResults = [];

            for (let i = 0; i < info.mediaUrls.length; i++) {
                const mediaUrl = info.mediaUrls[i];
                console.log(`Đang tải ${info.mediaType} ${i + 1}/${info.mediaUrls.length}:`, mediaUrl);

                const response = await axios({
                    method: 'GET',
                    url: mediaUrl,
                    responseType: 'arraybuffer'
                });

                const extension = info.mediaType === 'image' ? 'jpg' : 'mp4';
                const fileName = `tiktok_${info.awemeId}_${i + 1}.${extension}`;
                const filePath = path.join(DOWNLOADS_DIR, fileName);

                fs.writeFileSync(filePath, Buffer.from(response.data));
                console.log('Đã lưu vào', filePath);

                downloadResults.push({
                    type: info.mediaType,
                    quality: 'default',
                    path: filePath,
                    url: mediaUrl
                });
            }

            return {
                title: info.title,
                thumbnail: info.thumbnail,
                mediaType: info.mediaType,
                author: info.author,
                downloadResults
            };
        } catch (error) {
            throw new Error('Tải xuống thất bại: ' + error.message);
        }
    }
}; 
