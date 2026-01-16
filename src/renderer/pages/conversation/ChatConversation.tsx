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
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { emitter } from '../../utils/emitter';
import AcpChat from './acp/AcpChat';
import ChatLayout from './ChatLayout';
import ChatSider from './ChatSider';
import CodexChat from './codex/CodexChat';
import { iconColors } from '@/renderer/theme/colors';
import addChatIcon from '@/renderer/assets/add-chat.svg';
import CoworkLogo from '@/renderer/assets/cowork.svg';
// import SkillRuleGenerator from './components/SkillRuleGenerator'; // Temporarily hidden

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
  const workspaceEnabled = Boolean(conversation?.extra?.workspace);
  const [agentStatus, setAgentStatus] = useState<IMessageAgentStatus['content'] | null>(null);

  const conversationNode = useMemo(() => {
    if (!conversation) return null;
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
  const chatLayoutProps = presetAssistantInfo
    ? {
        agentName: presetAssistantInfo.name,
        agentLogo: presetAssistantInfo.logo,
        agentLogoIsEmoji: presetAssistantInfo.isEmoji,
      }
    : {
        backend: conversation?.type === 'acp' ? conversation?.extra?.backend : conversation?.type === 'codex' ? 'codex' : undefined,
        agentName: (conversation?.extra as { agentName?: string })?.agentName,
      };

  return (
    <ChatLayout
      title={conversation?.name}
      {...chatLayoutProps}
      agentStatus={agentStatus}
      siderTitle={sliderTitle}
      sider={<ChatSider conversation={conversation} />}
      workspaceEnabled={workspaceEnabled}
    >
      {conversationNode}
    </ChatLayout>
  );
};

export default ChatConversation;
