/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { mem0Service as ipcMem0Service } from '../../common/ipcBridge';
import { mem0Service } from '../services/mem0Service';

/**
 * Initialize IPC bridge handlers for Mem0 memory service
 */
export function initMem0Bridge(): void {
  // Search memories by query
  ipcMem0Service.search.provider(async (params) => {
    try {
      const result = await mem0Service.searchMemories(params.query);
      if (!result.success) {
        return { success: false, msg: result.error };
      }
      return {
        success: true,
        data: {
          memories:
            result.memories?.map((m) => ({
              id: m.id,
              memory: m.memory,
              score: m.score,
            })) || [],
        },
      };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error searching memories',
      };
    }
  });

  // Get all memories
  ipcMem0Service.getAll.provider(async () => {
    try {
      const result = await mem0Service.getAllMemories();
      if (!result.success) {
        return { success: false, msg: result.error };
      }
      return {
        success: true,
        data: {
          memories:
            result.memories?.map((m) => ({
              id: m.id,
              memory: m.memory,
              created_at: m.created_at,
            })) || [],
        },
      };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error getting memories',
      };
    }
  });

  // Add new memory
  ipcMem0Service.add.provider(async (params) => {
    try {
      const result = await mem0Service.addMemory(params.messages);
      if (!result.success) {
        return { success: false, msg: result.error };
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error adding memory',
      };
    }
  });

  // Delete memory
  ipcMem0Service.delete.provider(async (params) => {
    try {
      const result = await mem0Service.deleteMemory(params.memoryId);
      if (!result.success) {
        return { success: false, msg: result.error };
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error deleting memory',
      };
    }
  });

  // Get status
  ipcMem0Service.getStatus.provider(async () => {
    try {
      const status = await mem0Service.getStatus();
      return { success: true, data: status };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}
