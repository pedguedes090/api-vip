# 🎥 Social Media Video Downloader API

A powerful and efficient API service for downloading videos from various social media platforms. This service supports multiple platforms and provides a clean, RESTful API interface.

## ✨ Features

- 📱 **Multi-Platform Support**
  - Facebook
  - Instagram
  - Threads
  - TikTok

- 🚀 **Key Features**
  - Video download in multiple qualities
  - Thumbnail extraction
  - Automatic file cleanup (5-minute retention)
  - RESTful API endpoints
  - URL validation
  - Cross-platform compatibility

## 🛠️ Installation

1. Clone the repository:
```bash
git clone [your-repository-url]
cd [repository-name]
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

The server will start on port 3000 by default. You can change this by setting the `PORT` environment variable.

## 📡 API Endpoints

### Get Media Information
```http
POST /api/media-info
Content-Type: application/json

{
    "url": "https://example.com/video-url"
}
```

### Download Media
```http
POST /api/download
Content-Type: application/json

{
    "url": "https://example.com/video-url"
}
```

### Check Supported Platforms
```http
GET /api/platforms
```

### Validate URL
```http
POST /api/validate-url
Content-Type: application/json

{
    "url": "https://example.com/video-url"
}
```

## 🔧 Configuration

The server can be configured using environment variables:

- `PORT`: Server port (default: 3000)

## 📁 Project Structure

```
├── server.js          # Main server file
├── module/           # Platform-specific modules
│   ├── facebook.js
│   ├── instagram.js
│   ├── threads.js
│   └── tiktok.js
├── public/           # Static files
└── downloads/        # Temporary download storage
```

## 🔄 File Management

- Downloaded files are automatically deleted after 5 minutes
- Files are stored in the `downloads` directory
- Thumbnails are generated and stored temporarily

## 🛡️ Error Handling

The API includes comprehensive error handling for:
- Invalid URLs
- Unsupported platforms
- Download failures
- File system errors

## 📝 Response Format

### Success Response
```json
{
    "downloadResults": [
        {
            "type": "video",
            "quality": "720p",
            "path": "/downloads/filename.mp4"
        }
    ],
    "thumbnail": "/downloads/thumbnail.jpg"
}
```

### Error Response
```json
{
    "error": "Error message"
}
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⭐ Support

If you find this project helpful, please give it a star! For issues and feature requests, please use the GitHub issue tracker.

---

Made with ❤️ by [Your Name] 