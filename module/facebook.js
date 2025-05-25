const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

// Create downloads directory if it doesn't exist
const DOWNLOADS_DIR = path.join(__dirname, '..', 'downloads', 'facebook');
fs.ensureDirSync(DOWNLOADS_DIR);

// Default headers for Facebook requests
const DEFAULT_HEADERS = {
    "sec-fetch-user": "?1",
    "sec-ch-ua-mobile": "?0",
    "sec-fetch-site": "none",
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "cache-control": "max-age=0",
    "authority": "www.facebook.com",
    "upgrade-insecure-requests": "1",
    "accept-language": "en-GB,en;q=0.9,tr-TR;q=0.8,tr;q=0.7,en-US;q=0.6",
    "sec-ch-ua": '"Google Chrome";v="89", "Chromium";v="89", ";Not A Brand";v="99"',
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Safari/537.36",
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
    "cookie": "sb=Rn8BYQvCEb2fpMQZjsd6L382; datr=Rn8BYbyhXgw9RlOvmsosmVNT; c_user=100003164630629; _fbp=fb.1.1629876126997.444699739; wd=1920x939; spin=r.1004812505_b.trunk_t.1638730393_s.1_v.2_; xs=28%3A8ROnP0aeVF8XcQ%3A2%3A1627488145%3A-1%3A4916%3A%3AAcWIuSjPy2mlTPuZAeA2wWzHzEDuumXI89jH8a_QIV8; fr=0jQw7hcrFdas2ZeyT.AWVpRNl_4noCEs_hb8kaZahs-jA.BhrQqa.3E.AAA.0.0.BhrQqa.AWUu879ZtCw"
};

// Helper function to parse string
function parseString(string) {
    return JSON.parse(`{"text": "${string}"}`).text;
}

// Get video information from Facebook
async function getFbVideoInfo(videoUrl) {
    if (!videoUrl || !videoUrl.trim()) {
        throw new Error("Please specify the Facebook URL");
    }
    if (["facebook.com", "fb.watch"].every((domain) => !videoUrl.includes(domain))) {
        throw new Error("Please enter a valid Facebook URL");
    }

    try {
        const { data } = await axios.get(videoUrl, { headers: DEFAULT_HEADERS });
        const processedData = data.replace(/&quot;/g, '"').replace(/&amp;/g, "&");

        const hdMatch = processedData.match(/"browser_native_hd_url":"(.*?)"/) || 
                       processedData.match(/"playable_url_quality_hd":"(.*?)"/) || 
                       processedData.match(/hd_src\s*:\s*"([^"]*)"/);

        const titleMatch = processedData.match(/<meta\sname="description"\scontent="(.*?)"/);
        const thumbMatch = processedData.match(/"preferred_thumbnail":\{"image":\{"uri":"(.*?)"/);
        const duration = processedData.match(/"playable_duration_in_ms":[0-9]+/gm);

        if (hdMatch && hdMatch[1]) {
            return {
                url: videoUrl,
                duration_ms: Number(duration && duration[0] ? duration[0].split(":")[1] : 0),
                hd: parseString(hdMatch[1]),
                title: titleMatch && titleMatch[1] ? parseString(titleMatch[1]) : processedData.match(/<title>(.*?)<\/title>/)?.[1] ?? "",
                thumbnail: thumbMatch && thumbMatch[1] ? parseString(thumbMatch[1]) : ""
            };
        } else {
            throw new Error("Unable to fetch HD video information at this time. Please try again");
        }
    } catch (error) {
        throw new Error(`Unable to fetch video information: ${error.message}`);
    }
}

module.exports = {
    displayName: 'Facebook',

    // Validate if the URL is from Facebook
    validateUrl: (url) => {
        return url.includes('facebook.com/') || url.includes('fb.watch/');
    },

    // Get video information
    getMediaInfo: async (url) => {
        try {
            const info = await getFbVideoInfo(url);
            return {
                title: info.title,
                thumbnail: info.thumbnail,
                mediaType: 'video',
                duration: info.duration_ms,
                qualities: {
                    hd: info.hd
                }
            };
        } catch (error) {
            throw new Error('Failed to get Facebook video information: ' + error.message);
        }
    },

    // Download video
    downloadVideo: async (url) => {
        try {
            const info = await getFbVideoInfo(url);
            const downloadResults = [];

            if (info.hd) {
                const hdFileName = `facebook_hd_${Date.now()}.mp4`;
                const hdFilePath = path.join(DOWNLOADS_DIR, hdFileName);

                const hdResponse = await axios({
                    method: 'GET',
                    url: info.hd,
                    responseType: 'stream'
                });

                const hdWriter = fs.createWriteStream(hdFilePath);
                hdResponse.data.pipe(hdWriter);

                await new Promise((resolve, reject) => {
                    hdWriter.on('finish', resolve);
                    hdWriter.on('error', reject);
                });

                downloadResults.push({
                    type: 'video',
                    quality: 'HD',
                    path: hdFilePath
                });
            }

            return {
                title: info.title,
                thumbnail: info.thumbnail,
                mediaType: 'video',
                duration: info.duration_ms,
                downloadResults
            };
        } catch (error) {
            throw new Error('Failed to download Facebook video: ' + error.message);
        }
    }
}; 