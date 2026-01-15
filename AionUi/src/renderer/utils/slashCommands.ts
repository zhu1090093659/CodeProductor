/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { ConfigStorage } from '@/common/storage';
import type { IMcpServer } from '@/common/storage';
import { dispatchTerminalRunEvent } from './terminalEvents';
import { joinPath } from './path';

export interface SlashCommandResult {
  handled: boolean;
  message?: string;
  error?: string;
}

const findJiraServer = (servers: IMcpServer[]) => {
  return servers.find((server) => server.name.toLowerCase().includes('jira')) || null;
};

const appendBacklog = async (workspace: string, content: string) => {
  const backlogPath = joinPath(workspace, '.ai', 'backlog.md');
  let existing = '';
  try {
    existing = await ipcBridge.fs.readFile.invoke({ path: backlogPath });
  } catch {
    existing = '# Backlog\n\n';
  }
  const next = `${existing}\n## ${new Date().toISOString()}\n\n${content}\n`;
  await ipcBridge.fs.writeFile.invoke({ path: backlogPath, data: next });
};

const generatePlan = async (workspace: string) => {
  const backlogPath = joinPath(workspace, '.ai', 'backlog.md');
  const specPath = joinPath(workspace, '.ai', 'specs', 'tech_spec.md');
  let backlog = '';
  try {
    backlog = await ipcBridge.fs.readFile.invoke({ path: backlogPath });
  } catch {
    backlog = '';
  }
  const template = `# Technical Spec\n\n## Requirements\n\n${backlog || '- Pending backlog sync'}\n\n## Plan\n\n- Analyze existing modules\n- Implement IPC + UI changes\n- Validate terminal + watcher\n`;
  await ipcBridge.fs.writeFile.invoke({ path: specPath, data: template });
};

export const handleSlashCommand = async (input: string, workspace: string): Promise<SlashCommandResult> => {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) {
    return { handled: false };
  }

  const [command, subcommand, ...rest] = trimmed.split(/\s+/);
  switch (command) {
    case '/run': {
      const commandText = rest.join(' ') || 'claude --prompt-file .ai/tasks/current_task.md';
      dispatchTerminalRunEvent({ workspace, command: commandText });
      return { handled: true, message: 'Command sent to terminal.' };
    }
    case '/plan': {
      await generatePlan(workspace);
      return { handled: true, message: 'Plan generated in .ai/specs/tech_spec.md.' };
    }
    case '/pm': {
      if (subcommand !== 'sync') {
        return { handled: true, error: 'Unknown /pm command. Use /pm sync <JIRA-KEY>.' };
      }
      const jiraKey = rest[0];
      if (!jiraKey) {
        return { handled: true, error: 'Missing JIRA key. Example: /pm sync JIRA-123' };
      }
      const servers = (await ConfigStorage.get('mcp.config')) || [];
      const jiraServer = findJiraServer(servers);
      if (!jiraServer) {
        return { handled: true, error: 'JIRA MCP server not found in config.' };
      }
      const toolResult = await ipcBridge.mcpService.callTool.invoke({
        server: jiraServer,
        toolName: 'jira_get_ticket',
        toolArgs: { key: jiraKey },
      });
      if (!toolResult?.success) {
        return { handled: true, error: toolResult?.msg || 'JIRA sync failed.' };
      }
      const summary = typeof toolResult.data?.result === 'string' ? toolResult.data?.result : JSON.stringify(toolResult.data?.result, null, 2);
      await appendBacklog(workspace, summary);
      return { handled: true, message: `Synced ${jiraKey} to .ai/backlog.md.` };
    }
    default:
      return { handled: true, error: 'Unknown command.' };
  }
};
