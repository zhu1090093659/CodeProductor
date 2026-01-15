/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IPty } from 'node-pty';
import { spawn } from 'node-pty';
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

    const ptyProcess = spawn(shell, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: options.cwd || process.cwd(),
      env,
    });

    ptyProcess.onData((data) => {
      this.events.onData(terminalId, data);
    });

    ptyProcess.onExit((event) => {
      this.terminals.delete(terminalId);
      this.events.onExit(terminalId, event.exitCode ?? null, event.signal);
    });

    this.terminals.set(terminalId, ptyProcess);
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
  }

  private resolveDefaultShell(): string {
    if (process.platform === 'win32') {
      return process.env.COMSPEC || 'powershell.exe';
    }
    return process.env.SHELL || 'bash';
  }
}
