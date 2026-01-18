/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { ConfigStorage } from '@/common/storage';
import { execFile } from 'child_process';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { TerminalService } from '../services/terminalService';

const terminalService = new TerminalService({
  onData: (id, data) => {
    ipcBridge.terminal.data.emit({ id, data });
  },
  onExit: (id, exitCode, signal) => {
    ipcBridge.terminal.exit.emit({ id, exitCode, signal });
  },
});

// Export terminalService for cleanup on app exit
// 导出 terminalService 以便在应用退出时清理
export { terminalService };

const execFileAsync = promisify(execFile);
const DEFAULT_AGENT_BROWSER_TIMEOUT_MS = 60000;
const AGENT_BROWSER_MAX_BUFFER = 10 * 1024 * 1024;

const splitCommand = (value: string): string[] => {
  const matches = value.match(/(?:[^\s"]+|"[^"]*")+/g);
  if (!matches) return [value];
  return matches.map((part) => part.replace(/^"(.*)"$/, '$1'));
};

const findLocalAgentBrowserBinary = (): string | null => {
  const binaryName = process.platform === 'win32' ? 'agent-browser.cmd' : 'agent-browser';
  const roots = [app.getAppPath(), process.resourcesPath, path.join(process.resourcesPath, 'app.asar.unpacked'), process.cwd()];
  for (const root of roots) {
    if (!root) continue;
    const candidate = path.join(root, 'node_modules', '.bin', binaryName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

const resolveAgentBrowserCommand = (cliPath?: string): { command: string; args: string[] } => {
  if (cliPath && cliPath.trim()) {
    const [command, ...args] = splitCommand(cliPath.trim());
    return { command, args };
  }
  const localBinary = findLocalAgentBrowserBinary();
  if (localBinary) return { command: localBinary, args: [] };
  return { command: 'agent-browser', args: [] };
};

export function initTerminalBridge(): void {
  ipcBridge.terminal.spawn.provider((params) => {
    try {
      const id = terminalService.spawnTerminal(params || {});
      return Promise.resolve({ success: true, data: { id } });
    } catch (error) {
      return Promise.resolve({ success: false, msg: error instanceof Error ? error.message : String(error) });
    }
  });

  ipcBridge.terminal.write.provider(({ id, data }) => {
    terminalService.write(id, data);
    return Promise.resolve({ success: true });
  });

  ipcBridge.terminal.resize.provider(({ id, cols, rows }) => {
    terminalService.resize(id, cols, rows);
    return Promise.resolve({ success: true });
  });

  ipcBridge.terminal.dispose.provider(({ id }) => {
    terminalService.dispose(id);
    return Promise.resolve({ success: true });
  });

  ipcBridge.terminal.disposeByCwd.provider(({ cwd }) => {
    try {
      const count = terminalService.disposeByCwd(cwd);
      return Promise.resolve({ success: true, data: { count } });
    } catch (error) {
      return Promise.resolve({ success: false, msg: error instanceof Error ? error.message : String(error) });
    }
  });

  ipcBridge.agentBrowser.run.provider(async (params) => {
    const args = params?.args || [];
    if (!args.length) {
      return { success: false, msg: 'Missing agent-browser arguments' };
    }
    const storedConfig = await ConfigStorage.get('tools.agentBrowser').catch((): undefined => undefined);
    const resolvedCommand = resolveAgentBrowserCommand(params?.cliPath || storedConfig?.cliPath);
    const finalArgs = [...resolvedCommand.args, ...args];
    const resolvedCwd = params?.cwd || process.cwd();
    const resolvedTimeout = params?.timeoutMs ?? storedConfig?.timeoutMs ?? DEFAULT_AGENT_BROWSER_TIMEOUT_MS;
    const mergedEnv = { ...process.env, ...(storedConfig?.env || {}), ...(params?.env || {}) };
    const startTime = Date.now();

    const needsShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(resolvedCommand.command);
    try {
      const { stdout, stderr } = await execFileAsync(resolvedCommand.command, finalArgs, {
        cwd: resolvedCwd,
        env: mergedEnv,
        timeout: resolvedTimeout,
        maxBuffer: AGENT_BROWSER_MAX_BUFFER,
        shell: needsShell,
      });
      return {
        success: true,
        data: {
          command: resolvedCommand.command,
          args: finalArgs,
          cwd: resolvedCwd,
          exitCode: 0,
          stdout: stdout ?? '',
          stderr: stderr ?? '',
          durationMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      const execError = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number };
      const exitCode = typeof execError.code === 'number' ? execError.code : -1;
      return {
        success: false,
        msg: execError.message || 'agent-browser failed',
        data: {
          command: resolvedCommand.command,
          args: finalArgs,
          cwd: resolvedCwd,
          exitCode,
          stdout: execError.stdout ?? '',
          stderr: execError.stderr ?? '',
          durationMs: Date.now() - startTime,
        },
      };
    }
  });
}
