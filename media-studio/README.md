# Media Studio — Side Quest

A sleek, dark-themed web app for high‑quality camera, photo, and audio recording right in your browser. No backends, no uploads—everything stays local with persistent storage.

## Features

### Recording & Capture
- Auto-start camera preview with real-time visual controls
- Take photos with best supported method (ImageCapture when available)
- Record video with optional microphone audio
- Record audio (voice notes) from microphone only
- Configurable countdown timer (3s/5s/10s) for photo capture and starting recordings
- Contextual Start/Stop buttons during recording for a clearer UX
- Download any captured media to your device

### Device & Quality Control
- **Device Selection**: Choose specific cameras and microphones
- **Resolution Control**: 480p, 720p, 1080p, 4K options
- **Frame Rate**: 24fps, 30fps, 60fps selection
- **Aspect Ratio**: Native, 16:9, 9:16, 4:3, 3:2, 3:4, 2:3, 1:1
- **Preview Scaling**: Preview auto-scales with a max height of 512px while preserving aspect

### Visual Feedback
- **Audio Metering**: Real-time visual level meters during recording
- **Recording Timer**: Shows duration with emoji indicators (🔴 video, 🎙️ audio)
- **Countdown Overlay**: Optional countdown badge before capture/record
- **Storage Stats**: Gallery shows item count, total size, and breakdown

### Persistent Storage
- **IndexedDB Integration**: Gallery items persist between sessions
- **Individual Delete**: Remove specific items with confirmation
- **Bulk Clear**: Clear entire gallery with confirmation
- **Metadata Display**: File size and timestamp for each item

### Modern UI
- Dark glass theme with blur effects and gradients
- Magenta/violet accent colors with subtle glows
- Emoji-enhanced buttons and contextual Start/Stop controls
- Responsive layout for mobile and desktop
- Tailwind CSS powered styling

## Tech Stack
- **Media APIs**: getUserMedia, ImageCapture, MediaRecorder, Web Audio API, Canvas captureStream (for aspect processing)
- **Storage**: IndexedDB for persistent gallery
- **Styling**: Tailwind CSS via CDN
- **Audio**: AudioContext for real-time level metering
- **Modular JS**: Split into focused utilities (camera, devices, metering, storage, video-processor, etc.)

## Usage
- Open `index.html` directly in a modern browser, or use the root dev server:
  - From repo root: `npm run serve`
  - Visit http://localhost:3333/media-studio/

## Browser Notes
- Permissions: Browser will prompt for camera/microphone access
- Device Labels: Initial permission grant required to show device names
- MIME Support: App automatically selects supported MediaRecorder formats
- Secure Context: Some features require HTTPS or localhost for security

## File Structure
```
media-studio/
├── index.html          # Main app UI
├── js/
│   ├── ui.js           # Main controller & event handling
│   ├── camera.js       # Camera stream & photo capture
│   ├── recorder.js     # MediaRecorder wrapper utilities
│   ├── devices.js      # Device enumeration & selection
│   ├── metering.js     # Audio level visualization & timers
│   ├── storage.js      # IndexedDB persistence layer
│   ├── download.js     # File download utilities
│   ├── utils.js        # DOM helpers & gallery creation
│   └── video-processor.js # Canvas-based aspect-correct processing for video/photo
└── README.md
```
