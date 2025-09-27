# Side Quests
Mini projects that don't need their own repository.

## Projects

### [Token Tally](./token-tally/)
An accurate LLM token counter that runs entirely in your browser. This web application uses OpenAI's tiktoken library compiled to WebAssembly to provide precise token counting for various language models.

**Features:**
- 🎯 **Accurate token counting** using OpenAI's tiktoken implementation
- 🔒 **Privacy-focused** - all processing happens in your browser, no data sent to servers
- ⚡ **Real-time counting** with debounced updates as you type
- 🤖 **Multiple tokenizer support**:
  - GPT-4 / GPT-3.5 (cl100k_base)
  - GPT-4o / 4.1 (o200k_base) 
  - GPT-3 (p50k_base)
  - GPT-2 (r50k_base)
- 📊 **Comprehensive stats** - displays tokens, characters, and word counts
- 🎨 **Modern UI** with dark theme and responsive design
- 📋 **Copy functionality** to easily share token counts

**Tech Stack:**
- Vanilla HTML, CSS, and JavaScript
- OpenAI tiktoken library via WASM
- CDN-served dependencies (unpkg)

### [Media Studio](./media-studio/)
Record high quality videos, photos, and voice notes in your browser with a sleek dark glass UI.

**Features:**
- 📹 Camera preview with aspect ratio control (16:9, 9:16, 4:3, 3:2, 3:4, 2:3, 1:1)
- 🧭 Preview auto-scales with max height of 512px while preserving aspect
- 🎤 Record video with optional audio
- 🗣️ Voice-only recorder for quick notes
- ⏱️ Optional countdown timer (3s/5s/10s) for photo and recording starts
- 🔘 Contextual Start/Stop buttons during recording
- 📸 Photo capture using best-available quality path
- ⬇️ Download recorded media
- 🎨 Tailwind-powered dark theme with magenta accents

**Run locally:**
- `npm run serve` then open http://localhost:3333/media-studio/
