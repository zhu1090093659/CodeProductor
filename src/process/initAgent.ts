/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIONUI_TIMESTAMP_REGEX } from '@/common/constants';
import type { ICreateConversationParams } from '@/common/ipcBridge';
import type { TChatConversation } from '@/common/storage';
import { uuid } from '@/common/utils';
import fs from 'fs/promises';
import path from 'path';
import { copySkillsToAiWorkspace } from './services/skillProjectService';
import { getSystemDir } from './initStorage';

const ensureAiWorkspace = async (workspace: string) => {
  const aiRoot = path.join(workspace, '.ai');
  const dirs = ['context', 'specs', 'tasks', 'skills'];
  await Promise.all(dirs.map((dir) => fs.mkdir(path.join(aiRoot, dir), { recursive: true })));

  const files: Array<{ path: string; content: string }> = [
    {
      path: path.join(aiRoot, 'context', 'project_state.md'),
      content: '',
    },
    {
      path: path.join(aiRoot, 'context', 'active_context.md'),
      content: '',
    },
    {
      path: path.join(aiRoot, 'specs', 'tech_spec.md'),
      content: '',
    },
    {
      path: path.join(aiRoot, 'tasks', 'current_task.md'),
      content: '',
    },
    {
      path: path.join(aiRoot, 'tasks', 'done_log.md'),
      content: '',
    },
    {
      path: path.join(aiRoot, 'backlog.md'),
      content: '',
    },
  ];

  await Promise.all(
    files.map(async (file) => {
      try {
        await fs.access(file.path);
      } catch {
        await fs.writeFile(file.path, file.content, 'utf-8');
      }
    })
  );
};

const buildWorkspaceWidthFiles = async (defaultWorkspaceName: string, workspace?: string, defaultFiles?: string[], providedCustomWorkspace?: boolean, enabledSkills?: string[]) => {
  // 使用前端提供的customWorkspace标志，如果没有则根据workspace参数判断
  const customWorkspace = providedCustomWorkspace !== undefined ? providedCustomWorkspace : !!workspace;

  if (!workspace) {
    const tempPath = getSystemDir().workDir;
    workspace = path.join(tempPath, defaultWorkspaceName);
    await fs.mkdir(workspace, { recursive: true });
  } else {
    // 规范化路径：去除末尾斜杠，解析为绝对路径
    workspace = path.resolve(workspace);
  }
  await ensureAiWorkspace(workspace);
  // Sync selected skills into workspace/.ai/skills for workspace bridge usage
  // Keep non-fatal to avoid blocking conversation creation
  try {
    await copySkillsToAiWorkspace(workspace, enabledSkills);
  } catch (error) {
    console.warn('[AionUi] Failed to sync skills into .ai workspace:', error);
  }

  if (defaultFiles) {
    for (const file of defaultFiles) {
      // 确保文件路径是绝对路径
      const absoluteFilePath = path.isAbsolute(file) ? file : path.resolve(file);

      // 检查源文件是否存在
      try {
        await fs.access(absoluteFilePath);
      } catch (error) {
        console.warn(`[AionUi] Source file does not exist, skipping: ${absoluteFilePath}`);
        console.warn(`[AionUi] Original path: ${file}`);
        // 跳过不存在的文件，而不是抛出错误
        continue;
      }

      let fileName = path.basename(absoluteFilePath);

      // 如果是临时文件，去掉 AionUI 时间戳后缀
      const { cacheDir } = getSystemDir();
      const tempDir = path.join(cacheDir, 'temp');
      if (absoluteFilePath.startsWith(tempDir)) {
        fileName = fileName.replace(AIONUI_TIMESTAMP_REGEX, '$1');
      }

      const destPath = path.join(workspace, fileName);

      try {
        await fs.copyFile(absoluteFilePath, destPath);
      } catch (error) {
        console.error(`[AionUi] Failed to copy file from ${absoluteFilePath} to ${destPath}:`, error);
        // 继续处理其他文件，而不是完全失败
      }
    }
  }

  return { workspace, customWorkspace };
};

export const createAcpAgent = async (options: ICreateConversationParams): Promise<TChatConversation> => {
  const { extra } = options;
  const { workspace, customWorkspace } = await buildWorkspaceWidthFiles(`${extra.backend}-temp-${Date.now()}`, extra.workspace, extra.defaultFiles, extra.customWorkspace, extra.enabledSkills);
  return {
    type: 'acp',
    extra: {
      workspace: workspace,
      customWorkspace,
      backend: extra.backend,
      cliPath: extra.cliPath,
      agentName: extra.agentName,
      customAgentId: extra.customAgentId, // 同时用于标识预设助手 / Also used to identify preset assistant
      presetContext: extra.presetContext, // 智能助手的预设规则/提示词
      // 启用的 skills 列表（通过 SkillManager 加载）/ Enabled skills list (loaded via SkillManager)
      enabledSkills: extra.enabledSkills,
    },
    createTime: Date.now(),
    modifyTime: Date.now(),
    name: workspace,
    id: uuid(),
  };
};

export const createCodexAgent = async (options: ICreateConversationParams): Promise<TChatConversation> => {
  const { extra } = options;
  const { workspace, customWorkspace } = await buildWorkspaceWidthFiles(`codex-temp-${Date.now()}`, extra.workspace, extra.defaultFiles, extra.customWorkspace, extra.enabledSkills);
  return {
    type: 'codex',
    extra: {
      workspace: workspace,
      customWorkspace,
      cliPath: extra.cliPath,
      sandboxMode: 'workspace-write', // 默认为读写权限 / Default to read-write permission
      presetContext: extra.presetContext, // 智能助手的预设规则/提示词
      // 启用的 skills 列表（通过 SkillManager 加载）/ Enabled skills list (loaded via SkillManager)
      enabledSkills: extra.enabledSkills,
      // 预设助手 ID，用于在会话面板显示助手名称和头像
      // Preset assistant ID for displaying name and avatar in conversation panel
      presetAssistantId: extra.presetAssistantId,
    },
    createTime: Date.now(),
    modifyTime: Date.now(),
    name: workspace,
    id: uuid(),
  };
};
