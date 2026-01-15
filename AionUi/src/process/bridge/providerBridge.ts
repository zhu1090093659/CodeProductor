/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { CliProviderApplyPayload } from '@/common/types/provider';
import { applyCliProvider } from '../services/providerService';

export function initProviderBridge(): void {
  ipcBridge.provider.apply.provider(async (payload: CliProviderApplyPayload) => {
    try {
      await applyCliProvider(payload);
      return { success: true };
    } catch (error) {
      return { success: false, msg: error instanceof Error ? error.message : String(error) };
    }
  });
}
