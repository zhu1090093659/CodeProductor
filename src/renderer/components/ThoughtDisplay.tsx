/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tag, Spin } from '@arco-design/web-react';
import { Down, Up } from '@icon-park/react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useThemeContext } from '@/renderer/context/ThemeContext';
import { useTranslation } from 'react-i18next';

export interface ThoughtData {
  subject: string;
  description: string;
}

interface ThoughtDisplayProps {
  thought: ThoughtData;
  style?: 'default' | 'compact';
  running?: boolean;
  onStop?: () => void;
}

// 背景渐变常量 Background gradient constants
const GRADIENT_DARK = 'linear-gradient(135deg, #464767 0%, #323232 100%)';
const GRADIENT_LIGHT = 'linear-gradient(90deg, #F0F3FF 0%, #F2F2F2 100%)';

// 格式化时间 Format elapsed time
const formatElapsedTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

const ThoughtDisplay: React.FC<ThoughtDisplayProps> = ({ thought, style = 'default', running = false, onStop }) => {
  const { theme } = useThemeContext();
  const { t } = useTranslation();
  const [elapsedTime, setElapsedTime] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const [isExpanded, setIsExpanded] = useState(false);
  const prevRunningRef = useRef(false);

  // 计时器 Timer for elapsed time
  useEffect(() => {
    if (!running && !thought?.subject) {
      setElapsedTime(0);
      return;
    }

    // 开始新的计时
    startTimeRef.current = Date.now();
    setElapsedTime(0);

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(timer);
  }, [running, thought?.subject]);

  // Auto expand while running, auto collapse when finished (once).
  useEffect(() => {
    if (running) {
      setIsExpanded(true);
    } else if (prevRunningRef.current && !running) {
      setIsExpanded(false);
    }
    prevRunningRef.current = running;
  }, [running]);

  // 处理 ESC 键取消 Handle ESC key to cancel
  useEffect(() => {
    if (!running || !onStop) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onStop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [running, onStop]);

  // 根据主题和样式计算最终样式 Calculate final style based on theme and style prop
  const containerStyle = useMemo(() => {
    const background = theme === 'dark' ? GRADIENT_DARK : GRADIENT_LIGHT;

    if (style === 'compact') {
      return {
        background,
        marginBottom: '8px',
        border: '1px solid var(--bg-3)',
      };
    }

    return {
      background,
      transform: 'translateY(36px)',
    };
  }, [theme, style]);

  const subject = thought?.subject || 'Thinking';
  const description = thought?.description || '';
  const headerText = description || t('conversation.chat.processing');

  const show = running || Boolean(thought?.subject) || Boolean(description);
  if (!show) {
    return null;
  }

  return (
    <div className='rd-12px overflow-hidden' style={containerStyle}>
      <div className='px-10px py-8px text-14px lh-20px text-t-primary flex items-center justify-between gap-8px'>
        <div className='flex items-center gap-8px min-w-0'>
          {running && <Spin size={14} />}
          <Tag color='arcoblue' size='small'>
            {subject}
          </Tag>
          {!isExpanded && <span className='text-t-secondary truncate'>{headerText}</span>}
        </div>
        <div className='flex items-center gap-8px shrink-0'>
          {running && (
            <span className='text-t-tertiary text-12px whitespace-nowrap'>
              ({t('common.escToCancel')}, {formatElapsedTime(elapsedTime)})
            </span>
          )}
          <button type='button' className='flex items-center gap-4px text-xs text-t-secondary hover:text-t-primary transition-colors border-none bg-transparent cursor-pointer' onClick={() => setIsExpanded((v) => !v)}>
            <span>{isExpanded ? t('common.collapse') : t('common.expandMore')}</span>
            {isExpanded ? <Up theme='outline' size={14} fill='currentColor' /> : <Down theme='outline' size={14} fill='currentColor' />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className='px-10px pb-10px'>
          <div className='bg-1/40 rounded-8px p-10px max-h-260px overflow-y-auto'>
            <div className='text-t-primary whitespace-pre-wrap break-words'>{description || t('codex.thinking.analyzing', { defaultValue: 'Thinking…' })}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThoughtDisplay;
