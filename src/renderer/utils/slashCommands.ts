/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { ConfigStorage } from '@/common/storage';
import type { IMcpServer } from '@/common/storage';
import { dispatchTerminalRunEvent } from './terminalEvents';
import { joinPath } from './path';
import type { SlashCommandItem } from './commandRegistry';
import { expandCommandTemplate } from './commandRegistry';

export interface SlashCommandResult {
  handled: boolean;
  message?: string;
  error?: string;
  messageToSend?: string;
  command?: SlashCommandItem;
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

const formatAgentBrowserOutput = (stdout: string, stderr: string, limit = 1200) => {
  const combined = [stdout, stderr].filter(Boolean).join('\n');
  if (!combined) return '';
  if (combined.length <= limit) return combined;
  return `${combined.slice(0, limit)}\n... (truncated)`;
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

export const handleSlashCommand = async (
  input: string,
  workspace: string,
  options?: {
    commands?: SlashCommandItem[];
  }
): Promise<SlashCommandResult> => {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) {
    return { handled: false };
  }

  const [commandToken, subcommand, ...rest] = trimmed.slice(1).split(/\s+/);
  const command = `/${commandToken}`;
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
    case '/browser': {
      const args = [subcommand, ...rest].filter(Boolean);
      if (!args.length) {
        return { handled: true, error: 'Missing agent-browser arguments. Example: /browser open https://example.com' };
      }
      const config = await ConfigStorage.get('tools.agentBrowser').catch((): undefined => undefined);
      const runResult = await ipcBridge.agentBrowser.run.invoke({
        args,
        cwd: workspace,
        cliPath: config?.cliPath,
        timeoutMs: config?.timeoutMs,
        env: config?.env,
      });
      const data = runResult?.data;
      const output = formatAgentBrowserOutput(data?.stdout || '', data?.stderr || '');
      const exitCode = data?.exitCode;
      if (!runResult?.success) {
        const errorText = runResult?.msg || 'agent-browser execution failed';
        const combined = output ? `${errorText}\n${output}` : errorText;
        return { handled: true, error: combined };
      }
      const summary = typeof exitCode === 'number' ? `agent-browser completed (exit ${exitCode}).` : 'agent-browser completed.';
      const message = output ? `${summary}\n${output}` : summary;
      return { handled: true, message };
    }
    default:
      break;
  }

  const availableCommands = options?.commands || [];
  const matched = availableCommands.find((item) => item.trigger === commandToken);
  if (!matched) {
    return { handled: true, error: 'Unknown command.' };
  }
  const argText = [subcommand, ...rest].filter(Boolean).join(' ').trim();
  const messageToSend = expandCommandTemplate(matched.body || '', argText);
  return {
    handled: true,
    command: matched,
    messageToSend,
  };
};
