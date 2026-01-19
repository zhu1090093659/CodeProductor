/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { CodexToolCallUpdate, TMessage } from '@/common/chatLib';
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
import { useMessageList } from './hooks';
import MessageTips from './MessageTips';
import MessageToolCall from './MessageToolCall';
import MessageToolGroup from './MessageToolGroup';
import MessageText from './MessagetText';

type TurnDiffContent = Extract<CodexToolCallUpdate, { subtype: 'turn_diff' }>;

// 图片预览上下文 Image preview context
export const ImagePreviewContext = createContext<{ inPreviewGroup: boolean }>({ inPreviewGroup: false });

const MessageList: React.FC<{
  className?: string;
  /** Optional per-message header renderer (e.g., role tags in merged collab view). */
  renderMessageHeader?: (message: TMessage) => React.ReactNode;
  /** Optional wrapper for the message body (below the header). Used for custom styling like bubbles. */
  renderMessageBodyWrapper?: (message: TMessage, children: React.ReactNode) => React.ReactNode;
}> = ({ renderMessageHeader, renderMessageBodyWrapper }) => {
  const list = useMessageList();
  const conversation = useConversationContextSafe();
  const conversationId = conversation?.conversationId;
  const ref = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [toolBatchOpenMap, setToolBatchOpenMap] = useState<Record<string, boolean>>({});
  const [thought, setThought] = useState<ThoughtData>({ subject: '', description: '' });
  const [thoughtRunning, setThoughtRunning] = useState(false);
  const previousListLengthRef = useRef(list.length);
  const { t } = useTranslation();
  const shouldShowThought = thoughtRunning || Boolean(thought?.subject) || Boolean(thought?.description);

  const thoughtNode = useMemo(() => {
    if (!conversationId) return null;
    if (!shouldShowThought) return null;
    return (
      <div key='thought-display' className='w-full message-item px-8px m-t-10px max-w-full md:max-w-780px mx-auto'>
        <div className='w-full min-w-0'>
          <ThoughtDisplay
            thought={thought}
            running={thoughtRunning}
            style='compact'
            onStop={() => {
              return ipcBridge.conversation.stop.invoke({ conversation_id: conversationId }).then(() => {});
            }}
          />
        </div>
      </div>
    );
  }, [conversationId, shouldShowThought, thought, thoughtRunning]);

  const thoughtInsertBeforeId = useMemo((): string | null => {
    if (!shouldShowThought) return null;

    // Find the last user message (position === 'right')
    let lastUserMessageIndex = -1;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i].position === 'right') {
        lastUserMessageIndex = i;
        break;
      }
    }

    // Find the first AI text message AFTER the last user message
    // This ensures thinking box appears before the response to the current question
    for (let i = lastUserMessageIndex + 1; i < list.length; i += 1) {
      const message = list[i];
      if (message.position === 'left' && message.type === 'text') {
        return message.id;
      }
    }

    // No AI text message after the last user message, append at end
    return null;
  }, [list, shouldShowThought]);

  const renderMessageWrapper = (message: TMessage, body: React.ReactNode) => {
    return (
      <div
        className={classNames('flex items-start message-item [&>div]:max-w-full px-8px m-t-10px max-w-full md:max-w-780px mx-auto', message.type, {
          'justify-center': message.position === 'center',
          'justify-end': message.position === 'right',
          'justify-start': message.position === 'left',
        })}
      >
        {body}
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
    let thoughtInserted = false;

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
        <div key={`tool-batch-${batchKey}`} className={classNames('flex items-start message-item [&>div]:max-w-full px-8px m-t-10px max-w-full md:max-w-780px mx-auto', 'tool_batch')}>
          <div className='w-full min-w-0 border border-[var(--bg-3)] rounded-10px bg-1'>
            <div className='flex items-center justify-between px-10px py-8px border-b border-[var(--bg-3)]'>
              <div className='flex items-center gap-8px min-w-0'>
                {headerNode ? <span className='shrink-0'>{headerNode}</span> : null}
                <span className='text-sm text-t-primary'>🔧</span>
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
      );
    };

    let i = 0;
    while (i < list.length) {
      const message = list[i];
      if (!thoughtInserted && thoughtNode && thoughtInsertBeforeId && message.id === thoughtInsertBeforeId) {
        nodes.push(thoughtNode);
        thoughtInserted = true;
      }

      // Hide agent status messages in the message stream (status is shown in header instead).
      if (message.type === 'agent_status') {
        i += 1;
        continue;
      }

      // Keep existing turn_diff summary behavior.
      if (isTurnDiffMessage(message)) {
        if (i === firstTurnDiffIndex && turnDiffMessages.length > 0) {
          nodes.push(
            <div key={`file-changes-${message.id}`} className='w-full message-item px-8px m-t-10px max-w-full md:max-w-780px mx-auto'>
              <MessageFileChanges turnDiffChanges={turnDiffMessages} />
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
        while (j < list.length) {
          const m = list[j];
          if (isTurnDiffMessage(m)) break;
          if (!isToolMessage(m)) break;
          batch.push(m);
          j += 1;
        }
        nodes.push(renderToolBatch(batch));
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
      nodes.push(<React.Fragment key={message.id}>{renderMessageWrapper(message, body)}</React.Fragment>);
      i += 1;
    }

    if (!thoughtInserted && thoughtNode) {
      nodes.push(thoughtNode);
    }

    return nodes;
  }, [firstTurnDiffIndex, isToolMessage, isTurnDiffMessage, list, renderMessageCore, renderMessageHeader, t, thoughtInsertBeforeId, thoughtNode, toolBatchOpenMap, turnDiffMessages]);

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
      setThought(payload.thought);
      setThoughtRunning(payload.running);
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
  }, [isUserScrolling, thoughtRunning, thought.description]);

  return (
    <div className='relative flex-1 h-full'>
      <div className='flex-1 overflow-y-auto overflow-x-hidden h-full pb-10px box-border' ref={ref} onScroll={handleScroll}>
        {/* 使用 PreviewGroup 包裹所有消息，实现跨消息预览图片 Use PreviewGroup to wrap all messages for cross-message image preview */}
        <Image.PreviewGroup actionsLayout={['zoomIn', 'zoomOut', 'originalSize', 'rotateLeft', 'rotateRight']}>
          <ImagePreviewContext.Provider value={{ inPreviewGroup: true }}>{renderListNodes}</ImagePreviewContext.Provider>
        </Image.PreviewGroup>
      </div>
      {showScrollButton && (
        <>
          {/* 渐变遮罩 Gradient mask */}
          <div className='absolute bottom-0 left-0 right-0 h-100px pointer-events-none' />
          {/* 滚动按钮 Scroll button */}
          <div className='absolute bottom-20px left-50% transform -translate-x-50% z-100'>
            <div className='flex items-center justify-center w-40px h-40px rd-full bg-base shadow-lg cursor-pointer hover:bg-1 transition-all hover:scale-110 border-solid border-3' onClick={handleScrollButtonClick} title={t('messages.scrollToBottom')} style={{ lineHeight: 0 }}>
              <Down theme='filled' size='20' fill={iconColors.secondary} style={{ display: 'block' }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MessageList;
