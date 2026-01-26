/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { mem0Service } from '../services/mem0Service';
import { getDatabase } from '../database';

/**
 * Add memory from conversation after it ends
 * Mem0 will use LLM to intelligently extract valuable information
 */
export const addMemoryFromConversationIfEnabled = async (conversationId: string): Promise<void> => {
  try {
    if (!(await mem0Service.isAutoAddEnabled())) return;

    const { data } = getDatabase().getConversationMessages(conversationId, 0, 50);
    if (!data?.length) return;

    const messages = data
      .filter((m) => m.type === 'text' && m.content?.content)
      .map((m) => ({
        role: (m.position === 'right' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content.content as string,
      }));

    if (messages.length < 2) return;

    const result = await mem0Service.addMemory(messages);
    if (!result.success) {
      console.warn('[MemoryStorage] Failed to add memory:', result.error);
    }
  } catch (error) {
    console.error('[MemoryStorage] Error:', error);
  }
};
