# Live Sports Commentator Chrome Extension

A Chrome extension that provides real-time audio transcription for sports videos, converting speech to text using the LemonFox AI API.

## TODO

- fix restart

## Features

- Real-time audio capture from video elements
- Automatic speech-to-text transcription
- Smart text merging for continuous speech
- Silence detection and processing
- User-friendly popup interface
- Maintains history of recent transcriptions

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

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
