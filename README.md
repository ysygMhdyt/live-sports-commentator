# Live Sports Commentator Chrome Extension

A Chrome extension that provides real-time audio transcription for sports videos, delivering multi-language and stylized sports commentary.

## Highlight

The LemonFox API is currently not working. We've contacted LemonFox and are waiting for them to fix the issue.

## Features

- Real-time audio capture from video elements
- Automatic speech-to-text transcription
- Smart text merging for continuous speech
- Silence detection and processing
- User-friendly popup interface
- Maintains history of recent transcriptions
- Customize language and commentator style

## Installation

1. Clone this repository
2. Apply Lemonfox API key and Deepseek API key
3. **Replace your API keys**
4. Run:
``` 
npm install 
npm run build 
```
5. Open Chrome and navigate to `chrome://extensions/`
6. Enable "Developer mode" in the top right
7. Click "Load unpacked" and select the extension directory

## Usage

1. Navigate to any webpage with a video
2. Click the extension icon to open the popup
3. Click "Start Recording" to begin transcription
4. The extension will automatically transcribe any audio from the video
5. Click "Stop Recording" to end the session

## Technical Details

### Components

- **Popup Interface**: User interface for controlling the transcription
- **Content Script**: Handles audio capture and processing
- **Background Script**: Manages communication with LemonFox API
- **Transcription Manager**: Handles text processing and storage

### Architecture

The extension uses a modular architecture with several key components:

- Audio processing using Web Audio API
- WAV format conversion for API compatibility
- Message passing between components using Chrome Extension API
- Real-time transcription updates
