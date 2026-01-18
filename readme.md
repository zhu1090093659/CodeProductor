# CodeConductor

<p align="center">
  <img src="./resources/CodeConductor-banner-1 copy.png" alt="CodeConductor banner" width="100%">
</p>

<p align="center">
  <img src="https://img.shields.io/github/v/release/zhu1090093659/CodeConductor?style=flat-square&color=32CD32" alt="Version">
  &nbsp;
  <img src="https://img.shields.io/badge/license-Apache--2.0-32CD32?style=flat-square&logo=apache&logoColor=white" alt="License">
  &nbsp;
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-6C757D?style=flat-square&logo=linux&logoColor=white" alt="Platform">
</p>

---

<p align="center">
  <strong>A modern Desktop/Web UI for command-line AI agents</strong><br>
  <em>User-friendly | Visual interface | Multi-model support | Local-first data</em>
</p>

<p align="center">
  <strong>Open-source enhanced fork of <a href="https://github.com/iOfficeAI/AionUi">AionUI</a> / <a href="https://claude.com/blog/cowork-research-preview">Anthropic Cowork</a></strong><br>
  <sub>CodeConductor builds upon the excellent AionUI foundation, adding workflow enhancements for real-world coding agent usage.</sub>
</p>

<p align="center">
  <a href="https://github.com/zhu1090093659/CodeConductor/releases">
    <img src="https://img.shields.io/badge/Download-Latest%20Release-32CD32?style=for-the-badge&logo=github&logoColor=white" alt="Download Latest Release" height="50">
  </a>
</p>

<p align="center">
  <strong>English</strong> | <a href="./readme_ch.md">简体中文</a> | <a href="./readme_jp.md">日本語</a> | <a href="https://www.CodeConductor.com" target="_blank">Official Website</a> | <a href="https://twitter.com/CodeConductor" target="_blank">Twitter</a>
</p>

---

## Quick navigation

<p align="center">

[Positioning](#positioning) ·
[What CodeConductor can do](#what-codeconductor-can-do) ·
[Enhancements in this fork](#enhancements-in-this-fork) ·
[Core features](#core-features) ·
[Quick start](#quick-start) ·
[Documentation](#documentation) ·
[Community and support](#community-and-support)

</p>

---

## Changelog

### 1.7.2

- Add a settings page for configuring CLI providers (Claude Code / Codex).
- Add `CollabChat` view and `MessageList` with collapsible tool message batches for better readability.
- Improve terminal and process handling (PTY-based terminal management, agent-browser command execution, worker process management).
- Fix documentation links/addresses and clarify fork positioning; add Contributor Covenant Code of Conduct.

### 1.7.1

- Add mention support in SendBox components (mention options, keyboard navigation, collab integration).
- Improve UI/UX styling and theme consistency (inputs, buttons, modals, message visuals).
- Enhance browser automation capabilities via agent-browser (IPC support and slash command entry).
- Update build/docs/config templates and collaboration role guidelines.

## Positioning

This repository is an enhanced fork of CodeConductor. It keeps the original goal (a modern UI for command-line AI agents) and focuses on improving day-to-day “coding agent in real projects” workflows.

## What CodeConductor can do

<p align="center">
  <img src="./resources/offica-ai BANNER-function copy.png" alt="CodeConductor feature banner" width="800">
</p>

### Multi-agent mode (unified UI for CLI tools)

If you have installed command-line tools like Claude Code, Codex, Qwen Code, Goose CLI, CodeConductor can detect them and provide a unified graphical interface.

- **Auto detection and unified UI** - Recognize local CLI tools and bring them into one interface.
- **Local storage and multi-session** - Save conversations locally and run multiple sessions with independent context.

<p align="center">
  <img src="./resources/acp home page.gif" alt="Multi-Agent Mode Demo" width="800">
</p>

---

### Smart file management

_Batch renaming, automatic organization, smart classification, file merging_

- **Auto Organize**: Intelligently identify content and auto-classify, keeping folders tidy.
- **Efficient Batch**: One-click rename, merge files, say goodbye to tedious manual tasks.

<p align="center">
  <img src="./resources/CodeConductor sort file.gif" alt="Smart File Management Demo" width="800">
</p>

---

### Preview panel

_Supports 9+ formats of visual preview (PDF, Word, Excel, PPT, code, Markdown, images, HTML, Diff, etc.)_

- **View results instantly** - After AI generates files, view preview immediately without switching apps
- **Integrated in Workspace** - Preview is rendered inside the Workspace panel (right side), no separate middle panel
- **Real-time tracking and editing** - Automatically tracks file changes; supports real-time editing of Markdown, code, and HTML

<p align="center">
  <img src="./resources/preview.gif" alt="Preview Panel Demo" width="800">
</p>

---

### Image generation and editing

_Intelligent image generation, editing, and recognition, powered by Gemini_

<p align="center">
  <img src="./resources/Image_Generation.gif" alt="AI Image Generation Demo" width="800">
</p>

---

### Multi-task parallel processing

_Open multiple conversations, tasks don't get mixed up, independent memory, double efficiency_

<p align="center">
  <img src="./resources/multichat-side-by-side.gif" alt="Conversation Management Demo" width="800">
</p>

---

### WebUI mode

_Remotely control your AI tools - Access CodeConductor from any device on the network! Securely control local Claude Code, Codex, and other tools, data never leaves your device_

```bash
# Basic startup
CodeConductor --webui

# Remote access (accessible from other devices on the local network)
CodeConductor --webui --remote
```

For full startup instructions on all platforms, see [`WEBUI_GUIDE.md`](./WEBUI_GUIDE.md).

<p align="center">
  <img src="./resources/webui banner.png" alt="WebUI Remote Access Demo" width="800">
</p>

---

## Enhancements in this fork

This fork focuses on making command-line coding agents easier to use in real projects and daily work:

- **Multi-role collaboration view (PM/Analyst/Engineer)** - Enable structured collaboration inside one project conversation.
- **Safer high-impact actions with explicit approvals** - Clearer confirmation and visual cues for actions like executing commands or applying changes.
- **Slash commands for faster project workflows** - Discoverable and reusable shortcuts for common actions in project chats.
- **Project-first conversations with workspace context** - Task-driven, artifact-oriented project sessions with workspace context.
- **Review-friendly workflow** - Preview and diff are treated as first-class citizens to reduce review friction.

---

## Core features

### Multi-session chat

- **Multi-Session + Independent Context** - Open multiple chats simultaneously, each session has independent context memory, no confusion
- **Local Storage** - All conversations are saved locally and will not be lost

### Multi-model support

- **Multi-Platform Support** - Supports mainstream models like Gemini, OpenAI, Claude, Qwen, flexible switching
- **Local Model Support** - Supports local model deployment like Ollama, LM Studio, select Custom platform and set local API address (e.g., `http://localhost:11434/v1`) to connect
- **Gemini 3 Subscription Optimization** - Automatically identifies subscribed users, recommends advanced models

### File management

- **File Tree Browsing + Drag & Drop Upload** - Browse files like folders, support drag and drop files or folders for one-click import
- **Smart Organization** - You can let AI help organize folders, automatic classification

### Preview panel

- **9+ Format Preview** - Supports PDF, Word, Excel, PPT, code, Markdown, images, etc., view results immediately after AI generation
- **Real-time Tracking + Editable** - Automatically tracks file changes, supports real-time editing and debugging of Markdown, code, HTML

### Image generation and editing

- **Intelligent Image Generation** - Supports multiple image generation models like Gemini 2.5 Flash Image Preview, Nano, Banana
- **Image Recognition & Editing** - AI-driven image analysis and editing features

### WebUI remote access

- **Cross-Device Access** - Access from any device on the network via browser, supports mobile devices
- **Local Data Security** - All data stored locally in SQLite database, suitable for server deployment

### Personalized interface customization

_Customize with your own CSS code, make your interface match your preferences_

<p align="center">
  <img src="./resources/css with skin.gif" alt="CSS Custom Interface Demo" width="800">
</p>

- **Fully Customizable** - Freely customize interface colors, styles, layout through CSS code, create your exclusive experience

---

## Documentation

- WebUI startup guide: [`WEBUI_GUIDE.md`](./WEBUI_GUIDE.md)
- Project overview and architecture notes: [`CLAUDE.md`](./CLAUDE.md)
- Code style and conventions: [`CODE_STYLE.md`](./CODE_STYLE.md)

---

## Quick start

### System requirements

- **macOS**: 10.15 or higher
- **Windows**: Windows 10 or higher
- **Linux**: Ubuntu 18.04+ / Debian 10+ / Fedora 32+
- **Memory**: Recommended 4GB or more
- **Storage**: At least 500MB available space

### Download

<p>
  <a href="https://github.com/zhu1090093659/CodeConductor/releases">
    <img src="https://img.shields.io/badge/Download-Latest%20Release-32CD32?style=for-the-badge&logo=github&logoColor=white" alt="Download Latest Release" height="50">
  </a>
</p>

### Installation (desktop app)

1. Download and install the CodeConductor application
2. Configure your AI provider in Settings (Google account login or API Key, depending on provider)
3. Start a conversation and work in a project workspace

### Run from source (developers)

```bash
npm install
npm start
```

### WebUI mode (developers or headless)

```bash
npm run webui
npm run webui:remote
```

---

## Community and support

### Community

Your ideas and feedback are welcome. Use Discussions for ideas and issues for bugs or feature requests.

- GitHub Discussions: https://github.com/zhu1090093659/CodeConductor/discussions
- Issues: https://github.com/zhu1090093659/CodeConductor/issues
- Releases: https://github.com/zhu1090093659/CodeConductor/releases

### Contributing

Welcome to submit Issues and Pull Requests!

1. Fork this project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## License

This project is licensed under [Apache-2.0](LICENSE).

---

## Contributors

Thanks to all developers who have contributed to CodeConductor!

<p align="center">
  <a href="https://github.com/zhu1090093659/CodeConductor/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=zhu1090093659/CodeConductor&max=20" alt="Contributors" />
  </a>
</p>

## Star history

<p align="center">
  <a href="https://www.star-history.com/#zhu1090093659/CodeConductor&Date" target="_blank">
    <img src="https://api.star-history.com/svg?repos=zhu1090093659/CodeConductor&type=Date" alt="GitHub Star Trends" width="600">
  </a>
</p>

<div align="center">

If you find it useful, a star helps.

[Report Bug](https://github.com/zhu1090093659/CodeConductor/issues) · [Request Feature](https://github.com/zhu1090093659/CodeConductor/issues)

</div>
