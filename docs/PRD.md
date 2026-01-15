产品需求文档 (PRD): CodeConductor (基于 AionUi 改造)

版本: v2.0 (AionUi Fork Edition)
日期: 2026-01-15
基础代码库: iOfficeAI/AionUi
核心架构: FCMAS (File-Centric Multi-Agent System) + Electron

1. 项目概述与改造策略

CodeConductor 是基于 AionUi 进行深度定制开发的桌面端 AI 研发编排终端。

改造核心逻辑：
我们不重新发明轮子（聊天 UI、LLM 连接配置），而是扩展 AionUi 的能力边界：

从“对话工具”转变为“项目IDE”： 增加对本地文件系统的深度读写权限。

从“纯文本交互”转变为“终端集成”： 在 UI 中嵌入 xterm.js 以运行 Claude Code/Cursor CLI。

从“单点问答”转变为“多智能体编排”： 引入 JIRA MCP 和基于文件的 Agent 协作流。

2. 界面改造方案 (UI/UX Modifications)

基于 AionUi 的现有布局（左侧历史、中间对话、右侧设置/插件），进行如下改造：

2.1 左侧栏 (Sidebar) - 增强

现状 (AionUi): 主要是会话历史 (Chat History)。

改造: 增加 "Project Mode" (项目模式) 开关。

文件树视图 (File Tree): 当进入项目模式，左侧增加折叠式文件树，重点高亮显示 .ai/ 目录结构。

状态指示器: 在底部增加 JIRA 连接状态和 MCP 服务状态灯。

2.2 中间栏 (Chat Interface) - 逻辑注入

现状 (AionUi): 标准 Chat 界面。

改造:

Slash Command: 拦截输入框，支持 /pm sync, /plan, /run 等指令。

Agent 路由: 即使在同一个 Chat 窗口，后端需根据指令将 Prompt 分发给不同的 System Prompt (PM vs Analyst)。

引用增强: 允许用户通过 @文件名 快速引用本地文件内容到 Context（AionUi 可能已有类似功能，需强化对 .ai 目录的索引）。

2.3 右侧栏 (Workspace Panel) - 重构重点

现状 (AionUi): 通常用于设置、插件配置或简单的 Artifact 预览。

改造: 将右侧区域彻底重构为 多标签工作区 (Tabbed Workspace)：

Tab 1: 实时规划 (Live Spec):

监听并渲染 .ai/tech_spec.md 和 .ai/tasks/current_task.md。

增加 [Approve & Execute] 悬浮按钮，用户点击后触发 Terminal 执行。

Tab 2: 终端 (Terminal):

集成 xterm.js 组件。

后端对接 node-pty 进程。

专用于运行 Claude Code CLI，显示构建/测试日志。

Tab 3: 变更对比 (Diff):

简单的 Git Diff 视图，展示本次任务修改了哪些代码。

3. 技术架构改造 (Technical Architecture)

3.1 进程通信 (IPC) 扩展

AionUi 的 Electron 主进程 (Main Process) 需要新增以下处理能力：

PTY Manager:

引入 node-pty 库。

IPC Channel: terminal:spawn, terminal:data, terminal:resize。

负责启动本地 Shell (zsh/bash/powershell) 并维持 Claude Code 的运行会话。

File System Watcher:

引入 chokidar 库。

监控 .ai/ 目录下的 Markdown 文件变更。

当 Agent (Analyst) 修改了 Spec 文件时，通过 IPC 通知渲染进程实时刷新右侧预览。

MCP Client Host:

集成 @modelcontextprotocol/sdk。

在主进程中托管 JIRA MCP Client，负责处理 call_tool 请求（如 jira_get_ticket）。

3.2 智能体协作流 (Agent Workflow via AionUi)

我们不修改 LLM 的核心推理逻辑，而是通过 System Prompt 注入 和 文件读写 来实现角色分工。

场景：处理 JIRA 任务

用户输入: 在 AionUi 中输入 "处理 JIRA-123: 增加登录页"。

PM Agent (Chat):

AionUi 识别意图，加载 PM_System_Prompt。

调用 MCP 工具获取 JIRA 详情。

Action: 写入 .ai/backlog.md。

Response: "已获取需求，任务已加入 Backlog，请让分析师生成方案。"

用户操作: 点击右侧面板的 "Generate Plan"。

Analyst Agent (Background):

后台触发一次 LLM 调用。

输入：读取 .ai/backlog.md + 项目文件树。

Action: 生成/更新 .ai/tech_spec.md。

UI 反馈: 右侧 Tab 1 自动刷新显示 Markdown 方案。

用户操作: 审查方案，点击 "Run in Terminal"。

Engineer Agent (Terminal):

Electron 主进程向 PTY 发送指令：claude --prompt-file .ai/tasks/current_task.md。

用户在右侧 Tab 2 看到 Claude Code 开始自动写代码。

4. 文件协议规范 (File Protocol)

沿用 FCMAS 架构，.ai/ 目录是 AionUi 与底层 Agent 通信的桥梁。

/project_root
  ├── .ai/
  │   ├── context/
  │   │   ├── project_state.md   <-- PM 维护
  │   │   └── active_context.md  <-- 当前上下文摘要
  │   ├── specs/
  │   │   └── tech_spec.md       <-- Analyst 输出 (右侧预览源)
  │   ├── tasks/
  │   │   ├── current_task.md    <-- Engineer 输入
  │   │   └── done_log.md        <-- Engineer 输出
  │   └── backlog.md             <-- JIRA 同步源


5. 开发路线图 (Based on AionUi)

Phase 1: 终端集成 (The "Terminal" Wrapper)

[ ] Fork AionUi 仓库。

[ ] 在 Electron 主进程集成 node-pty。

[ ] 在右侧面板添加 xterm.js 组件。

[ ] 实现 Chat 发送文本指令 -> Terminal 执行的基本链路。

Phase 2: 文件系统与预览 (The "Spec" Viewer)

[ ] 实现 .ai 目录的初始化脚本。

[ ] 在右侧面板添加 Markdown 实时预览 Tab（监听文件变动）。

[ ] 实现 Chat 能够读写本地 Markdown 文件的 Tool。

Phase 3: JIRA 与 MCP (The "PM" Brain)

[ ] 集成 MCP SDK。

[ ] 配置 JIRA Server 连接。

[ ] 实现 JIRA -> Markdown 的转换逻辑。

6. 风险评估与应对

AionUi 兼容性风险: AionUi 的更新可能会覆盖我们的修改。

对策: 保持与其 Core 组件的解耦，尽量以 Plugin 或独立 Module 的形式注入代码。

Terminal 交互复杂性: Claude Code 在终端中经常需要方向键选择或确认。

对策: xterm.js 原生支持键盘事件转发，确保用户可以直接在 UI 上操作终端。