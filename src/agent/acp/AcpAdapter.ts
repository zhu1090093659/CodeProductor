/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMessageAcpToolCall, IMessageText, TMessage } from '@/common/chatLib';
import { uuid } from '@/common/utils';
import type { AcpBackend, AcpSessionUpdate, AgentMessageChunkUpdate, AgentThoughtChunkUpdate, PlanUpdate, ToolCallUpdate, ToolCallUpdateStatus } from '@/types/acpTypes';

/**
 * Adapter class to convert ACP messages to CodeConductor message format
 */
export class AcpAdapter {
  private conversationId: string;
  private backend: AcpBackend;
  private activeToolCalls: Map<string, IMessageAcpToolCall> = new Map();
  private currentMessageId: string | null = uuid(); // Track current message for streaming chunks
  private suppressedMsgId: string | null = null;
  private currentThought: string = '';

  constructor(conversationId: string, backend: AcpBackend) {
    this.conversationId = conversationId;
    this.backend = backend;
  }

  private shouldSuppressAvailableCommands(content: string): boolean {
    const trimmed = content.trimStart();
    if (!trimmed.startsWith('Available Commands')) return false;
    // Heuristic: "Available Commands" header followed by bullet list items.
    const lines = trimmed.split('\n');
    const bulletLines = lines.slice(1).filter((line) => /^\s*[-*•]\s+\S+/.test(line));
    return bulletLines.length >= 1;
  }

  /**
   * Reset message tracking for new message
   * Should be called when a new AI response starts
   */
  resetMessageTracking() {
    this.currentMessageId = uuid();
    this.suppressedMsgId = null;
  }

  resetThoughtTracking() {
    this.currentThought = '';
  }

  /**
   * Get current message ID for streaming chunks
   */
  private getCurrentMessageId(): string {
    if (!this.currentMessageId) {
      this.currentMessageId = uuid();
    }
    return this.currentMessageId;
  }

  /**
   * Convert ACP session update to CodeConductor messages
   */
  convertSessionUpdate(sessionUpdate: AcpSessionUpdate): TMessage[] {
    const messages: TMessage[] = [];
    const update = sessionUpdate.update;

    switch (update.sessionUpdate) {
      case 'agent_message_chunk': {
        const message = this.convertSessionUpdateChunk(update);
        if (message) messages.push(message);
        break;
      }

      case 'agent_thought_chunk': {
        // Thought content is handled via ThoughtDisplay component through the 'thought' event.
        // Do NOT add to message list to avoid duplicate rendering.
        this.convertThoughtChunk(update); // Still call to update internal thought state
        // Reset message tracking for next agent_message_chunk
        this.resetMessageTracking();
        break;
      }

      case 'tool_call': {
        const toolCallMessage = this.createOrUpdateAcpToolCall(sessionUpdate as ToolCallUpdate);
        if (toolCallMessage) {
          messages.push(toolCallMessage);
        }
        // Reset message tracking so next agent_message_chunk gets new msg_id
        this.resetMessageTracking();
        break;
      }

      case 'tool_call_update': {
        const toolCallUpdateMessage = this.updateAcpToolCall(sessionUpdate as ToolCallUpdateStatus);
        if (toolCallUpdateMessage) {
          messages.push(toolCallUpdateMessage);
        }
        // Reset message tracking so next agent_message_chunk gets new msg_id
        this.resetMessageTracking();
        break;
      }

      case 'plan': {
        const planMessage = this.convertPlanUpdate(sessionUpdate as PlanUpdate);
        if (planMessage) {
          messages.push(planMessage);
        }
        // Reset message tracking so next agent_message_chunk gets new msg_id
        this.resetMessageTracking();
        break;
      }

      case 'available_commands_update': {
        // Ignore available commands update to avoid showing meta/debug info in chat stream.
        break;
      }

      default: {
        // Handle unexpected session update types
        const unknownUpdate = update as { sessionUpdate?: string };
        console.warn('Unknown session update type:', unknownUpdate.sessionUpdate);
        break;
      }
    }

    return messages;
  }

  /**
   * Convert ACP session update chunk to CodeConductor message
   */
  private convertSessionUpdateChunk(update: AgentMessageChunkUpdate['update']): TMessage | null {
    const msgId = this.getCurrentMessageId(); // Use consistent msg_id for streaming chunks
    if (this.suppressedMsgId === msgId) {
      return null;
    }
    const baseMessage = {
      id: uuid(), // Each chunk still gets unique id (for deduplication in composeMessage)
      msg_id: msgId, // But shares msg_id to enable accumulation
      conversation_id: this.conversationId,
      createdAt: Date.now(),
      position: 'left' as const,
    };

    if (update.content && update.content.text) {
      const parsed = this.parseJsonContentBlocks(update.content.text);
      if (parsed?.kind === 'thought') {
        // Thought content from JSON blocks - update internal state but don't add to message list
        // (ThoughtDisplay component handles thought display via events)
        this.createThoughtMessage(parsed.text);
        return null;
      }
      const messageText = parsed?.text ?? update.content.text;
      if (this.shouldSuppressAvailableCommands(messageText)) {
        // Suppress the whole streaming message to avoid partial leftovers across chunks.
        this.suppressedMsgId = msgId;
        return null;
      }
      return {
        ...baseMessage,
        type: 'text',
        content: {
          content: messageText,
        },
      } as IMessageText;
    }

    return null;
  }

  /**
   * Convert ACP thought chunk to CodeConductor message
   */
  private convertThoughtChunk(update: AgentThoughtChunkUpdate['update']): TMessage | null {
    if (!update.content?.text) {
      return null;
    }
    return this.createThoughtMessage(update.content.text);
  }

  private createThoughtMessage(content: string): TMessage | null {
    if (!content) return null;
    const baseMessage = {
      id: uuid(),
      conversation_id: this.conversationId,
      createdAt: Date.now(),
      position: 'center' as const,
    };
    const mergedThought = this.mergeThoughtChunk(content);
    return {
      ...baseMessage,
      type: 'tips',
      content: {
        content: mergedThought,
        type: 'warning',
      },
    };
  }

  private mergeThoughtChunk(chunk: string): string {
    if (!chunk) {
      return this.currentThought;
    }
    if (!this.currentThought) {
      this.currentThought = chunk;
      return this.currentThought;
    }
    if (chunk.startsWith(this.currentThought)) {
      this.currentThought = chunk;
      return this.currentThought;
    }
    if (this.currentThought.endsWith(chunk)) {
      return this.currentThought;
    }
    this.currentThought += chunk;
    return this.currentThought;
  }

  private parseJsonContentBlocks(raw: string): { text: string; kind: 'thought' | 'text' } | null {
    const trimmed = raw.trim();
    if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
      return null;
    }

    const blocks = this.collectJsonBlocks(trimmed);
    if (!blocks.length) {
      return null;
    }

    let text = '';
    let hasExplicitKind = false;
    let sawThoughtKind = false;
    let sawTextKind = false;
    let contentOnlyBlocks = true;

    for (const block of blocks) {
      const blockText = this.extractBlockText(block);
      if (blockText) {
        text += blockText;
      }
      if (!this.isContentOnlyBlock(block)) {
        contentOnlyBlocks = false;
      }
      const kind = this.extractBlockKind(block);
      if (kind) {
        hasExplicitKind = true;
        if (kind === 'thought') {
          sawThoughtKind = true;
        }
        if (kind === 'text') {
          sawTextKind = true;
        }
      }
    }

    if (!text) {
      return null;
    }

    let kind: 'thought' | 'text' = 'text';
    if (sawThoughtKind && !sawTextKind) {
      kind = 'thought';
    } else if (sawTextKind && !sawThoughtKind) {
      kind = 'text';
    } else if (!hasExplicitKind && this.backend === 'claude' && contentOnlyBlocks) {
      // Claude ACP sometimes streams JSON content blocks for thinking; default to thought.
      kind = 'thought';
    }

    return { text, kind };
  }

  private collectJsonBlocks(raw: string): Array<Record<string, unknown>> {
    const parsed = this.tryParseJson(raw);
    if (parsed) {
      return this.normalizeJsonBlocks(parsed);
    }

    const segments = this.splitJsonObjects(raw);
    const blocks: Array<Record<string, unknown>> = [];
    for (const segment of segments) {
      const parsedSegment = this.tryParseJson(segment);
      if (!parsedSegment) continue;
      blocks.push(...this.normalizeJsonBlocks(parsedSegment));
    }
    return blocks;
  }

  private tryParseJson(value: string): unknown | null {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  private normalizeJsonBlocks(parsed: unknown): Array<Record<string, unknown>> {
    if (!parsed) return [];
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>>;
    }
    if (typeof parsed === 'object') {
      return [parsed as Record<string, unknown>];
    }
    return [];
  }

  private splitJsonObjects(raw: string): string[] {
    const segments: string[] = [];
    let depth = 0;
    let inString = false;
    let escape = false;
    let startIndex = -1;

    for (let i = 0; i < raw.length; i += 1) {
      const char = raw[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        if (inString) {
          escape = true;
        }
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (char === '{') {
        if (depth === 0) {
          startIndex = i;
        }
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0 && startIndex >= 0) {
          segments.push(raw.slice(startIndex, i + 1));
          startIndex = -1;
        }
      }
    }

    return segments;
  }

  private extractBlockText(block: Record<string, unknown>): string {
    const directText = this.extractTextValue(block);
    if (directText) return directText;

    const content = block.content;
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content.map((item) => (item && typeof item === 'object' ? this.extractTextValue(item as Record<string, unknown>) : '')).join('');
    }
    if (content && typeof content === 'object') {
      return this.extractTextValue(content as Record<string, unknown>);
    }
    return '';
  }

  private isContentOnlyBlock(block: Record<string, unknown>): boolean {
    if (typeof block.content !== 'string') return false;
    const allowedKeys = new Set(['content', 'type', 'index', 'role', 'kind']);
    return Object.keys(block).every((key) => allowedKeys.has(key));
  }

  private extractTextValue(obj: Record<string, unknown>): string {
    if (typeof obj.content === 'string') return obj.content;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.delta === 'string') return obj.delta;
    if (typeof (obj as { thinking?: unknown }).thinking === 'string') return (obj as { thinking: string }).thinking;
    return '';
  }

  private extractBlockKind(block: Record<string, unknown>): 'thought' | 'text' | null {
    const marker = this.extractKindMarker(block);
    if (!marker) return null;
    const normalized = marker.toLowerCase();
    if (normalized.includes('thought') || normalized.includes('thinking') || normalized.includes('analysis') || normalized.includes('reason')) {
      return 'thought';
    }
    if (normalized.includes('text') || normalized.includes('final') || normalized.includes('message')) {
      return 'text';
    }
    return null;
  }

  private extractKindMarker(block: Record<string, unknown>): string | null {
    if (typeof block.type === 'string') return block.type;
    if (typeof block.role === 'string') return block.role;
    if (typeof block.kind === 'string') return block.kind;
    if (typeof (block as { status?: unknown }).status === 'string') return (block as { status: string }).status;
    return null;
  }

  private createOrUpdateAcpToolCall(update: ToolCallUpdate): IMessageAcpToolCall | null {
    const toolCallId = update.update.toolCallId;

    // 使用 toolCallId 作为 msg_id，确保同一个工具调用的消息可以被合并
    const baseMessage = {
      id: uuid(),
      msg_id: toolCallId, // 关键：使用 toolCallId 作为 msg_id
      conversation_id: this.conversationId,
      createdAt: Date.now(),
      position: 'left' as const,
    };

    const acpToolCallMessage: IMessageAcpToolCall = {
      ...baseMessage,
      type: 'acp_tool_call',
      content: update, // 直接使用 ToolCallUpdate 作为 content
    };

    this.activeToolCalls.set(toolCallId, acpToolCallMessage);
    return acpToolCallMessage;
  }

  /**
   * Update existing ACP tool call message
   * Returns the updated message with the same msg_id so composeMessage can merge it
   */
  private updateAcpToolCall(update: ToolCallUpdateStatus): IMessageAcpToolCall | null {
    const toolCallData = update.update;
    const toolCallId = toolCallData.toolCallId;

    // Get existing message
    const existingMessage = this.activeToolCalls.get(toolCallId);
    if (!existingMessage) {
      console.warn(`No existing tool call found for ID: ${toolCallId}`);
      return null;
    }

    // Update the ToolCallUpdate content with new status and content
    const updatedContent: ToolCallUpdate = {
      ...existingMessage.content,
      update: {
        ...existingMessage.content.update,
        status: toolCallData.status,
        content: toolCallData.content || existingMessage.content.update.content,
      },
    };

    // Create updated message with the SAME msg_id so composeMessage will merge it
    const updatedMessage: IMessageAcpToolCall = {
      ...existingMessage,
      msg_id: toolCallId, // 确保 msg_id 一致，这样 composeMessage 会合并消息
      content: updatedContent,
      createdAt: Date.now(), // 更新时间戳
    };

    // Update stored message
    this.activeToolCalls.set(toolCallId, updatedMessage);

    // Clean up completed/failed tool calls after a delay to prevent memory leaks
    if (toolCallData.status === 'completed' || toolCallData.status === 'failed') {
      setTimeout(() => {
        this.activeToolCalls.delete(toolCallId);
      }, 60000); // Clean up after 1 minute
    }

    // Return the updated message with same msg_id - composeMessage will merge it with existing
    return updatedMessage;
  }

  /**
   * Convert plan update to CodeConductor message
   */
  private convertPlanUpdate(update: PlanUpdate): TMessage | null {
    const baseMessage = {
      id: uuid(),
      msg_id: uuid(), // 生成独立的 msg_id，避免与其他消息合并
      conversation_id: this.conversationId,
      createdAt: Date.now(),
      position: 'left' as const,
    };

    const planData = update.update;
    if (planData.entries && planData.entries.length > 0) {
      const planContent = planData.entries
        .map((entry) => {
          const statusIcon = entry.status === 'completed' ? '✅' : entry.status === 'in_progress' ? '🔄' : '⏳';
          const priority = entry.priority ? ` [${entry.priority.toUpperCase()}]` : '';
          return `${statusIcon} ${entry.content}${priority}`;
        })
        .join('\n');

      return {
        ...baseMessage,
        type: 'text',
        content: {
          content: `📋 **Plan Update**\n\n${planContent}`,
        },
      } as IMessageText;
    }

    return null;
  }
}
