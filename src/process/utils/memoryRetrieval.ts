/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { mem0Service } from '../services/mem0Service';

/**
 * Inject relevant memories into the user's message if memory retrieval is enabled
 */
export const applyMemoryRetrievalIfEnabled = async (input: string): Promise<string> => {
  if (!input?.trim()) return input;

  try {
    if (!(await mem0Service.isRetrievalEnabled())) return input;

    const result = await mem0Service.searchMemories(input);
    if (!result.success || !result.memories?.length) return input;

    const memoriesContext = result.memories.map((m, i) => `${i + 1}. ${m.memory}`).join('\n');
    return `<user_memory_context>
The following are relevant memories about the user that may help provide better assistance:
${memoriesContext}
</user_memory_context>

${input}`;
  } catch (error) {
    console.error('[MemoryRetrieval] Failed to retrieve memories:', error);
    return input;
  }
};
