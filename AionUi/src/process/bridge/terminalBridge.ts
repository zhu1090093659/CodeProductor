/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { TerminalService } from '../services/terminalService';

const terminalService = new TerminalService({
  onData: (id, data) => {
    ipcBridge.terminal.data.emit({ id, data });
  },
  onExit: (id, exitCode, signal) => {
    ipcBridge.terminal.exit.emit({ id, exitCode, signal });
  },
});

export function initTerminalBridge(): void {
  ipcBridge.terminal.spawn.provider(async (params) => {
    try {
      const id = terminalService.spawnTerminal(params || {});
      return { success: true, data: { id } };
    } catch (error) {
      return { success: false, msg: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcBridge.terminal.write.provider(async ({ id, data }) => {
    terminalService.write(id, data);
    return { success: true };
  });

  ipcBridge.terminal.resize.provider(async ({ id, cols, rows }) => {
    terminalService.resize(id, cols, rows);
    return { success: true };
  });

  ipcBridge.terminal.dispose.provider(async ({ id }) => {
    terminalService.dispose(id);
    return { success: true };
  });
}
