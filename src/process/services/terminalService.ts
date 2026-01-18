/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IPty } from 'node-pty';
import { spawn } from 'node-pty';
import path from 'path';
import { uuid } from '@/common/utils';

export interface TerminalSpawnOptions {
  cwd?: string;
  cols?: number;
  rows?: number;
  shell?: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface TerminalEvents {
  onData: (id: string, data: string) => void;
  onExit: (id: string, exitCode: number | null, signal?: number) => void;
}

export class TerminalService {
  private terminals = new Map<string, IPty>();
  private terminalCwds = new Map<string, string>();
  private events: TerminalEvents;

  constructor(events: TerminalEvents) {
    this.events = events;
  }

  spawnTerminal(options: TerminalSpawnOptions = {}): string {
    const terminalId = uuid();
    const shell = options.shell || this.resolveDefaultShell();
    const args = options.args || [];
    const cols = options.cols ?? 80;
    const rows = options.rows ?? 24;
    const env = { ...process.env, ...(options.env || {}) };
    const cwd = options.cwd || process.cwd();

    const ptyProcess = spawn(shell, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env,
    });

    ptyProcess.onData((data) => {
      this.events.onData(terminalId, data);
    });

    ptyProcess.onExit((event) => {
      this.terminals.delete(terminalId);
      this.terminalCwds.delete(terminalId);
      this.events.onExit(terminalId, event.exitCode ?? null, event.signal);
    });

    this.terminals.set(terminalId, ptyProcess);
    this.terminalCwds.set(terminalId, cwd);
    return terminalId;
  }

  write(terminalId: string, data: string): void {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) return;
    terminal.write(data);
  }

  resize(terminalId: string, cols: number, rows: number): void {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) return;
    terminal.resize(cols, rows);
  }

  dispose(terminalId: string): void {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) return;
    terminal.kill();
    this.terminals.delete(terminalId);
    this.terminalCwds.delete(terminalId);
  }

  disposeByCwd(targetCwd: string): number {
    if (!targetCwd) return 0;
    const normalizedTarget = this.normalizePath(targetCwd);
    if (!normalizedTarget) return 0;

    let disposed = 0;
    for (const [terminalId, cwd] of Array.from(this.terminalCwds.entries())) {
      const normalizedCwd = this.normalizePath(cwd);
      if (!normalizedCwd) continue;
      if (normalizedCwd === normalizedTarget || normalizedCwd.startsWith(normalizedTarget + path.sep)) {
        this.dispose(terminalId);
        disposed += 1;
      }
    }
    return disposed;
  }

  /**
   * Dispose all terminals - called on application exit
   * 销毁所有终端 - 应用退出时调用
   */
  disposeAll(): number {
    const count = this.terminals.size;
    for (const terminalId of Array.from(this.terminals.keys())) {
      this.dispose(terminalId);
    }
    return count;
  }

  private resolveDefaultShell(): string {
    if (process.platform === 'win32') {
      return process.env.COMSPEC || 'powershell.exe';
    }
    return process.env.SHELL || 'bash';
  }

  private normalizePath(value: string): string {
    const resolved = path.resolve(value);
    const normalized = resolved.replace(/[\\/]+$/, '');
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
  }
}
