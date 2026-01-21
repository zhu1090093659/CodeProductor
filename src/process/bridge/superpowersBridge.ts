/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { SuperpowersService } from '../services/superpowersService';

export function initSuperpowersBridge(): void {
  ipcBridge.superpowers.getWorkflowContext.provider(({ mode }) => {
    return Promise.resolve(SuperpowersService.generateWorkflowContext(mode));
  });
}
