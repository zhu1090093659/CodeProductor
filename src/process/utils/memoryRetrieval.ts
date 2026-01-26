/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { mem0Service } from '../services/mem0Service';

/**
 * Inject relevant memories into the user's message if memory retrieval is enabled
 * @param input - The user's original message
 * @returns The message with memory context prepended (if enabled and memories found)
 */
export const applyMemoryRetrievalIfEnabled = async (input: string): Promise<string> => {
  if (!input?.trim()) return input;

  try {
    // Check if retrieval is enabled
    const isEnabled = await mem0Service.isRetrievalEnabled();
    if (!isEnabled) {
      return input;
    }

    // Search for relevant memories using the user's input as query
    const result = await mem0Service.searchMemories(input);
    if (!result.success || !result.memories || result.memories.length === 0) {
      return input;
    }

    // Format memories into context block
    const memoriesContext = result.memories.map((m, index) => `${index + 1}. ${m.memory}`).join('\n');

    // Prepend memory context to user's message
    const contextBlock = `<user_memory_context>
The following are relevant memories about the user that may help provide better assistance:
${memoriesContext}
</user_memory_context>

`;

    return contextBlock + input;
  } catch (error) {
    console.error('[MemoryRetrieval] Failed to retrieve memories:', error);
    // Return original input on error to avoid breaking the conversation
    return input;
  }
};
