/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMessageAcpPermission } from '@/common/chatLib';
import { conversation } from '@/common/ipcBridge';
import { Button, Card, Radio, Typography } from '@arco-design/web-react';
import { useConversationContextSafe } from '@/renderer/context/ConversationContext';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface MessageAcpPermissionProps {
  message: IMessageAcpPermission;
}

const MessageAcpPermission: React.FC<MessageAcpPermissionProps> = React.memo(({ message }) => {
  const { options = [], toolCall } = message.content || {};
  const { t } = useTranslation();
  const conversationCtx = useConversationContextSafe();

  // 基于实际数据生成显示信息
  const getToolInfo = () => {
    if (!toolCall) {
      return {
        title: t('messages.permissionRequest'),
        description: t('messages.agentRequestingPermission'),
        icon: '🔐',
      };
    }

    // 直接使用 toolCall 中的实际数据
    const displayTitle = toolCall.title || toolCall.rawInput?.description || t('messages.permissionRequest');

    // 简单的图标映射
    const kindIcons: Record<string, string> = {
      edit: '✏️',
      read: '📖',
      fetch: '🌐',
      execute: '⚡',
    };

    return {
      title: displayTitle,
      icon: kindIcons[toolCall.kind || 'execute'] || '⚡',
    };
  };
  const { title, icon } = getToolInfo();
  const [selected, setSelected] = useState<string | null>(null);
  const [isResponding, setIsResponding] = useState(false);
  const [hasResponded, setHasResponded] = useState(false);
  const autoConfirmOnceRef = useRef(false);

  const confirmWithKey = useCallback(
    async (confirmKey: string): Promise<boolean> => {
      if (hasResponded) return false;
      if (!toolCall) return false;

      setIsResponding(true);
      try {
        const invokeData = {
          confirmKey,
          msg_id: message.id,
          conversation_id: message.conversation_id,
          callId: toolCall?.toolCallId || message.id, // 使用 toolCallId 或 message.id 作为 fallback
        };

        const result = await conversation.confirmMessage.invoke(invokeData);

        if (result.success) {
          setHasResponded(true);
          return true;
        }

        // Handle failure case - could add error display here
        console.error('Failed to confirm permission:', result);
        return false;
      } catch (error) {
        // Handle error case - could add error logging here
        console.error('Error confirming permission:', error);
        return false;
      } finally {
        setIsResponding(false);
      }
    },
    [hasResponded, message.conversation_id, message.id, toolCall]
  );

  const handleConfirm = async () => {
    if (!selected) return;
    await confirmWithKey(selected);
  };

  // Auto-approve permissions for Claude Code in workspace conversations to reduce prompt spam.
  useEffect(() => {
    if (autoConfirmOnceRef.current) return;
    if (hasResponded) return;
    if (!toolCall) return;
    if (!conversationCtx?.workspace) return;
    if (conversationCtx.type !== 'acp') return;
    if (conversationCtx.backend !== 'claude') return;

    const toolCallId = toolCall?.toolCallId || message.id;
    const respondedKey = `acp_permission_responded_${message.conversation_id}_${toolCallId}`;
    try {
      if (localStorage.getItem(respondedKey) === 'true') return;
    } catch {
      // ignore storage errors
    }

    const allowAlways = options.find((o) => o.kind === 'allow_always')?.optionId;
    const allowOnce = options.find((o) => o.kind === 'allow_once')?.optionId;
    const choice = allowAlways || allowOnce;
    if (!choice) return;

    autoConfirmOnceRef.current = true;
    setSelected(choice);
    void confirmWithKey(choice)
      .then((ok) => {
        if (!ok) {
          autoConfirmOnceRef.current = false;
          return;
        }
        try {
          localStorage.setItem(respondedKey, 'true');
        } catch {
          // ignore storage errors
        }
      });
  }, [confirmWithKey, conversationCtx?.backend, conversationCtx?.type, conversationCtx?.workspace, hasResponded, message.conversation_id, message.id, options, toolCall]);

  if (!toolCall) {
    return null;
  }

  return (
    <Card className='mb-4' bordered={false} style={{ background: 'var(--bg-1)' }}>
      <div className='space-y-4'>
        {/* Header with icon and title */}
        <div className='flex items-center space-x-2'>
          <span className='text-2xl'>{icon}</span>
          <Text className='block'>{title}</Text>
        </div>
        {(toolCall.rawInput?.command || toolCall.title) && (
          <div>
            <Text className='text-xs text-t-secondary mb-1'>{t('messages.command')}</Text>
            <code className='text-xs bg-1 p-2 rounded block text-t-primary break-all'>{toolCall.rawInput?.command || toolCall.title}</code>
          </div>
        )}
        {!hasResponded && (
          <>
            <div className='mt-10px'>{t('messages.chooseAction')}</div>
            <Radio.Group direction='vertical' size='mini' value={selected} onChange={setSelected}>
              {options && options.length > 0 ? (
                options.map((option, index) => {
                  const optionName = option?.name || `${t('messages.option')} ${index + 1}`;
                  const optionId = option?.optionId || `option_${index}`;
                  return (
                    <Radio key={optionId} value={optionId}>
                      {optionName}
                    </Radio>
                  );
                })
              ) : (
                <Text type='secondary'>{t('messages.noOptionsAvailable')}</Text>
              )}
            </Radio.Group>
            <div className='flex justify-start pl-20px'>
              <Button type='primary' size='mini' disabled={!selected || isResponding} onClick={handleConfirm}>
                {isResponding ? t('messages.processing') : t('messages.confirm')}
              </Button>
            </div>
          </>
        )}

        {hasResponded && (
          <div className='mt-10px p-2 rounded-md border' style={{ backgroundColor: 'var(--color-success-light-1)', borderColor: 'rgb(var(--success-3))' }}>
            <Text className='text-sm' style={{ color: 'rgb(var(--success-6))' }}>
              ✓ {t('messages.responseSentSuccessfully')}
            </Text>
          </div>
        )}
      </div>
    </Card>
  );
});

export default MessageAcpPermission;
