/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { ASSISTANT_PRESETS } from '@/common/presets/assistantPresets';
import type { IResponseMessage } from '@/common/ipcBridge';
import type { IMessageAgentStatus } from '@/common/chatLib';
import type { TChatConversation } from '@/common/storage';
import { uuid } from '@/common/utils';
import { Button, Dropdown, Menu, Tooltip, Typography } from '@arco-design/web-react';
import { History } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useSWR, { mutate } from 'swr';
import { emitter } from '../../utils/emitter';
import AcpChat from './acp/AcpChat';
import ChatLayout from './ChatLayout';
import ChatSider from './ChatSider';
import CodexChat from './codex/CodexChat';
import { iconColors } from '@/renderer/theme/colors';
import addChatIcon from '@/renderer/assets/add-chat.svg';
import CoworkLogo from '@/renderer/assets/cowork.svg';
import CollabChat from '@/renderer/pages/conversation/collab/CollabChat';
// import SkillRuleGenerator from './components/SkillRuleGenerator'; // Temporarily hidden

type CollabRole = 'pm' | 'analyst' | 'engineer';
type CollabRoleMap = Record<CollabRole, string>;

const COLLAB_ROLES: Array<{ role: CollabRole; assistantId: string; namePrefix: string }> = [
  { role: 'pm', assistantId: 'builtin-pm', namePrefix: 'PM' },
  { role: 'analyst', assistantId: 'builtin-analyst', namePrefix: 'Analyst' },
  { role: 'engineer', assistantId: 'builtin-engineer', namePrefix: 'Engineer' },
];

const _AssociatedConversation: React.FC<{ conversation_id: string }> = ({ conversation_id }) => {
  const { data } = useSWR(['getAssociateConversation', conversation_id], () => ipcBridge.conversation.getAssociateConversation.invoke({ conversation_id }));
  const navigate = useNavigate();
  const list = useMemo(() => {
    if (!data?.length) return [];
    return data.filter((conversation) => conversation.id !== conversation_id);
  }, [data]);
  if (!list.length) return null;
  return (
    <Dropdown
      droplist={
        <Menu
          onClickMenuItem={(key) => {
            Promise.resolve(navigate(`/conversation/${key}`)).catch((error) => {
              console.error('Navigation failed:', error);
            });
          }}
        >
          {list.map((conversation) => {
            return (
              <Menu.Item key={conversation.id}>
                <Typography.Ellipsis className={'max-w-300px'}>{conversation.name}</Typography.Ellipsis>
              </Menu.Item>
            );
          })}
        </Menu>
      }
      trigger={['click']}
    >
      <Button size='mini' icon={<History theme='filled' size='14' fill={iconColors.primary} strokeWidth={2} strokeLinejoin='miter' strokeLinecap='square' />}></Button>
    </Dropdown>
  );
};

const _AddNewConversation: React.FC<{ conversation: TChatConversation }> = ({ conversation }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (!conversation.extra?.workspace) return null;
  return (
    <Tooltip content={t('conversation.workspace.createNewConversation')}>
      <Button
        size='mini'
        icon={<img src={addChatIcon} alt='Add chat' className='w-14px h-14px block m-auto' />}
        onClick={() => {
          const id = uuid();
          ipcBridge.conversation.createWithConversation
            .invoke({ conversation: { ...conversation, id, createTime: Date.now(), modifyTime: Date.now() } })
            .then(() => {
              Promise.resolve(navigate(`/conversation/${id}`)).catch((error) => {
                console.error('Navigation failed:', error);
              });
              emitter.emit('chat.history.refresh');
            })
            .catch((error) => {
              console.error('Failed to create conversation:', error);
            });
        }}
      />
    </Tooltip>
  );
};

const ChatConversation: React.FC<{
  conversation?: TChatConversation;
}> = ({ conversation }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const workspaceEnabled = Boolean(conversation?.extra?.workspace);
  const [agentStatus, setAgentStatus] = useState<IMessageAgentStatus['content'] | null>(null);

  // If user navigates to a hidden collab child, redirect to parent.
  useEffect(() => {
    const parentId = (conversation?.extra as { collabParentId?: string } | undefined)?.collabParentId;
    if (!conversation?.id) return;
    if (!parentId) return;
    if (parentId === conversation.id) return;
    void Promise.resolve(navigate(`/conversation/${parentId}`, { replace: true })).catch((error) => {
      console.error('Navigation failed:', error);
    });
  }, [conversation?.extra, conversation?.id, navigate]);

  const conversationNode = useMemo(() => {
    if (!conversation) return null;
    const isCollabParent = Boolean((conversation.extra as { collab?: unknown } | undefined)?.collab);
    if (isCollabParent) {
      return <CollabChat key={conversation.id} parentConversation={conversation} />;
    }
    switch (conversation.type) {
      case 'acp':
        return <AcpChat key={conversation.id} conversation_id={conversation.id} workspace={conversation.extra?.workspace} backend={conversation.extra?.backend || 'claude'}></AcpChat>;
      case 'codex':
        return <CodexChat key={conversation.id} conversation_id={conversation.id} workspace={conversation.extra?.workspace} />;
      default:
        return null;
    }
  }, [conversation]);

  useEffect(() => {
    setAgentStatus(null);
    if (!conversation) return;

    const stream = conversation.type === 'acp' ? ipcBridge.acpConversation.responseStream : ipcBridge.codexConversation.responseStream;
    return stream.on((message: IResponseMessage) => {
      if (message.type !== 'agent_status') return;
      if (message.conversation_id !== conversation.id) return;
      setAgentStatus(message.data as IMessageAgentStatus['content']);
    });
  }, [conversation?.id, conversation?.type]);

  const enableCollab = useCallback(async (): Promise<CollabRoleMap | null> => {
    if (!conversation?.id) return null;
    if (!conversation.extra?.workspace) return null;
    const extra = conversation.extra as { collab?: unknown; collabParentId?: string };
    if (extra?.collabParentId) return null;
    if (extra?.collab) return null;

    try {
      const locale = i18n.language || 'en-US';
      const parentId = conversation.id;
      const now = Date.now();

      const ruleContents = await Promise.all(
        COLLAB_ROLES.map(async (r) => {
          try {
            const content = await ipcBridge.fs.readAssistantRule.invoke({ assistantId: r.assistantId, locale });
            return content || '';
          } catch {
            return '';
          }
        })
      );

      const created = await Promise.all(
        COLLAB_ROLES.map(async (r, idx) => {
          const childId = uuid();
          const presetContext = ruleContents[idx] || '';
          const name = `[${r.namePrefix}] ${conversation.name || t('conversation.welcome.newConversation')}`;

          const childConversation: TChatConversation =
            conversation.type === 'acp'
              ? {
                  ...conversation,
                  type: 'acp',
                  id: childId,
                  name,
                  createTime: now,
                  modifyTime: now,
                  extra: {
                    ...(conversation.extra as Extract<TChatConversation, { type: 'acp' }>['extra']),
                    presetAssistantId: r.assistantId,
                    presetContext,
                    collabParentId: parentId,
                  },
                }
              : {
                  ...conversation,
                  type: 'codex',
                  id: childId,
                  name,
                  createTime: now,
                  modifyTime: now,
                  extra: {
                    ...(conversation.extra as Extract<TChatConversation, { type: 'codex' }>['extra']),
                    presetAssistantId: r.assistantId,
                    presetContext,
                    collabParentId: parentId,
                  },
                };
          await ipcBridge.conversation.createWithConversation.invoke({ conversation: childConversation });
          return { role: r.role, id: childId };
        })
      );

      const roleMap = created.reduce((acc, item) => {
        acc[item.role] = item.id;
        return acc;
      }, {} as CollabRoleMap);

      await ipcBridge.conversation.update.invoke({
        id: parentId,
        updates: {
          extra: {
            collab: { roleMap },
          },
        } as Partial<TChatConversation>,
        mergeExtra: true,
      });

      emitter.emit('chat.history.refresh');
      await mutate(`conversation/${parentId}`);
      return roleMap;
    } catch (error) {
      console.error('Failed to enable collaboration:', error);
      return null;
    }
  }, [conversation, i18n.language, t]);

  // Auto-enable collab when requested from welcome page.
  useEffect(() => {
    if (!conversation?.id) return;
    const parentId = conversation.id;
    const flagKey = `collab_auto_enable_${parentId}`;
    const requested = sessionStorage.getItem(flagKey) === '1';
    if (!requested) return;

    const extra = conversation.extra as { collab?: unknown; collabParentId?: string } | undefined;
    if (!conversation.extra?.workspace) return;
    if (extra?.collabParentId) return;
    if (extra?.collab) {
      sessionStorage.removeItem(flagKey);
      return;
    }

    const desiredRole = ((): CollabRole => {
      const v = sessionStorage.getItem(`collab_active_role_${parentId}`);
      return v === 'pm' || v === 'analyst' || v === 'engineer' ? v : 'pm';
    })();

    void (async () => {
      const roleMap = await enableCollab();
      if (!roleMap) return;

      // Move initial message from parent to the desired child conversation so SendBox can pick it up.
      const childId = roleMap[desiredRole];
      if (conversation.type === 'acp') {
        const key = `acp_initial_message_${parentId}`;
        const value = sessionStorage.getItem(key);
        if (value) {
          sessionStorage.setItem(`acp_initial_message_${childId}`, value);
          sessionStorage.removeItem(key);
        }
      } else if (conversation.type === 'codex') {
        const key = `codex_initial_message_${parentId}`;
        const value = sessionStorage.getItem(key);
        if (value) {
          sessionStorage.setItem(`codex_initial_message_${childId}`, value);
          sessionStorage.removeItem(key);
        }
        // Defensive: clear any processed key for parent if present.
        sessionStorage.removeItem(`codex_initial_processed_${parentId}`);
      }

      sessionStorage.removeItem(flagKey);
    })();
  }, [conversation, enableCollab]);

  const headerExtra = useMemo(() => {
    if (!conversation?.id) return null;
    if (!conversation.extra?.workspace) return null;

    const extra = conversation.extra as { collab?: unknown; collabParentId?: string };
    if (extra?.collabParentId) return null; // child is hidden/redirected
    if (extra?.collab) return null; // already enabled

    return (
      <Tooltip content='Enable PM/Analyst/Engineer collaboration'>
        <Button size='mini' onClick={() => void enableCollab()}>
          Collab
        </Button>
      </Tooltip>
    );
  }, [conversation, enableCollab]);

  // 获取预设助手信息（如果有）/ Get preset assistant info for ACP/Codex conversations
  const presetAssistantInfo = useMemo(() => {
    if (!conversation) return null;

    // 优先使用 presetAssistantId，回退到 customAgentId（ACP 已有此字段）
    // Prefer presetAssistantId, fallback to customAgentId (ACP already has this field)
    const extra = conversation.extra as { presetAssistantId?: string; customAgentId?: string };
    const presetAssistantId = extra?.presetAssistantId || extra?.customAgentId;
    if (!presetAssistantId) return null;

    // presetAssistantId 格式为 'builtin-xxx'，提取 preset id
    const presetId = presetAssistantId.replace('builtin-', '');
    const preset = ASSISTANT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return null;

    const locale = i18n.language || 'en-US';
    const name = preset.nameI18n[locale] || preset.nameI18n['en-US'] || preset.id;

    const isEmoji = !preset.avatar.endsWith('.svg');
    let logo: string;
    if (isEmoji) {
      logo = preset.avatar;
    } else if (preset.id === 'cowork') {
      logo = CoworkLogo;
    } else {
      logo = '🤖';
    }

    return { name, logo, isEmoji };
  }, [conversation, i18n.language]);

  const sliderTitle = useMemo(() => {
    return (
      <div className='flex items-center justify-between'>
        <span className='text-16px font-bold text-t-primary'>{t('conversation.workspace.title')}</span>
      </div>
    );
  }, [t]);

  // 如果有预设助手信息，使用预设助手的 logo 和名称；否则使用 backend 的 logo
  // If preset assistant info exists, use preset logo/name; otherwise use backend logo
  const isCollabParent = Boolean((conversation?.extra as { collab?: unknown } | undefined)?.collab);
  const chatLayoutProps = isCollabParent
    ? {
        agentName: 'Collab',
        agentLogo: '🤝',
        agentLogoIsEmoji: true,
        headerExtra,
      }
    : presetAssistantInfo
      ? {
          agentName: presetAssistantInfo.name,
          agentLogo: presetAssistantInfo.logo,
          agentLogoIsEmoji: presetAssistantInfo.isEmoji,
          headerExtra,
        }
      : {
          backend: conversation?.type === 'acp' ? conversation?.extra?.backend : conversation?.type === 'codex' ? 'codex' : undefined,
          agentName: (conversation?.extra as { agentName?: string })?.agentName,
          headerExtra,
        };

  return (
    <ChatLayout title={conversation?.name} {...chatLayoutProps} agentStatus={agentStatus} siderTitle={sliderTitle} sider={<ChatSider conversation={conversation} />} workspaceEnabled={workspaceEnabled}>
      {conversationNode}
    </ChatLayout>
  );
};

export default ChatConversation;
