/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { TERMINAL_RUN_EVENT, type TerminalRunDetail } from '@/renderer/utils/terminalEvents';

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

const TerminalTab: React.FC<{
  workspace: string;
  active: boolean;
}> = ({ workspace, active }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const pendingCommandRef = useRef<string | null>(null);

  const ensureTerminal = async () => {
    if (terminalIdRef.current) return;
    const response = await ipcBridge.terminal.spawn.invoke({
      cwd: workspace,
      cols: DEFAULT_COLS,
      rows: DEFAULT_ROWS,
    });
    if (!response?.success || !response.data?.id) return;
    terminalIdRef.current = response.data.id;
  };

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;
    const terminal = new Terminal({
      fontSize: 12,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      cursorBlink: true,
      theme: { background: 'var(--color-bg-1)', foreground: 'var(--color-text-1)' },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    setReady(true);

    const disposable = terminal.onData((data) => {
      if (!terminalIdRef.current) return;
      void ipcBridge.terminal.write.invoke({ id: terminalIdRef.current, data });
    });

    return () => {
      if (terminalIdRef.current) {
        void ipcBridge.terminal.dispose.invoke({ id: terminalIdRef.current });
        terminalIdRef.current = null;
      }
      disposable.dispose();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !active) return;
    void ensureTerminal();
  }, [ready, active]);

  useEffect(() => {
    if (!ready || !terminalRef.current) return;
    const resizeObserver = new ResizeObserver(() => {
      if (!fitAddonRef.current || !terminalRef.current) return;
      fitAddonRef.current.fit();
      const cols = terminalRef.current.cols;
      const rows = terminalRef.current.rows;
      if (terminalIdRef.current) {
        void ipcBridge.terminal.resize.invoke({ id: terminalIdRef.current, cols, rows });
      }
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, [ready]);

  useEffect(() => {
    const unsubscribe = ipcBridge.terminal.data.on((payload) => {
      if (!terminalRef.current || payload.id !== terminalIdRef.current) return;
      terminalRef.current.write(payload.data);
    });
    const exitUnsub = ipcBridge.terminal.exit.on((payload) => {
      if (payload.id !== terminalIdRef.current) return;
      terminalIdRef.current = null;
    });
    return () => {
      unsubscribe?.();
      exitUnsub?.();
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<TerminalRunDetail>).detail;
      if (!detail || detail.workspace !== workspace) return;
      pendingCommandRef.current = detail.command;
      void ensureTerminal().then(() => {
        if (!terminalIdRef.current || !pendingCommandRef.current) return;
        const command = pendingCommandRef.current;
        pendingCommandRef.current = null;
        ipcBridge.terminal.write.invoke({ id: terminalIdRef.current, data: `${command}\r` }).catch(() => {
          // Ignore write errors
        });
      });
    };
    window.addEventListener(TERMINAL_RUN_EVENT, handler);
    return () => window.removeEventListener(TERMINAL_RUN_EVENT, handler);
  }, [workspace]);

  return <div ref={containerRef} className='h-full w-full overflow-hidden' />;
};

export default TerminalTab;
