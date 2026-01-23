/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Spin } from '@arco-design/web-react';
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
  const prevRunningRef = useRef<boolean>(running);

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

  // Auto expand while running.
  useEffect(() => {
    if (running) {
      setIsExpanded(true);
    }
  }, [running]);

  // Auto-collapse when finished (user can expand manually if needed).
  useEffect(() => {
    const prevRunning = prevRunningRef.current;
    prevRunningRef.current = running;
    if (prevRunning && !running) {
      setIsExpanded(false);
    }
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
  const wrapperStyle = useMemo(() => {
    if (style === 'compact') {
      return {
        marginBottom: '8px',
      };
    }

    return {
      transform: 'translateY(36px)',
    };
  }, [style]);

  const frameStyle = useMemo(() => {
    const background = theme === 'dark' ? GRADIENT_DARK : GRADIENT_LIGHT;

    return {
      background,
      border: '1px solid var(--bg-3)',
    };
  }, [theme]);

  const description = thought?.description || '';
  const contentText = description || t('codex.thinking.analyzing', { defaultValue: 'Thinking…' });
  const labelText = t('codex.thinking.label', { defaultValue: 'Thinking' });

  const show = running || Boolean(thought?.subject) || Boolean(description);
  if (!show) {
    return null;
  }

  return (
    <div className='relative w-full' style={wrapperStyle}>
      <span
        className='absolute flex items-center'
        style={{
          top: '-10px',
          left: '12px',
          zIndex: 1,
          padding: '2px 8px',
          borderRadius: '999px',
          border: '1px solid var(--bg-3)',
          background: 'var(--bg-base)',
          fontSize: '10px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
        }}
      >
        {labelText}
      </span>
      <div
        className='absolute flex items-center gap-6px'
        style={{
          top: '-12px',
          right: '10px',
          zIndex: 1,
          padding: '2px 6px',
          borderRadius: '999px',
          border: '1px solid var(--bg-3)',
          background: 'var(--bg-base)',
        }}
      >
        {running && <Spin size={12} />}
        {running && (
          <span className='text-t-tertiary text-12px whitespace-nowrap'>
            {t('common.escToCancel')}, {formatElapsedTime(elapsedTime)}
          </span>
        )}
        <button type='button' aria-label={isExpanded ? t('common.collapse') : t('common.expandMore')} title={isExpanded ? t('common.collapse') : t('common.expandMore')} className='flex items-center text-t-secondary hover:text-t-primary transition-colors border-none bg-transparent cursor-pointer' onClick={() => setIsExpanded((v) => !v)}>
          {isExpanded ? <Up theme='outline' size={14} fill='currentColor' /> : <Down theme='outline' size={14} fill='currentColor' />}
        </button>
      </div>
      <div className='rd-12px overflow-hidden' style={frameStyle}>
        <div className='px-10px pt-12px pb-10px'>
          {isExpanded ? (
            <div className='bg-1/40 rounded-8px p-10px max-h-260px overflow-y-auto'>
              <div className='text-t-primary whitespace-pre-wrap break-words'>{contentText}</div>
            </div>
          ) : (
            <div className='text-t-secondary text-13px truncate'>{contentText}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ThoughtDisplay;
