/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TMessage } from '@/common/chatLib';
import React from 'react';
import TimelineIndicator, { type TimelineType } from './TimelineIndicator';

export interface TimelineWrapperProps {
  /** Message data to determine timeline type */
  message: TMessage;
  /** Message content to wrap */
  children: React.ReactNode;
  /** Is this the first message in the list */
  isFirst?: boolean;
  /** Is this the last message in the list */
  isLast?: boolean;
  /** Is this message currently active/streaming */
  isActive?: boolean;
}

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

/**
 * TimelineWrapper - Wraps message content with timeline indicator
 */
const TimelineWrapper: React.FC<TimelineWrapperProps> = ({ message, children, isFirst = false, isLast = false, isActive = false }) => {
  const timelineType = getTimelineType(message);

  return (
    <div className='timeline-message-row'>
      <TimelineIndicator type={timelineType} isFirst={isFirst} isLast={isLast} isActive={isActive} />
      <div className='timeline-message-content'>{children}</div>
    </div>
  );
};

export default TimelineWrapper;
