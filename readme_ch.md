<p align="center">
  <img src="./resources/main_pic.png" alt="CodeConductor banner" width="100%">
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
  <strong>面向命令行 AI Agent 的现代桌面应用与 WebUI</strong><br>
  <em>用户友好 | 可视化界面 | 多模型支持 | 本地优先</em>
</p>

<p align="center">
  <strong>基于 <a href="https://github.com/iOfficeAI/AionUi">AionUI</a> 二次开发，<a href="https://claude.com/blog/cowork-research-preview">Anthropic Cowork</a> 的开源增强版</strong><br>
  <sub>CodeConductor 在 AionUI 的优秀基础上，专注于提升命令行编程 Agent 在真实项目中的协作体验。</sub>
</p>

<p align="center">
  <a href="https://github.com/zhu1090093659/CodeConductor/releases">
    <img src="https://img.shields.io/badge/下载-最新版本-32CD32?style=for-the-badge&logo=github&logoColor=white" alt="下载最新版本" height="50">
  </a>
</p>

<p align="center">
  <a href="./readme.md">English</a> | <strong>简体中文</strong> | <a href="./readme_jp.md">日本語</a> | <a href="https://www.CodeConductor.com" target="_blank">官网</a> | <a href="https://twitter.com/CodeConductor" target="_blank">Twitter</a>
</p>

---

## 快速导航

<p align="center">

[定位](#定位) ·
[CodeConductor 能做什么](#codeconductor-能做什么) ·
[本分支增强点](#本分支增强点) ·
[核心功能](#核心功能) ·
[快速开始](#快速开始) ·
[文档](#文档) ·
[社区与支持](#社区与支持)

</p>

---

## 更新日志

### 1.7.13

- 功能增强：新增自定义助手创建与管理能力。
- 功能增强：在引导页加入 Agent 选择与分类。
- 功能增强：新增技能删除功能。
- 修复：主题初始化改为使用 DEFAULT_THEME，避免系统检测偏差。
- 构建/杂项：更新 About 页面链接以匹配新的仓库归属。
- 构建/杂项：调整 electron-builder 配置以改进安装器行为。

### 1.7.12

- 新增 ActionToolbar，提升会话页交互体验。
- 新增 CLI 模型列表 Hook，并支持手动选择的配置处理。
- 改进消息处理与日志输出，便于调试。

### 1.7.8

- 增强聊天 UI 组件,优化视觉设计和消息样式。
- 引入 Superpowers 工作流服务,提供引导式 Agent 设置页面进行工作流管理。
- 添加 GitHub Actions 工作流,实现 Pull Request 的 Jira 描述自动同步。
- 改进协作 UI,优化消息显示和交互模式。

### 1.7.7

- 实现 Superpowers 集成,提供全面的设置和命令管理功能。
- 添加专用设置页面,用于配置 Superpowers 模式和工作流。
- 通过 Superpowers 框架集成增强项目工作流能力。

### 1.7.6

- 修复自动更新器 404 错误,正确生成并上传 latest.yml 元数据文件。
- 提升自动应用更新的可靠性。

### 1.7.5

- 集成 popup-mcp 作为内置工具，支持交互式提示和确认。
- 添加多语言国际化支持。
- 为 Claude 和 Codex 添加 CLI 提供商配置界面及后端服务。
- 添加存储实用程序和思考过程显示组件。
- 修复了 CLI 提供商设置中 ANTHROPIC_MODEL 的默认值。
- 修复了 Guid 组件中重复调用模型设置的问题。

### 1.7.3

- 增强 ACP 适配器，更好地将 agent 思维转换为可显示的聊天消息。
- 实现 CLI 提供商设置，支持 Codex 和 Claude 的预设与存储。
- 改进协作功能，支持多角色通信和通知机制。
- 优化进程管理和孤儿进程清理，提升资源处理能力。
- 增强 IPC 通信机制，提升稳定性。
- 集成 electron-updater 实现自动增量更新。
- 改进 GitHub Actions 自动化构建和发布流程。

### 1.7.2

- 新增：CLI 供应商设置页（Claude Code / Codex）。
- 新增：`CollabChat` 视图与 `MessageList` 工具消息批量折叠，提升长对话可读性。
- 优化：终端与进程能力（基于 PTY 的终端管理、agent-browser 命令执行、worker 进程管理）。
- 修复/文档：修正文档链接与地址，补充与 AionUI/Cowork 的关系说明；新增社区行为准则（Code of Conduct）。

### 1.7.1

- 为 SendBox 系列组件加入提及能力（候选项、键盘选择、协作会话联动）。
- 优化 UI/主题一致性（输入框、按钮、弹窗、消息样式等细节）。
- 增强 agent-browser 浏览器自动化能力（IPC 支持与斜杠命令入口）。
- 更新构建/文档/配置模板，并补充多角色协作规范。

## 定位

这个仓库是 CodeConductor 的增强分支，保留了“为命令行 AI Agent 提供现代 UI”的目标，并把重点放在真实项目里的编程协作体验与日常效率。

## CodeConductor 能做什么

<p align="center">
  <img src="./resources/offica-ai BANNER-function copy.png" alt="CodeConductor 功能概览" width="800">
</p>

### 多代理模式（统一接入 CLI 工具）

如果你已经安装了 Claude Code、Codex、Qwen Code、Goose CLI 等命令行工具，CodeConductor 可以检测它们并提供统一的图形界面。

- **自动检测与统一界面**：识别本地 CLI 工具，把它们放到一个界面里使用。
- **本地保存与多会话**：对话保存在本地，支持多会话并行，每个会话独立上下文。

<p align="center">
  <img src="./resources/acp home page.gif" alt="多代理模式演示" width="800">
</p>

---

### 智能文件管理

_批量重命名、自动整理、智能分类、文件合并_

- **自动整理**：智能识别内容并自动分类，让文件夹保持整洁。
- **高效批量**：一键重命名、合并文件，彻底告别繁琐手动。

<p align="center">
  <img src="./resources/CodeConductor sort file.gif" alt="智能文件管理演示" width="800">
</p>

---

### 预览面板

_支持 9+ 种格式的可视化预览（PDF、Word、Excel、PPT、代码、Markdown、图片、HTML、Diff 等）_

- **立即查看效果**：AI 生成文件后，无需切换应用，立即查看预览。
- **集成在工作区** - 预览在右侧 Workspace 面板内显示，不再单独占用中间面板
- **实时追踪与可编辑**：自动追踪文件变更；支持 Markdown、代码、HTML 实时编辑。

<p align="center">
  <img src="./resources/preview.gif" alt="预览面板演示" width="800">
</p>

---

### 图像生成与编辑

_智能图像生成、编辑和识别，由 Gemini 驱动_

<p align="center">
  <img src="./resources/Image_Generation.gif" alt="AI 图像生成演示" width="800">
</p>

图像模型的选择与开关可在设置中完成。

---

### 多任务并行处理

_开多个对话、任务不混乱、记忆独立、效率翻倍_

<p align="center">
  <img src="./resources/multichat-side-by-side.gif" alt="对话管理演示" width="800">
</p>

---

### WebUI 模式

_远程控制您的 AI 工具 - 从网络中的任何设备访问 CodeConductor！安全控制本地 Claude Code、Codex 等工具，数据不离开您的设备_

```bash
# 基本启动
CodeConductor --webui

# 远程访问（局域网内其他设备可访问）
CodeConductor --webui --remote
```

各平台的完整启动方式请参考 [`WEBUI_GUIDE.md`](./WEBUI_GUIDE.md)。

<p align="center">
  <img src="./resources/webui banner.png" alt="WebUI 远程访问演示" width="800">
</p>

---

## 本分支增强点

这个分支主要面向“命令行编程 Agent 在真实项目里的可用性”，重点增强包括：

- 多角色协作视图（PM/Analyst/Engineer），在同一个项目会话内分工对话并集中查看与同步信息。
- 高影响操作的显式确认与可视化提示，例如执行命令或应用改动时更可控。
- 斜杠命令入口，把常见操作变成可发现、可复用的快捷流程。
- 更强调项目会话与工作区上下文，让对话更贴近任务推进与产物交付。
- 预览与对比更靠前，降低生成后核对与验收成本。

---

## 核心功能

### 多会话聊天

- **多会话 + 独立上下文** - 同时开多个聊天，每个会话拥有独立的上下文记忆，互不混淆
- **本地保存** - 所有对话都保存在本地，不会丢失

### 多模型支持

- **多平台支持** - 支持 Gemini、OpenAI、Claude、Qwen 等主流模型，灵活切换
- **本地模型支持** - 支持 Ollama、LM Studio 等本地模型部署，选择 Custom 平台并设置本地 API 地址（如 `http://localhost:11434/v1`）即可接入

### 文件管理

- **文件树浏览 + 拖拽上传** - 像文件夹一样浏览文件，支持拖拽文件或文件夹一键导入
- **智能整理** - 你可以让AI 帮你整理文件夹，自动分类

### 预览面板

- **9+ 种格式预览** - 支持 PDF、Word、Excel、PPT、代码、Markdown、图片等，AI 生成后立即查看效果
- **实时追踪 + 可编辑** - 自动追踪文件变更，支持 Markdown、代码、HTML 实时编辑和调试

### 图像生成与编辑

- **智能图像生成** - 支持 Gemini 2.5 Flash Image Preview、Nano、Banana 等多种图像生成模型
- **图像识别与编辑** - AI 驱动的图像分析和编辑功能

### WebUI 远程访问

- **跨设备访问** - 通过网络中的任何设备通过浏览器访问，支持移动端
- **本地数据安全** - 所有数据使用 SQLite 数据库本地存储，适合服务器部署

### 个性化界面定制

_自己写 CSS 代码自定义，让你的交互界面符合你的心意_

<p align="center">
  <img src="./resources/css with skin.gif" alt="CSS 自定义界面演示" width="800">
</p>

- **完全自定义** - 通过 CSS 代码自由定制界面颜色、风格、布局，打造专属使用体验

---

## 文档

- WebUI 启动指南：[`WEBUI_GUIDE.md`](./WEBUI_GUIDE.md)
- 项目概览与架构说明：[`CLAUDE.md`](./CLAUDE.md)
- 代码风格与约定：[`CODE_STYLE.md`](./CODE_STYLE.md)

---

## 快速开始

### 系统要求

- **macOS**: 10.15 或更高版本
- **Windows**: Windows 10 或更高版本
- **Linux**: Ubuntu 18.04+ / Debian 10+ / Fedora 32+
- **内存**: 建议 4GB 以上
- **存储**: 至少 500MB 可用空间

### 下载

<p>
  <a href="https://github.com/zhu1090093659/CodeConductor/releases">
    <img src="https://img.shields.io/badge/下载-最新版本-32CD32?style=for-the-badge&logo=github&logoColor=white" alt="下载最新版本" height="50">
  </a>
</p>

### 安装与使用（桌面应用）

1. 下载并安装 CodeConductor 应用
2. 在设置中配置 AI 供应商（根据供应商选择 Google 账号登录或 API Key）
3. 开始对话，并在工作区里推进任务与产物

### 从源码运行（开发者）

```bash
npm install
npm start
```

### WebUI 模式（开发者或无界面部署）

```bash
npm run webui
npm run webui:remote
```

---

## 社区与支持

### 社区交流

欢迎反馈想法与问题。建议类内容优先放到 Discussions，Bug 与功能请求使用 Issues。

- GitHub Discussions： https://github.com/zhu1090093659/CodeConductor/discussions
- Issues： https://github.com/zhu1090093659/CodeConductor/issues
- Releases： https://github.com/zhu1090093659/CodeConductor/releases

### 贡献代码

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

---

## 许可证

本项目采用 [Apache-2.0](LICENSE) 许可证。

---

## 贡献者

感谢所有为 CodeConductor 做出贡献的开发者们！

<p align="center">
  <a href="https://github.com/zhu1090093659/CodeConductor/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=zhu1090093659/CodeConductor&max=20" alt="Contributors" />
  </a>
</p>

## Star 历史

<p align="center">
  <a href="https://www.star-history.com/#zhu1090093659/CodeConductor&Date" target="_blank">
    <img src="https://api.star-history.com/svg?repos=zhu1090093659/CodeConductor&type=Date" alt="GitHub 星星趋势" width="600">
  </a>
</p>

<div align="center">

如果对你有帮助，欢迎点个 Star。

[报告 Bug](https://github.com/zhu1090093659/CodeConductor/issues) · [创建功能请求](https://github.com/zhu1090093659/CodeConductor/issues)

</div>
