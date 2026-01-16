/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Card, Tag } from '@arco-design/web-react';
import type { ReactNode } from 'react';
import { Down, Up } from '@icon-park/react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const StatusTag: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useTranslation();

  const getTagProps = () => {
    switch (status) {
      case 'pending':
        return { color: 'blue', text: t('tools.status.pending') };
      case 'executing':
        return { color: 'orange', text: t('tools.status.executing') };
      case 'success':
        return { color: 'green', text: t('tools.status.success') };
      case 'error':
        return { color: 'red', text: t('tools.status.error') };
      case 'canceled':
        return { color: 'gray', text: t('tools.status.canceled') };
      default:
        return { color: 'gray', text: status };
    }
  };

  const { color, text } = getTagProps();
  return <Tag color={color}>{text}</Tag>;
};

interface BaseToolCallDisplayProps {
  toolCallId: string;
  title: string;
  status: string;
  description?: string | ReactNode;
  icon: string;
  additionalTags?: ReactNode; // 额外的标签，如 exit code、duration 等
  children?: ReactNode; // 特定工具的详细信息内容
}

const BaseToolCallDisplay: React.FC<BaseToolCallDisplayProps> = ({ toolCallId, title, status, description, icon, additionalTags, children }) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(true);

  const hasDetails = useMemo(() => {
    return Boolean(description) || Boolean(children) || Boolean(toolCallId);
  }, [children, description, toolCallId]);

  return (
    <Card className='w-full mb-2' size='small' bordered>
      <div className='flex items-start gap-3'>
        <div className='flex-1 min-w-0'>
          <div className='flex items-center justify-between gap-12px mb-2'>
            <div className='flex items-center gap-2 min-w-0'>
              <span className='text-lg shrink-0'>{icon}</span>
              <span className='font-medium text-t-primary truncate'>{title}</span>
              <StatusTag status={status} />
              {additionalTags}
            </div>
            {hasDetails && (
              <button
                type='button'
                className='flex items-center gap-4px text-xs text-t-secondary hover:text-t-primary transition-colors border-none bg-transparent cursor-pointer shrink-0'
                onClick={() => setIsCollapsed((prev) => !prev)}
              >
                <span>{isCollapsed ? t('common.expandMore') : t('common.collapse')}</span>
                {isCollapsed ? <Down theme='outline' size={14} fill='currentColor' /> : <Up theme='outline' size={14} fill='currentColor' />}
              </button>
            )}
          </div>

          {!isCollapsed && (
            <>
              {description && <div className='text-sm text-t-secondary mb-2 overflow-hidden'>{description}</div>}

              {/* Specific tool details */}
              {children}

              <div className='text-xs text-t-secondary mt-2'>Tool Call ID: {toolCallId}</div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};

export default BaseToolCallDisplay;
