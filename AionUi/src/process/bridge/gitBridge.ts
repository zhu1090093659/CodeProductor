/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export function initGitBridge(): void {
  ipcBridge.git.diff.provider(async ({ cwd }) => {
    try {
      const rootResult = await execAsync(`git -C "${cwd}" rev-parse --show-toplevel`, { timeout: 5000 });
      const repoRoot = rootResult.stdout.trim();
      if (!repoRoot) {
        return { success: false, msg: 'Not a git repository' };
      }
      const diffResult = await execAsync(`git -C "${repoRoot}" diff`, { maxBuffer: 10 * 1024 * 1024 });
      return { success: true, data: { diff: diffResult.stdout || '' } };
    } catch (error) {
      return { success: false, msg: error instanceof Error ? error.message : String(error) };
    }
  });
}
