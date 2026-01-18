/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TMessage } from '@/common/chatLib';
import type { TChatConversation } from '@/common/storage';
import { transformMessage } from '@/common/chatLib';
import { uuid } from '@/common/utils';
import { Select, Tag } from '@arco-design/web-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageListProvider, useAddOrUpdateMessage, useUpdateMessageList } from '@/renderer/messages/hooks';
import MessageList from '@/renderer/messages/MessageList';
import AcpSendBox from '../acp/AcpSendBox';
import type { AcpBackend } from '@/types/acpTypes';
import CodexSendBox from '../codex/CodexSendBox';
import { ConversationProvider } from '@/renderer/context/ConversationContext';
import FlexFullContainer from '@/renderer/components/FlexFullContainer';
import { useAddEventListener } from '@/renderer/utils/emitter';
import { useTranslation } from 'react-i18next';

type CollabRole = 'pm' | 'analyst' | 'engineer';

type CollabNotifyDirective = {
  to: CollabRole;
  message: string;
};

type RoleThinkingState = Record<CollabRole, boolean>;

const EMPTY_ROLE_THINKING: RoleThinkingState = {
  pm: false,
  analyst: false,
  engineer: false,
};

const COLL_NOTIFY_BLOCK_RE = /```collab_notify\s*\n([\s\S]*?)```/g;

const parseCollabNotifyBlocks = (text: string): CollabNotifyDirective[] => {
  if (!text) return [];
  const directives: CollabNotifyDirective[] = [];

  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = COLL_NOTIFY_BLOCK_RE.exec(text))) {
    const raw = match[1] || '';
    const lines = raw
      .split('\n')
      .map((l) => l.trimEnd())
      .filter((l) => l.trim().length > 0);

    let to: CollabRole | null = null;
    let message: string | null = null;
    let messageStartIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.toLowerCase().startsWith('to:')) {
        const v = line.slice('to:'.length).trim();
        if (v === 'pm' || v === 'analyst' || v === 'engineer') {
          to = v;
        }
        continue;
      }
      if (line.toLowerCase().startsWith('message:')) {
        messageStartIndex = i;
        message = line.slice('message:'.length).trim();
        break;
      }
    }

    if (messageStartIndex >= 0 && messageStartIndex + 1 < lines.length) {
      const rest = lines
        .slice(messageStartIndex + 1)
        .join('\n')
        .trim();
      if (rest) {
        message = message ? `${message}\n${rest}` : rest;
      }
    }

    if (!to || !message || !message.trim()) continue;
    directives.push({ to, message: message.trim() });
  }

  return directives;
};

type TextMessage = Extract<TMessage, { type: 'text' }>;

const findLatestAssistantTextMessage = (messages: TMessage[] | undefined): TextMessage | null => {
  if (!messages || messages.length === 0) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m) continue;
    if (m.type !== 'text') continue;
    if (m.position !== 'left') continue;
    const content = m.content.content;
    if (!content || !content.trim()) continue;
    return m;
  }
  return null;
};

const ROLE_LABEL: Record<CollabRole, string> = {
  pm: 'PM',
  analyst: 'Analyst',
  engineer: 'Engineer',
};

const ROLE_TAG_COLOR: Record<CollabRole, React.ComponentProps<typeof Tag>['color']> = {
  pm: 'orangered',
  analyst: 'purple',
  engineer: 'blue',
};

const CollabChatInner: React.FC<{ parentConversation: TChatConversation }> = ({ parentConversation }) => {
  const { t } = useTranslation();
  const updateList = useUpdateMessageList();
  const addOrUpdateMessage = useAddOrUpdateMessage();
  const roleMap = (parentConversation.extra as any)?.collab?.roleMap as { pm: string; analyst: string; engineer: string } | undefined;
  const [activeRole, setActiveRole] = useState<CollabRole>(() => {
    const v = sessionStorage.getItem(`collab_active_role_${parentConversation.id}`);
    return v === 'pm' || v === 'analyst' || v === 'engineer' ? v : 'engineer';
  });
  const [roleThinking, setRoleThinking] = useState<RoleThinkingState>(() => ({ ...EMPTY_ROLE_THINKING }));
  const notifyDedupRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    sessionStorage.setItem(`collab_active_role_${parentConversation.id}`, activeRole);
  }, [activeRole, parentConversation.id]);

  const roleByConversationId = useMemo(() => {
    if (!roleMap) return new Map<string, CollabRole>();
    return new Map<string, CollabRole>([
      [roleMap.pm, 'pm'],
      [roleMap.analyst, 'analyst'],
      [roleMap.engineer, 'engineer'],
    ]);
  }, [roleMap]);

  const updateRoleThinking = useCallback((role: CollabRole, running: boolean) => {
    setRoleThinking((prev) => (prev[role] === running ? prev : { ...prev, [role]: running }));
  }, []);

  const activeConversationId = roleMap?.[activeRole];
  const workspace = parentConversation.extra?.workspace;

  useEffect(() => {
    setRoleThinking({ ...EMPTY_ROLE_THINKING });
  }, [parentConversation.id, roleMap?.pm, roleMap?.analyst, roleMap?.engineer]);

  useAddEventListener(
    'conversation.thought.update',
    (payload) => {
      const role = roleByConversationId.get(payload.conversationId);
      if (!role) return;
      updateRoleThinking(role, payload.running);
    },
    [roleByConversationId, updateRoleThinking]
  );

  // Initial load: merge messages from all children into one list.
  useEffect(() => {
    if (!roleMap) return;
    let cancelled = false;
    void Promise.all([ipcBridge.database.getConversationMessages.invoke({ conversation_id: roleMap.pm, page: 0, pageSize: 10000 }), ipcBridge.database.getConversationMessages.invoke({ conversation_id: roleMap.analyst, page: 0, pageSize: 10000 }), ipcBridge.database.getConversationMessages.invoke({ conversation_id: roleMap.engineer, page: 0, pageSize: 10000 })])
      .then(([pm, analyst, engineer]) => {
        if (cancelled) return;
        const merged = ([] as TMessage[])
          .concat(pm || [])
          .concat(analyst || [])
          .concat(engineer || [])
          .filter(Boolean)
          .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        updateList(() => merged);
      })
      .catch((error) => {
        console.error('[CollabChat] Failed to load collab messages:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [roleMap?.pm, roleMap?.analyst, roleMap?.engineer, updateList]);

  // Live updates: listen to both streams and append messages that belong to children.
  useEffect(() => {
    if (!roleMap) return;
    const children = new Set([roleMap.pm, roleMap.analyst, roleMap.engineer]);

    const updateThinkingFromMessage = (message: { type: string; conversation_id: string }) => {
      const role = roleByConversationId.get(message.conversation_id);
      if (!role) return;
      switch (message.type) {
        case 'thought':
        case 'start':
          updateRoleThinking(role, true);
          break;
        case 'finish':
        case 'error':
          updateRoleThinking(role, false);
          break;
        default:
          break;
      }
    };

    const maybeDispatchNotify = async (sourceConversationId: string) => {
      try {
        const list = await ipcBridge.database.getConversationMessages.invoke({
          conversation_id: sourceConversationId,
          page: 0,
          pageSize: 10000,
        });
        const lastAssistantText = findLatestAssistantTextMessage(list || []);
        if (!lastAssistantText) return;
        const dispatchKey = `${sourceConversationId}:${lastAssistantText.msg_id || lastAssistantText.id}`;
        if (notifyDedupRef.current.has(dispatchKey)) return;
        notifyDedupRef.current.add(dispatchKey);

        const contentText = lastAssistantText.content?.content || '';
        const directives = parseCollabNotifyBlocks(contentText);
        if (directives.length === 0) return;

        const roleToConversationId: Record<CollabRole, string> = {
          pm: roleMap.pm,
          analyst: roleMap.analyst,
          engineer: roleMap.engineer,
        };

        await Promise.all(
          directives.map(async (d) => {
            const targetConversationId = roleToConversationId[d.to];
            if (!targetConversationId) return;
            await ipcBridge.conversation.sendMessage.invoke({
              conversation_id: targetConversationId,
              input: d.message,
              msg_id: uuid(),
              files: [],
            });
          })
        );
      } catch (error) {
        console.error('[CollabChat] Failed to dispatch collab_notify:', error);
      }
    };

    const handle = (message: { type: string; conversation_id: string; msg_id: string; data: unknown }) => {
      if (!children.has(message.conversation_id)) return;
      updateThinkingFromMessage(message);
      if (message.type === 'finish') {
        void maybeDispatchNotify(message.conversation_id);
        return;
      }
      // Active role is already handled by the active SendBox stream handler.
      if (activeConversationId && message.conversation_id === activeConversationId) return;
      const transformed = transformMessage(message as any);
      if (!transformed) return;
      addOrUpdateMessage(transformed);
    };

    const unsubAcp = ipcBridge.acpConversation.responseStream.on(handle as any);
    const unsubCodex = ipcBridge.codexConversation.responseStream.on(handle as any);
    return () => {
      unsubAcp?.();
      unsubCodex?.();
    };
  }, [activeConversationId, addOrUpdateMessage, roleMap, roleByConversationId, updateRoleThinking]);

  const messageHeader = useMemo(() => {
    return (message: TMessage) => {
      const role = roleByConversationId.get(message.conversation_id);
      if (!role) return null;
      return (
        <Tag size='small' color={ROLE_TAG_COLOR[role]} bordered>
          {ROLE_LABEL[role]}
        </Tag>
      );
    };
  }, [roleByConversationId]);

  const mentionOptions = useMemo(() => {
    const roles: CollabRole[] = ['pm', 'analyst', 'engineer'];
    return roles.map((role) => ({
      key: role,
      label: ROLE_LABEL[role],
    }));
  }, []);

  const activeThinkingRoles = useMemo(() => {
    return (['pm', 'analyst', 'engineer'] as CollabRole[]).filter((role) => roleThinking[role]);
  }, [roleThinking]);

  if (!roleMap || !activeConversationId || !workspace) {
    return (
      <div className='flex-1 flex flex-col px-20px'>
        <div className='text-t-secondary text-sm'>Collaboration is not initialized for this conversation.</div>
      </div>
    );
  }

  return (
    <ConversationProvider
      value={{
        conversationId: activeConversationId,
        workspace,
        type: parentConversation.type,
        backend: parentConversation.type === 'acp' ? ((parentConversation.extra as any)?.backend as AcpBackend) : undefined,
      }}
    >
      <div className='flex-1 min-h-0 flex flex-col px-20px'>
        <div className='flex items-center justify-between mb-10px'>
          <div className='text-sm text-t-secondary'>Merged roles</div>
          <Select size='mini' value={activeRole} onChange={(v) => setActiveRole(v as CollabRole)} style={{ width: 140 }}>
            <Select.Option value='pm'>PM</Select.Option>
            <Select.Option value='analyst'>Analyst</Select.Option>
            <Select.Option value='engineer'>Engineer</Select.Option>
          </Select>
        </div>

        <FlexFullContainer>
          <MessageList renderMessageHeader={messageHeader} />
        </FlexFullContainer>

        {activeThinkingRoles.length > 0 && (
          <div className='collab-thinking-indicator'>
            <div className='collab-thinking-indicator__title'>{t('messages.conversationInProgress')}</div>
            <div className='collab-thinking-indicator__roles'>
              {activeThinkingRoles.map((role) => (
                <div key={role} className='collab-thinking-indicator__item'>
                  <Tag size='small' color={ROLE_TAG_COLOR[role]} bordered>
                    {ROLE_LABEL[role]}
                  </Tag>
                  <span className='collab-thinking-indicator__dots' aria-hidden='true'>
                    <span className='collab-thinking-indicator__dot' />
                    <span className='collab-thinking-indicator__dot' />
                    <span className='collab-thinking-indicator__dot' />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {parentConversation.type === 'acp' ? (
          <AcpSendBox
            conversation_id={activeConversationId}
            backend={(parentConversation.extra as any)?.backend || ('claude' as AcpBackend)}
            mentionOptions={mentionOptions}
            onMentionSelect={(key) => setActiveRole(key as CollabRole)}
            optimisticUserMessage
          />
        ) : (
          <CodexSendBox conversation_id={activeConversationId} mentionOptions={mentionOptions} onMentionSelect={(key) => setActiveRole(key as CollabRole)} />
        )}
      </div>
    </ConversationProvider>
  );
};

const CollabChat: React.FC<{ parentConversation: TChatConversation }> = ({ parentConversation }) => {
  return (
    <MessageListProvider value={[]}>
      <CollabChatInner parentConversation={parentConversation} />
    </MessageListProvider>
  );
};

export default CollabChat;
