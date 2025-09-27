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
- CDN-served dependencies (unpkg)Quests
