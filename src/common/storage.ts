/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AcpBackend, AcpBackendConfig } from '@/types/acpTypes';
import { storage } from '@office-ai/platform';

/**
 * @description 聊天相关的存储
 */
export const ChatStorage = storage.buildStorage<IChatConversationRefer>('agent.chat');

// 聊天消息存储
export const ChatMessageStorage = storage.buildStorage('agent.chat.message');

// 系统配置存储
export const ConfigStorage = storage.buildStorage<IConfigStorageRefer>('agent.config');

// 系统环境变量存储
export const EnvStorage = storage.buildStorage<IEnvStorageRefer>('agent.env');

export interface IConfigStorageRefer {
  'acp.config': {
    [backend in AcpBackend]?: {
      authMethodId?: string;
      authToken?: string;
      lastAuthTime?: number;
      cliPath?: string;
    };
  };
  'acp.customAgents'?: AcpBackendConfig[];
  'model.config': IProvider[];
  'mcp.config': IMcpServer[];
  'mcp.agentInstallStatus': Record<string, string[]>;
  'cli.providers'?: CliProvidersStorage;
  'skills.repos'?: SkillRepoConfig[];
  'skills.enabledByAgent'?: Record<AcpBackend, string[]>;
  'superpowers.config'?: SuperpowersConfig;
  'commands.custom'?: CustomCommandConfig[];
  'project.list'?: ProjectInfo[];
  'project.activeId'?: string;
  'project.recentIds'?: string[];
  language: string;
  theme: string;
  colorScheme: string;
  customCss: string; // 自定义 CSS 样式
  'css.themes': ICssTheme[]; // 自定义 CSS 主题列表 / Custom CSS themes list
  'css.activeThemeId': string; // 当前激活的主题 ID / Currently active theme ID
  'model.defaultModel': string;
  'tools.imageGenerationModel': TProviderWithModel & {
    switch: boolean;
  };
  'tools.interactiveMode'?: boolean;
  'tools.agentBrowser'?: AgentBrowserConfig;
  // 是否在粘贴文件到工作区时询问确认（true = 不再询问）
  'workspace.pasteConfirm'?: boolean;
  // guid 页面上次选择的 agent 类型 / Last selected agent type on guid page
  'guid.lastSelectedAgent'?: string;
  // guid 页面协作模式开关状态 / Collab mode toggle on guid page
  'guid.collabMode'?: boolean;
  // 迁移标记：修复老版本中助手 enabled 默认值问题 / Migration flag: fix assistant enabled default value issue
  'migration.assistantEnabledFixed'?: boolean;
  // Migration flag: enable role assistants by default (pm/analyst/engineer)
  'migration.roleAssistantsEnabledByDefault'?: boolean;
}

export interface CustomCommandConfig {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export type CliProviderTarget = 'claude' | 'codex';

export interface AgentBrowserConfig {
  cliPath?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
}

export interface CliProviderPresetConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  enabledModels?: string[];
  templateValues?: Record<string, string>;
  /** Codex: model reasoning effort level */
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
}

export interface CliProviderConfig extends CliProviderPresetConfig {
  presetName?: string;
  providerConfigs?: Record<string, CliProviderPresetConfig>;
  /** Claude Code: global default thinking mode saved in ~/.claude/settings.json */
  alwaysThinkingEnabled?: boolean;
  /** Claude Code: env MAX_THINKING_TOKENS (string to preserve user input) */
  maxThinkingTokens?: string;
}

export type CliProvidersStorage = Record<CliProviderTarget, CliProviderConfig | undefined>;

export interface SkillRepoConfig {
  id: string;
  url: string;
  branch?: string;
  subdir?: string;
  lastSync?: number;
}

export type SuperpowersWorkflowMode = 'passive' | 'guided' | 'enforced';

export interface SuperpowersConfig {
  repoId: string;
  workflowMode: SuperpowersWorkflowMode;
  enabledForAgents?: {
    [agentKey in AcpBackend]?: {
      enabled: boolean;
      autoInject: boolean;
    };
  };
  stats?: {
    lastWorkflowUsed?: string;
  };
}

export interface IEnvStorageRefer {
  'CodeConductor.dir': {
    workDir: string;
    cacheDir: string;
  };
}

export interface ProjectInfo {
  id: string;
  name: string;
  workspace: string;
  createdAt: number;
  updatedAt: number;
}

interface IChatConversation<T, Extra> {
  createTime: number;
  modifyTime: number;
  name: string;
  desc?: string;
  id: string;
  type: T;
  extra: Extra;
  model: TProviderWithModel;
  status?: 'pending' | 'running' | 'finished' | undefined;
}

// Token 使用统计数据类型
export interface TokenUsageData {
  totalTokens: number;
}

export type TChatConversation =
  | Omit<
      IChatConversation<
        'acp',
        {
          workspace?: string;
          backend: AcpBackend;
          cliPath?: string;
          customWorkspace?: boolean;
          projectId?: string;
          agentName?: string;
          customAgentId?: string; // UUID for identifying specific custom agent
          presetContext?: string; // 智能助手的预设规则/提示词 / Preset context from smart assistant
          /** 启用的 skills 列表，用于过滤 SkillManager 加载的 skills / Enabled skills list for filtering SkillManager skills */
          enabledSkills?: string[];
          /** 预设助手 ID，用于在会话面板显示助手名称和头像 / Preset assistant ID for displaying name and avatar in conversation panel */
          presetAssistantId?: string;
          /**
           * Collaboration metadata for merged multi-role chat.
           * Collab parent stores roleMap; children store collabParentId to be hidden in UI.
           */
          collab?: {
            roleMap: {
              pm: string;
              analyst: string;
              engineer: string;
            };
          };
          /** Parent conversation id for collab children (used for UI filtering) */
          collabParentId?: string;
        }
      >,
      'model'
    >
  | Omit<
      IChatConversation<
        'codex',
        {
          workspace?: string;
          cliPath?: string;
          customWorkspace?: boolean;
          projectId?: string;
          sandboxMode?: 'read-only' | 'workspace-write' | 'danger-full-access'; // Codex sandbox permission mode
          presetContext?: string; // 智能助手的预设规则/提示词 / Preset context from smart assistant
          /** 启用的 skills 列表，用于过滤 SkillManager 加载的 skills / Enabled skills list for filtering SkillManager skills */
          enabledSkills?: string[];
          /** 预设助手 ID，用于在会话面板显示助手名称和头像 / Preset assistant ID for displaying name and avatar in conversation panel */
          presetAssistantId?: string;
          /**
           * Collaboration metadata for merged multi-role chat.
           * Collab parent stores roleMap; children store collabParentId to be hidden in UI.
           */
          collab?: {
            roleMap: {
              pm: string;
              analyst: string;
              engineer: string;
            };
          };
          /** Parent conversation id for collab children (used for UI filtering) */
          collabParentId?: string;
        }
      >,
      'model'
    >;

export type IChatConversationRefer = {
  'chat.history': TChatConversation[];
};

export type ModelType =
  | 'text' // 文本对话
  | 'vision' // 视觉理解
  | 'function_calling' // 工具调用
  | 'image_generation' // 图像生成
  | 'web_search' // 网络搜索
  | 'reasoning' // 推理模型
  | 'embedding' // 嵌入模型
  | 'rerank' // 重排序模型
  | 'excludeFromPrimary'; // 排除：不适合作为主力模型

export type ModelCapability = {
  type: ModelType;
  /**
   * 是否为用户手动选择，如果为true，则表示用户手动选择了该类型，否则表示用户手动禁止了该模型；如果为undefined，则表示使用默认值
   */
  isUserSelected?: boolean;
};

export interface IProvider {
  id: string;
  platform: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string[];
  /**
   * 模型能力标签列表。打了标签就是支持，没打就是不支持
   */
  capabilities?: ModelCapability[];
  /**
   * 上下文token限制，可选字段，只在明确知道时填写
   */
  contextLimit?: number;
}

export type TProviderWithModel = Omit<IProvider, 'model'> & { useModel: string };

// MCP Server Configuration Types
export type McpTransportType = 'stdio' | 'sse' | 'http';

export interface IMcpServerTransportStdio {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface IMcpServerTransportSSE {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
}

export interface IMcpServerTransportHTTP {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
}

export interface IMcpServerTransportStreamableHTTP {
  type: 'streamable_http';
  url: string;
  headers?: Record<string, string>;
}

export type IMcpServerTransport = IMcpServerTransportStdio | IMcpServerTransportSSE | IMcpServerTransportHTTP | IMcpServerTransportStreamableHTTP;

export interface IMcpServer {
  id: string;
  name: string;
  description?: string;
  enabled: boolean; // 是否已安装到 CLI agents（控制 Switch 状态）
  transport: IMcpServerTransport;
  tools?: IMcpTool[];
  status?: 'connected' | 'disconnected' | 'error' | 'testing'; // 连接状态（同时表示服务可用性）
  lastConnected?: number;
  createdAt: number;
  updatedAt: number;
  originalJson: string; // 存储原始JSON配置，用于编辑时的准确显示
}

export interface IMcpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

/**
 * CSS 主题配置接口 / CSS Theme configuration interface
 * 用于存储用户自定义的 CSS 皮肤 / Used to store user-defined CSS skins
 */
export interface ICssTheme {
  id: string; // 唯一标识 / Unique identifier
  name: string; // 主题名称 / Theme name
  cover?: string; // 封面图片 base64 或 URL / Cover image base64 or URL
  css: string; // CSS 样式代码 / CSS style code
  isPreset?: boolean; // 是否为预设主题 / Whether it's a preset theme
  createdAt: number; // 创建时间 / Creation time
  updatedAt: number; // 更新时间 / Update time
}
