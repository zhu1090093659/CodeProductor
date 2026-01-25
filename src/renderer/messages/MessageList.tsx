/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { CodexToolCallUpdate, IMessageThought, TMessage } from '@/common/chatLib';
import { uuid } from '@/common/utils';
import { iconColors } from '@/renderer/theme/colors';
import { Image } from '@arco-design/web-react';
import { Down, Up } from '@icon-park/react';
import ThoughtDisplay, { type ThoughtData } from '@renderer/components/ThoughtDisplay';
import { useConversationContextSafe } from '@renderer/context/ConversationContext';
import MessageAcpPermission from '@renderer/messages/acp/MessageAcpPermission';
import MessageAcpToolCall from '@renderer/messages/acp/MessageAcpToolCall';
import MessageAgentStatus from '@renderer/messages/MessageAgentStatus';
import classNames from 'classnames';
import React, { createContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAddEventListener } from '../utils/emitter';
import MessageCodexPermission from './codex/MessageCodexPermission';
import MessageCodexToolCall from './codex/MessageCodexToolCall';
import MessageFileChanges from './codex/MessageFileChanges';
import { TimelineIndicator, type TimelineType } from './components';
import { useMessageList } from './hooks';
import MessageTips from './MessageTips';
import MessageToolCall from './MessageToolCall';
import MessageToolGroup from './MessageToolGroup';
import MessageText from './MessagetText';

type TurnDiffContent = Extract<CodexToolCallUpdate, { subtype: 'turn_diff' }>;
type ThoughtEntry = { id: string; thought: ThoughtData; running: boolean; anchorId: string | null };

const PENDING_THOUGHT_ID = '__pending__';

// 图片预览上下文 Image preview context
export const ImagePreviewContext = createContext<{ inPreviewGroup: boolean }>({ inPreviewGroup: false });

const MessageList: React.FC<{
  className?: string;
  /** Optional per-message header renderer (e.g., role tags in merged collab view). */
  renderMessageHeader?: (message: TMessage) => React.ReactNode;
  /** Optional wrapper for the message body (below the header). Used for custom styling like bubbles. */
  renderMessageBodyWrapper?: (message: TMessage, children: React.ReactNode) => React.ReactNode;
}> = ({ className, renderMessageHeader, renderMessageBodyWrapper }) => {
  const list = useMessageList();
  const conversation = useConversationContextSafe();
  const conversationId = conversation?.conversationId;
  const ref = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [toolBatchOpenMap, setToolBatchOpenMap] = useState<Record<string, boolean>>({});
  const [thoughtEntries, setThoughtEntries] = useState<ThoughtEntry[]>([]);
  const previousListLengthRef = useRef(list.length);
  const listRef = useRef(list);
  const { t } = useTranslation();
  const shouldShowThought = thoughtEntries.length > 0;
  const thoughtRunning = thoughtEntries.some((entry) => entry.running);

  const renderThoughtNodes = useMemo(() => {
    if (!conversationId) return null;
    if (!shouldShowThought) return null;
    return (entries: ThoughtEntry[]) =>
      entries.map((entry) => (
        <div key={`thought-${entry.id}`} className='chat-message-row message-item px-8px m-t-12px'>
          <div className='timeline-message-row w-full'>
            <TimelineIndicator type='thinking' isFirst={false} isLast={false} isActive={entry.running} />
            <div className='timeline-message-content'>
              <ThoughtDisplay
                thought={entry.thought}
                running={entry.running}
                style='compact'
                onStop={() => {
                  return ipcBridge.conversation.stop.invoke({ conversation_id: conversationId }).then(() => {});
                }}
              />
            </div>
          </div>
        </div>
      ));
  }, [conversationId, shouldShowThought]);

  /**
   * Map message type to timeline type
   */
  const getTimelineType = (message: TMessage): TimelineType => {
    // User messages (right position)
    if (message.position === 'right') {
      return 'user';
    }

    // Permission messages
    if (message.type === 'acp_permission' || message.type === 'codex_permission') {
      return 'permission';
    }

    // Tool messages
    if (message.type === 'tool_call' || message.type === 'tool_group' || message.type === 'acp_tool_call' || message.type === 'codex_tool_call') {
      return 'tool';
    }

    // AI response messages (left position)
    if (message.position === 'left' && message.type === 'text') {
      return 'response';
    }

    // Default to response
    return 'response';
  };

  const renderMessageWrapper = (message: TMessage, body: React.ReactNode, index: number, total: number) => {
    const timelineType = getTimelineType(message);
    const isFirst = index === 0;
    const isLast = index === total - 1;
    const isActive = false; // TODO: Determine active state based on streaming

    return (
      <div
        className={classNames('chat-message-row flex items-start message-item [&>div]:max-w-full px-8px m-t-12px', message.type, {
          'justify-center': message.position === 'center',
          'justify-end': message.position === 'right',
          'justify-start': message.position === 'left',
        })}
      >
        <div className='timeline-message-row w-full'>
          <TimelineIndicator type={timelineType} isFirst={isFirst} isLast={isLast} isActive={isActive} />
          <div className='timeline-message-content'>{body}</div>
        </div>
      </div>
    );
  };

  // 提取所有 Codex turn_diff 消息用于汇总显示 / Extract all Codex turn_diff messages for summary display
  const { turnDiffMessages, firstTurnDiffIndex } = useMemo(() => {
    const turnDiffs: TurnDiffContent[] = [];
    let firstIndex = -1;

    list.forEach((message, index) => {
      // Codex turn_diff 消息 / Codex turn_diff messages
      if (message.type === 'codex_tool_call' && message.content.subtype === 'turn_diff') {
        if (firstIndex === -1) firstIndex = index;
        turnDiffs.push(message.content as TurnDiffContent);
      }
    });

    return { turnDiffMessages: turnDiffs, firstTurnDiffIndex: firstIndex };
  }, [list]);

  // 判断消息是否为 turn_diff 类型（用于跳过单独渲染）/ Check if message is turn_diff type (for skipping individual render)
  const isTurnDiffMessage = (message: TMessage) => {
    return message.type === 'codex_tool_call' && message.content.subtype === 'turn_diff';
  };

  const isToolMessage = (message: TMessage) => {
    return message.type === 'tool_call' || message.type === 'tool_group' || message.type === 'codex_tool_call' || message.type === 'acp_tool_call';
  };

  const toolGroupNeedsAttention = (message: TMessage) => {
    if (message.type !== 'tool_group') return false;
    return message.content.some((item) => item.status === 'Confirming' || Boolean(item.confirmationDetails));
  };

  const renderMessageCore = (message: TMessage) => {
    switch (message.type) {
      case 'text':
        return <MessageText message={message}></MessageText>;
      case 'tips':
        return <MessageTips message={message}></MessageTips>;
      case 'tool_call':
        return <MessageToolCall message={message}></MessageToolCall>;
      case 'tool_group':
        return <MessageToolGroup message={message}></MessageToolGroup>;
      case 'agent_status':
        return <MessageAgentStatus message={message}></MessageAgentStatus>;
      case 'acp_permission':
        return <MessageAcpPermission message={message}></MessageAcpPermission>;
      case 'acp_tool_call':
        return <MessageAcpToolCall message={message}></MessageAcpToolCall>;
      case 'codex_permission':
        return <MessageCodexPermission message={message}></MessageCodexPermission>;
      case 'codex_tool_call':
        return <MessageCodexToolCall message={message}></MessageCodexToolCall>;
      default:
        return <div>{t('messages.unknownMessageType', { type: (message as { type?: string }).type })}</div>;
    }
  };

  const renderListNodes = useMemo(() => {
    const nodes: React.ReactNode[] = [];
    const thoughtBucket = new Map<string | null, ThoughtEntry[]>();

    if (shouldShowThought) {
      // Build a set of message IDs for quick lookup
      const listIds = new Set(list.map((m) => m.id));
      // Find the last user message ID as fallback anchor
      const lastUserMsgId = list.filter((m) => m.position === 'right').pop()?.id ?? null;

      for (const entry of thoughtEntries) {
        let key = entry.anchorId ?? null;
        // If anchorId is not in the current message list, use the last user message as anchor
        // This handles the case where start event arrives before user_content event
        if (key && !listIds.has(key)) {
          key = lastUserMsgId;
        }
        const existing = thoughtBucket.get(key);
        if (existing) {
          existing.push(entry);
        } else {
          thoughtBucket.set(key, [entry]);
        }
      }
    }

    const renderToolBatch = (batch: TMessage[]) => {
      const batchKey = `${batch[0]?.id || 'unknown'}-${batch[batch.length - 1]?.id || 'unknown'}`;
      const forceOpen = batch.some((m) => toolGroupNeedsAttention(m));
      const isOpen = forceOpen || Boolean(toolBatchOpenMap[batchKey]);
      const headerNode = renderMessageHeader?.(batch[0]);

      const toggle = () => {
        if (forceOpen) return;
        setToolBatchOpenMap((prev) => ({ ...prev, [batchKey]: !isOpen }));
      };

      return (
        <div key={`tool-batch-${batchKey}`} className={classNames('chat-message-row flex items-start message-item [&>div]:max-w-full px-8px m-t-12px', 'tool_batch')}>
          <div className='timeline-message-row w-full'>
            <TimelineIndicator type='tool' isFirst={false} isLast={false} isActive={false} />
            <div className='timeline-message-content'>
              <div className='border border-[var(--bg-3)] rounded-10px bg-1'>
                <div className='flex items-center justify-between px-10px py-8px border-b border-[var(--bg-3)]'>
                  <div className='flex items-center gap-8px min-w-0'>
                    {headerNode ? <span className='shrink-0'>{headerNode}</span> : null}
                    <span className='text-sm text-t-primary truncate'>{`Tools × ${batch.length}`}</span>
                    {forceOpen && <span className='text-xs text-t-secondary'>action required</span>}
                  </div>
                  {!forceOpen && (
                    <button type='button' className='flex items-center gap-4px text-xs text-t-secondary hover:text-t-primary transition-colors border-none bg-transparent cursor-pointer' onClick={toggle}>
                      <span>{isOpen ? t('common.collapse') : t('common.expandMore')}</span>
                      {isOpen ? <Up theme='outline' size={14} fill='currentColor' /> : <Down theme='outline' size={14} fill='currentColor' />}
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div className='px-10px py-10px'>
                    <div className='flex flex-col gap-10px'>
                      {batch.map((m) => (
                        <div key={m.id} className='min-w-0'>
                          {renderMessageCore(m)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    };

    let i = 0;
    const headThoughts = thoughtBucket.get(null);
    if (headThoughts && renderThoughtNodes) {
      nodes.push(...renderThoughtNodes(headThoughts));
      thoughtBucket.delete(null);
    }
    while (i < list.length) {
      const message = list[i];

      // Hide agent status messages in the message stream (status is shown in header instead).
      if (message.type === 'agent_status') {
        i += 1;
        continue;
      }

      // Skip thought messages - they are rendered separately via thoughtEntries
      if (message.type === 'thought') {
        i += 1;
        continue;
      }

      // Keep existing turn_diff summary behavior.
      if (isTurnDiffMessage(message)) {
        if (i === firstTurnDiffIndex && turnDiffMessages.length > 0) {
          nodes.push(
            <div key={`file-changes-${message.id}`} className='chat-message-row message-item px-8px m-t-12px'>
              <div className='timeline-message-row w-full'>
                <TimelineIndicator type='tool' isFirst={false} isLast={false} isActive={false} />
                <div className='timeline-message-content'>
                  <MessageFileChanges turnDiffChanges={turnDiffMessages} />
                </div>
              </div>
            </div>
          );
        }
        i += 1;
        continue;
      }

      // Consecutive tool messages => big collapsible batch. Any non-tool message breaks.
      if (isToolMessage(message)) {
        const batch: TMessage[] = [];
        let j = i;
        let stopAtId: string | null = null;
        while (j < list.length) {
          const m = list[j];
          if (isTurnDiffMessage(m)) break;
          if (!isToolMessage(m)) break;
          batch.push(m);
          stopAtId = m.id;
          j += 1;
          if (thoughtBucket.has(stopAtId)) {
            break;
          }
        }
        nodes.push(renderToolBatch(batch));
        if (stopAtId && thoughtBucket.has(stopAtId) && renderThoughtNodes) {
          nodes.push(...renderThoughtNodes(thoughtBucket.get(stopAtId) || []));
          thoughtBucket.delete(stopAtId);
        }
        i = j;
        continue;
      }

      const headerNode = renderMessageHeader?.(message);
      const contentNode = (
        <div className='w-full min-w-0'>
          {headerNode ? <div className='mb-6px'>{headerNode}</div> : null}
          {renderMessageCore(message)}
        </div>
      );

      const body = renderMessageBodyWrapper ? renderMessageBodyWrapper(message, contentNode) : contentNode;
      // Note: For timeline, we use nodes.length as a proxy for index since we're building the list incrementally
      // This isn't perfect but works for most cases. A more accurate solution would require preprocessing.
      nodes.push(<React.Fragment key={message.id}>{renderMessageWrapper(message, body, nodes.length, list.length)}</React.Fragment>);
      if (thoughtBucket.has(message.id) && renderThoughtNodes) {
        nodes.push(...renderThoughtNodes(thoughtBucket.get(message.id) || []));
        thoughtBucket.delete(message.id);
      }
      i += 1;
    }

    if (thoughtBucket.size > 0 && renderThoughtNodes) {
      for (const entries of thoughtBucket.values()) {
        nodes.push(...renderThoughtNodes(entries));
      }
    }

    return nodes;
  }, [firstTurnDiffIndex, isToolMessage, isTurnDiffMessage, list, renderMessageCore, renderMessageHeader, renderThoughtNodes, shouldShowThought, t, thoughtEntries, toolBatchOpenMap, turnDiffMessages]);

  // 检查是否在底部（允许一定的误差范围）
  const isAtBottom = () => {
    if (!ref.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = ref.current;
    return scrollHeight - scrollTop - clientHeight < 100;
  };

  // 滚动到底部
  const scrollToBottom = (smooth = false) => {
    if (ref.current) {
      ref.current.scrollTo({
        top: ref.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  // 监听用户滚动
  const handleScroll = () => {
    if (!ref.current) return;
    const atBottom = isAtBottom();
    setShowScrollButton(!atBottom);
    setIsUserScrolling(!atBottom);
  };

  // 当消息列表更新时，智能滚动
  useEffect(() => {
    const currentListLength = list.length;
    const isNewMessage = currentListLength !== previousListLengthRef.current;

    // 更新记录的列表长度
    previousListLengthRef.current = currentListLength;

    // 检查最新消息是否是用户发送的（position === 'right'）
    const lastMessage = list[list.length - 1];
    const isUserMessage = lastMessage?.position === 'right';

    // 如果是用户发送的消息，强制滚动到底部并重置滚动状态
    if (isUserMessage && isNewMessage) {
      setIsUserScrolling(false);
      setTimeout(() => {
        scrollToBottom();
      }, 100);
      return;
    }

    // 如果用户正在查看历史消息，不自动滚动
    if (isUserScrolling) return;

    // 只在新消息添加时才自动滚动，而不是消息内容更新时
    if (isNewMessage && isAtBottom()) {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [list, isUserScrolling]);

  // 点击滚动按钮
  const handleScrollButtonClick = () => {
    scrollToBottom(true);
    setIsUserScrolling(false);
    setShowScrollButton(false);
  };

  useAddEventListener(
    'conversation.thought.update',
    (payload) => {
      if (!conversationId) return;
      if (payload.conversationId !== conversationId) return;
      const thoughtId = payload.thoughtId ?? null;
      const hasContent = Boolean(payload.thought?.subject) || Boolean(payload.thought?.description);
      // Use explicit anchorId from payload if provided, otherwise calculate from current list
      const anchorId = payload.anchorId ?? (listRef.current.length ? (listRef.current[listRef.current.length - 1]?.id ?? null) : null);

      setThoughtEntries((prev) => {
        const pendingIndex = prev.findIndex((item) => item.id === PENDING_THOUGHT_ID);

        if (thoughtId) {
          const next = prev.map((item) => (item.running ? { ...item, running: false } : item));
          const index = next.findIndex((item) => item.id === thoughtId);
          const entry = {
            id: thoughtId,
            thought: payload.thought,
            running: payload.running,
            anchorId: pendingIndex >= 0 ? next[pendingIndex].anchorId : anchorId,
          };
          if (index >= 0) {
            next[index] = { ...next[index], thought: entry.thought, running: entry.running };
            return next;
          }
          if (pendingIndex >= 0) {
            next[pendingIndex] = entry;
            return next;
          }
          next.push(entry);
          return next;
        }

        if (hasContent) {
          return prev.concat({
            id: uuid(),
            thought: payload.thought,
            running: payload.running,
            anchorId,
          });
        }

        if (payload.running) {
          const next = [];
          next.push({
            id: PENDING_THOUGHT_ID,
            thought: { subject: '', description: '' },
            running: true,
            anchorId,
          });
          return next;
        }

        if (pendingIndex >= 0) {
          const next = [...prev];
          next.splice(pendingIndex, 1);
          return next;
        }

        if (prev.length === 0) return prev;
        const next = [...prev];
        const lastIndex = next.length - 1;
        next[lastIndex] = { ...next[lastIndex], running: false };
        return next;
      });
    },
    [conversationId]
  );

  // Keep latest content visible while running (unless user is reading history).
  useEffect(() => {
    if (!thoughtRunning) return;
    if (isUserScrolling) return;
    if (!isAtBottom()) return;
    const timer = setTimeout(() => scrollToBottom(), 50);
    return () => clearTimeout(timer);
  }, [isUserScrolling, thoughtRunning, thoughtEntries]);

  // Reset thought entries when conversation changes
  useEffect(() => {
    setThoughtEntries([]);
  }, [conversationId]);

  // Restore thought entries from database on initial load
  useEffect(() => {
    if (!list || list.length === 0) return;

    // Build a map of thought messages with their anchors
    const restoredEntries: ThoughtEntry[] = [];
    let prevMessageId: string | null = null;

    // Debug: log all message types in list
    const messageTypes = list.map((m) => m.type);
    console.log('[MessageList] Restore check - message types in list:', messageTypes);

    for (const msg of list) {
      if (msg.type === 'thought') {
        const thoughtMsg = msg as IMessageThought;
        console.log('[MessageList] Found thought message:', { id: msg.id, msg_id: msg.msg_id, content: thoughtMsg.content });
        restoredEntries.push({
          id: msg.msg_id || msg.id,
          thought: thoughtMsg.content,
          running: false,
          anchorId: prevMessageId,
        });
      } else {
        // Update anchor for next thought message
        prevMessageId = msg.id;
      }
    }

    console.log('[MessageList] Restored entries count:', restoredEntries.length);
    if (restoredEntries.length === 0) return;

    // Only restore if thoughtEntries is currently empty (avoid overwriting running thoughts)
    setThoughtEntries((prev) => {
      console.log('[MessageList] Setting thoughtEntries - prev.length:', prev.length, 'restoredEntries.length:', restoredEntries.length);
      return prev.length === 0 ? restoredEntries : prev;
    });
  }, [list]);

  useEffect(() => {
    listRef.current = list;
  }, [list]);

  return (
    <div className={classNames('relative flex-1 h-full chat-message-list', className)}>
      <div className='chat-message-scroll flex-1 overflow-y-auto overflow-x-hidden h-full pb-10px box-border' ref={ref} onScroll={handleScroll}>
        {/* 使用 PreviewGroup 包裹所有消息，实现跨消息预览图片 Use PreviewGroup to wrap all messages for cross-message image preview */}
        <Image.PreviewGroup actionsLayout={['zoomIn', 'zoomOut', 'originalSize', 'rotateLeft', 'rotateRight']}>
          <ImagePreviewContext.Provider value={{ inPreviewGroup: true }}>{renderListNodes}</ImagePreviewContext.Provider>
        </Image.PreviewGroup>
      </div>
      {showScrollButton && (
        <>
          {/* 渐变遮罩 Gradient mask */}
          <div className='chat-message-list__fade absolute bottom-0 left-0 right-0 h-100px pointer-events-none' />
          {/* 滚动按钮 Scroll button */}
          <div className='chat-scroll-button absolute bottom-20px left-50% transform -translate-x-50% z-100'>
            <div className='chat-scroll-button__inner flex items-center justify-center w-40px h-40px rd-full bg-base shadow-lg cursor-pointer hover:bg-1 transition-all hover:scale-110 border-solid border-3' onClick={handleScrollButtonClick} title={t('messages.scrollToBottom')} style={{ lineHeight: 0 }}>
              <Down theme='filled' size='20' fill={iconColors.secondary} style={{ display: 'block' }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MessageList;
