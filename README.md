# Synapse AI - AI Interview Assistant

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Electron](https://img.shields.io/badge/Electron-191970?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-B73BFE?logo=vite&logoColor=FFD62E)](https://vitejs.dev/)

Synapse AI is a privacy-first, offline AI interview assistant that provides real-time speech recognition and intelligent answer suggestions. It runs locally on your machine, ensuring complete privacy during your interviews. Built with an Electron desktop application, it overlays beautifully on top of your screen.

## ✨ Features

- 🎤 **Multiple STT Engines** - Real-time transcription using Whisper.cpp or Moonshine ONNX pipelines (100% offline).
- 🧠 **Advanced VAD Pipeline** - Utterance-based transcription with Voice Activity Detection and energy-based pre-filtering to eliminate hallucinations.
- 🤖 **AI Answer Generation** - Professional interview answers using local LLMs via Ollama, featuring STAR-structured formatting and markdown rendering.
- 📊 **Live Delivery Analytics** - Real-time tracking of filler words, pacing (WPM), and talk-time ratio via a non-intrusive MetricsBar.
- 🎯 **Interactive Question Detection** - Real-time question surfacing with deduplication, letting you select the exact question before generating answers.
- 🪟 **Resizable Glassmorphism Overlays** - Beautiful, edge-resizable transparent UI that provides answers right when you need them.
- 🎓 **Practice Mode & Export** - Multi-dimensional scoring, ESL-friendly prompt support, and comprehensive session data export.
- ⏱️ **Session Management** - Visual audio waveforms, Q&A history navigation, and active session timers.
- 🔒 **Privacy First** - Everything runs locally. No cloud dependencies. No data leaves your machine.

## 🏗️ Project Structure

```text
synapse-ai/
├── electron/                 # Main process code (Electron)
│   ├── main/
│   │   ├── index.ts          # Main entry point
│   │   ├── window.ts         # Window management and overlay setup
│   │   ├── ipc-handlers.ts   # IPC event handlers for frontend-backend communication
│   │   └── whisper/          # Native Whisper.cpp wrapper logic
│   ├── preload/              # Preload scripts (IPC bridge)
│   └── types/                # TypeScript type definitions
│
├── src/                      # Renderer process (React Frontend)
│   ├── components/           # UI Components (shadcn/ui, Panels, Widgets)
│   ├── hooks/                # Custom React Hooks (useWhisper, useLLM, etc.)
│   ├── lib/                  # Utilities
│   └── index.css             # Tailwind CSS entry & Design System
│
├── e2e/                      # Playwright End-to-End tests
│
└── models/                   # Local STT models (Whisper/Moonshine auto-downloaded)
```

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+) or [Bun](https://bun.sh/)
- Windows OS (Required for certain transparent overlay features and desktop audio capture)
- [Ollama](https://ollama.com/) (For local LLM capabilities)

### Installation

Clone the repository and install dependencies:

```bash
# Clone the repository
git clone https://github.com/your-username/synapse-ai.git
cd synapse-ai

# Install dependencies using bun (or npm/yarn)
bun install
```

### Running Locally

```bash
# Build the Electron main process
bun run build:electron

# Start the application in development mode
bun run dev
```

### 🧠 Setting up Local AI Models

1. **Speech Recognition (Whisper & Moonshine):**
   The required STT models can be downloaded directly from the Settings Panel inside the app. The application automatically manages downloading and switching between Whisper and Moonshine engines. Alternatively, you can use the setup script:
   ```bash
   bun run setup:whisper
   ```
   *Note: Moonshine models are highly optimized and run seamlessly via the integrated ONNX pipeline sidecar.*

2. **LLM Answers (Ollama):**
   Make sure you have Ollama installed and running. Pull your preferred model (e.g., `qwen2.5:0.5b` or `llama3`):
   ```bash
   ollama run qwen2.5:0.5b
   ```
   You can configure the model name and customize the response style (e.g., enabling "Bullet Points" mode) inside the Synapse AI Settings panel.

## 🧪 Testing

Synapse AI uses [Playwright](https://playwright.dev/) for end-to-end testing.

```bash
# Run all E2E tests
bun run test:e2e

# Run tests with the UI visible
bun run test:e2e:headed

# Run tests in interactive UI mode
bun run test:e2e:ui
```

See the [E2E Testing Guide](./e2e/README.md) for more detailed information.

## 🛠️ Architecture

### Main Process (Electron)
- **STT Integrations** - Robust transcription using native Whisper.cpp wrappers and Moonshine sidecars managed efficiently by the main process.
- **Window Management** - Advanced resizable overlay configuration, transparent boundary management, and screen privacy features.
- **IPC Handlers** - Type-safe, high-performance communication with the renderer process for state and settings persistence.

### Renderer Process (React)
- **Component Architecture** - Modular, reusable UI using Tailwind CSS and shadcn/ui components.
- **React Hooks** - Streamlined hooks like `useWhisper`, `useAudioRecorder`, and `useLLM` to manage core application state seamlessly.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.
