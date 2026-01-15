/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { syncSkillRepos } from '../services/skillRepoService';

export function initSkillsBridge(): void {
  ipcBridge.skills.syncRepos.provider(async ({ repos }) => {
    try {
      const result = await syncSkillRepos(repos || []);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, msg: error instanceof Error ? error.message : String(error) };
    }
  });
}
