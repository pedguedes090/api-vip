const axios = require('axios');
const qs = require('qs');
const fs = require('fs-extra');
const path = require('path');

// Create downloads directory if it doesn't exist
const DOWNLOADS_DIR = path.join(__dirname, '..', 'downloads', 'instagram');
fs.ensureDirSync(DOWNLOADS_DIR);

// Instagram API functions
async function checkRedirect(url) {
    let split_url = url.split("/");
    if (split_url.includes("share")) {
        let res = await axios.get(url);
        return res.request.path;
    }
    return url;
}

function getShortcode(url) {
    try {
        let split_url = url.split("/");
        let post_tags = ["p", "reel", "tv", "reels"];
        let index_shortcode = split_url.findIndex(item => post_tags.includes(item)) + 1;
        let shortcode = split_url[index_shortcode];
        return shortcode;
    } catch (err) {
        throw new Error(`Failed to obtain shortcode: ${err.message}`);
    }
}

async function getCSRFToken() {
    try {
        let config = {
            method: 'GET',
            url: 'https://www.instagram.com/graphql/query/?doc_id=7950326061742207&variables=%7B%22id%22%3A%2259237287799%22%2C%22include_clips_attribution_info%22%3Afalse%2C%22first%22%3A12%7D',
        };

        const response = await axios.request(config);
        if (!response.headers['set-cookie']) {
            throw new Error('No CSRF token found');
        }

        const csrfCookie = response.headers['set-cookie'][0];
        const csrfToken = csrfCookie.split(";")[0].replace("csrftoken=", '');
        return csrfToken;
    } catch (err) {
        throw new Error(`Failed to obtain CSRF: ${err.message}`);
    }
}

async function instagramRequest(shortcode, retries = 5, delay = 1000) {
    try {
        const BASE_URL = "https://www.instagram.com/graphql/query";
        const INSTAGRAM_DOCUMENT_ID = "9510064595728286";
        let dataBody = qs.stringify({
            'variables': JSON.stringify({
                'shortcode': shortcode,
                'fetch_tagged_user_count': null,
                'hoisted_comment_id': null,
                'hoisted_reply_id': null
            }),
            'doc_id': INSTAGRAM_DOCUMENT_ID
        });

        const token = await getCSRFToken();

        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: BASE_URL,
            headers: {
                'X-CSRFToken': token,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            data: dataBody
        };

        const { data } = await axios.request(config);
        if (!data.data?.xdt_shortcode_media) {
            throw new Error("Only posts/reels supported, check if your link is valid.");
        }
        return data.data.xdt_shortcode_media;
    } catch (err) {
        const errorCodes = [429, 403];

        if (err.response && errorCodes.includes(err.response.status) && retries > 0) {
            const retryAfter = err.response.headers['retry-after'];
            const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay;
            await new Promise(res => setTimeout(res, waitTime));
            return instagramRequest(shortcode, retries - 1, delay * 2);
        }

        throw new Error(`Failed instagram request: ${err.message}`);
    }
}

function formatPostInfo(requestData) {
    try {
        let mediaCapt = requestData.edge_media_to_caption.edges;
        const capt = (mediaCapt.length === 0) ? "" : mediaCapt[0].node.text;
        return {
            owner_username: requestData.owner.username,
            owner_fullname: requestData.owner.full_name,
            is_verified: requestData.owner.is_verified,
            is_private: requestData.owner.is_private,
            likes: requestData.edge_media_preview_like.count,
            is_ad: requestData.is_ad,
            caption: capt
        };
    } catch (err) {
        throw new Error(`Failed to format post info: ${err.message}`);
    }
}

function formatMediaDetails(mediaData) {
    try {
        if (mediaData.is_video) {
            return {
                type: "video",
                dimensions: mediaData.dimensions,
                video_view_count: mediaData.video_view_count,
                url: mediaData.video_url,
                thumbnail: mediaData.display_url
            };
        } else {
            return {
                type: "image",
                dimensions: mediaData.dimensions,
                url: mediaData.display_url
            };
        }
    } catch (err) {
        throw new Error(`Failed to format media details: ${err.message}`);
    }
}

function isSidecar(requestData) {
    try {
        return requestData["__typename"] == "XDTGraphSidecar";
    } catch (err) {
        throw new Error(`Failed sidecar verification: ${err.message}`);
    }
}

function createOutputData(requestData) {
    try {
        let url_list = [], media_details = [];
        const IS_SIDECAR = isSidecar(requestData);
        
        if (IS_SIDECAR) {
            requestData.edge_sidecar_to_children.edges.forEach((media) => {
                media_details.push(formatMediaDetails(media.node));
                if (media.node.is_video) {
                    url_list.push(media.node.video_url);
                } else {
                    url_list.push(media.node.display_url);
                }
            });
        } else {
            media_details.push(formatMediaDetails(requestData));
            if (requestData.is_video) {
                url_list.push(requestData.video_url);
            } else {
                url_list.push(requestData.display_url);
            }
        }

        return {
            results_number: url_list.length,
            url_list,
            post_info: formatPostInfo(requestData),
            media_details
        };
    } catch (err) {
        throw new Error(`Failed to create output data: ${err.message}`);
    }
}

async function instagramGetUrl(url_media, config = { retries: 5, delay: 1000 }) {
    try {
        url_media = await checkRedirect(url_media);
        const SHORTCODE = getShortcode(url_media);
        const INSTAGRAM_REQUEST = await instagramRequest(SHORTCODE, config.retries, config.delay);
        return createOutputData(INSTAGRAM_REQUEST);
    } catch (err) {
        throw err;
    }
}

// Get video/image information
async function getMediaInfo(url) {
    try {
        const response = await instagramGetUrl(url);
        const thumbnails = response.media_details.map(media => 
            media.thumbnail || media.url
        );

        return {
            title: response.post_info.caption || 'Instagram Media',
            thumbnails: thumbnails,
            mediaType: response.media_details[0].type,
            mediaDetails: response.media_details,
            postInfo: response.post_info
        };
    } catch (error) {
        throw new Error('Failed to get Instagram media information: ' + error.message);
    }
}

module.exports = {
    displayName: 'Instagram',

    // Validate if the URL is from Instagram
    validateUrl: (url) => {
        return url.includes('instagram.com/');
    },

    // Get video/image information
    getMediaInfo,

    // Download media
    downloadVideo: async (url) => {
        try {
            const instagramData = await instagramGetUrl(url);
            const mediaInfo = await getMediaInfo(url);
            const downloadResults = [];

            for (let i = 0; i < instagramData.media_details.length; i++) {
                const media = instagramData.media_details[i];
                const fileName = `${mediaInfo.postInfo.owner_username}_${Date.now()}_${i + 1}.${media.type === 'video' ? 'mp4' : 'jpg'}`;
                const filePath = path.join(DOWNLOADS_DIR, fileName);

                // Download the file
                const downloadResponse = await axios({
                    method: 'GET',
                    url: media.url,
                    responseType: 'stream'
                });

                const writer = fs.createWriteStream(filePath);
                downloadResponse.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });

                downloadResults.push({
                    type: media.type,
                    path: filePath,
                    url: media.url,
                    dimensions: media.dimensions
                });
            }

            // Use the first downloaded file as thumbnail
            const thumbnailPath = downloadResults[0].path;

            return {
                title: mediaInfo.title,
                thumbnail: thumbnailPath, // Use local file path instead of URL
                mediaType: mediaInfo.mediaType,
                downloadResults,
                postInfo: mediaInfo.postInfo
            };
        } catch (error) {
            throw new Error('Failed to download Instagram media: ' + error.message);
        }
    }
}; 