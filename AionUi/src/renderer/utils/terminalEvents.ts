/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export const TERMINAL_RUN_EVENT = 'terminal.run';

export interface TerminalRunDetail {
  workspace: string;
  command: string;
}

export const dispatchTerminalRunEvent = (detail: TerminalRunDetail) => {
  window.dispatchEvent(new CustomEvent<TerminalRunDetail>(TERMINAL_RUN_EVENT, { detail }));
};
