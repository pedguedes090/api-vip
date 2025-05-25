const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const facebook = require('./module/facebook');
const instagram = require('./module/instagram');
const threads = require('./module/threads');
const tiktok = require('./module/tiktok');

const app = express();
const port = process.env.PORT || 3000;

// Track downloaded files and their timestamps
const downloadedFiles = new Map();

// Function to schedule file deletion
function scheduleFileDeletion(filePath) {
    const absolutePath = path.join(__dirname, filePath);
    downloadedFiles.set(absolutePath, Date.now());
    
    setTimeout(() => {
        if (downloadedFiles.has(absolutePath)) {
            fs.remove(absolutePath).catch(err => {
                console.error(`Error deleting file ${absolutePath}:`, err);
            });
            downloadedFiles.delete(absolutePath);
        }
    }, 5 * 60 * 1000); // 5 minutes in milliseconds
}

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/downloads', express.static('downloads'));

// Helper function to convert absolute path to relative URL
function getRelativeUrl(absolutePath) {
    if (!absolutePath) return '';
    if (/^https?:\/\//.test(absolutePath)) return '';
    const relativePath = absolutePath.replace(/\\/g, '/');
    if (relativePath.startsWith('/downloads')) {
        return relativePath;
    }
    return '/downloads/' + relativePath.split('downloads/').pop();
}

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint to get media info
app.post('/api/media-info', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        let module;
        if (facebook.validateUrl(url)) {
            module = facebook;
        } else if (instagram.validateUrl(url)) {
            module = instagram;
        } else if (threads.validateUrl(url)) {
            module = threads;
        } else if (tiktok.validateUrl(url)) {
            module = tiktok;
        } else {
            return res.status(400).json({ error: 'Unsupported URL' });
        }

        const info = await module.getMediaInfo(url);
        
        // Convert thumbnail paths to relative URLs if exists
        if (info.thumbnails) {
            // Handle multiple thumbnails
            info.thumbnails = info.thumbnails.map(thumb => getRelativeUrl(thumb));
        } else if (info.thumbnail) {
            // Handle single thumbnail
            info.thumbnail = getRelativeUrl(info.thumbnail);
        }
        
        res.json(info);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to download media
app.post('/api/download', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        let module;
        if (facebook.validateUrl(url)) {
            module = facebook;
        } else if (instagram.validateUrl(url)) {
            module = instagram;
        } else if (threads.validateUrl(url)) {
            module = threads;
        } else if (tiktok.validateUrl(url)) {
            module = tiktok;
        } else {
            return res.status(400).json({ error: 'Unsupported URL' });
        }

        const result = await module.downloadVideo(url);
        
        // Schedule deletion for downloaded files
        if (result.downloadResults) {
            result.downloadResults.forEach(item => {
                if (item.path) {
                    scheduleFileDeletion(item.path);
                }
            });
        }
        if (result.thumbnail) {
            scheduleFileDeletion(result.thumbnail);
        }
        
        // Convert absolute paths to relative URLs
        if (result.downloadResults) {
            result.downloadResults = result.downloadResults.map(item => ({
                type: item.type,
                quality: item.quality,
                path: getRelativeUrl(item.path)
            }));
        }
        if (result.thumbnail) {
            result.thumbnail = getRelativeUrl(result.thumbnail);
        }
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET endpoint to download media
app.get('/api/download', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        let module;
        if (facebook.validateUrl(url)) {
            module = facebook;
        } else if (instagram.validateUrl(url)) {
            module = instagram;
        } else if (threads.validateUrl(url)) {
            module = threads;
        } else if (tiktok.validateUrl(url)) {
            module = tiktok;
        } else {
            return res.status(400).json({ error: 'Unsupported URL' });
        }

        const result = await module.downloadVideo(url);
        
        // Schedule deletion for downloaded files
        if (result.downloadResults) {
            result.downloadResults.forEach(item => {
                if (item.path) {
                    scheduleFileDeletion(item.path);
                }
            });
        }
        if (result.thumbnail) {
            scheduleFileDeletion(result.thumbnail);
        }
        
        // Convert absolute paths to relative URLs
        if (result.downloadResults) {
            result.downloadResults = result.downloadResults.map(item => ({
                type: item.type,
                quality: item.quality,
                path: getRelativeUrl(item.path)
            }));
        }
        if (result.thumbnail) {
            result.thumbnail = getRelativeUrl(result.thumbnail);
        }
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to get supported platforms
app.get('/api/platforms', (req, res) => {
    const platforms = [
        {
            name: facebook.displayName,
            validateUrl: facebook.validateUrl.toString()
        },
        {
            name: instagram.displayName,
            validateUrl: instagram.validateUrl.toString()
        },
        {
            name: threads.displayName,
            validateUrl: threads.validateUrl.toString()
        },
        {
            name: tiktok.displayName,
            validateUrl: tiktok.validateUrl.toString()
        }
    ];
    res.json(platforms);
});

// API endpoint to check if URL is supported
app.post('/api/validate-url', (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    const supported = {
        facebook: facebook.validateUrl(url),
        instagram: instagram.validateUrl(url),
        threads: threads.validateUrl(url),
        tiktok: tiktok.validateUrl(url)
    };

    const platform = Object.entries(supported).find(([_, valid]) => valid)?.[0];
    
    res.json({
        supported: !!platform,
        platform: platform || null
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}); 