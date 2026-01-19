/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import EventEmitter from 'eventemitter3';
import type { DependencyList } from 'react';
import { useEffect } from 'react';
import type { FileOrFolderItem } from '@/renderer/types/files';
import type { PreviewContentType } from '@/common/types/preview';
import type { PreviewMetadata } from '@/renderer/pages/conversation/workspace/preview/context/PreviewContext';

type ThoughtData = { subject: string; description: string };

interface EventTypes {
  'acp.selected.file': [Array<string | FileOrFolderItem>];
  'acp.selected.file.append': [Array<string | FileOrFolderItem>];
  'acp.selected.file.clear': void;
  'acp.workspace.refresh': void;
  'codex.selected.file': [Array<string | FileOrFolderItem>];
  'codex.selected.file.append': [Array<string | FileOrFolderItem>];
  'codex.selected.file.clear': void;
  'codex.workspace.refresh': void;
  'chat.history.refresh': void;
  // 会话删除事件 / Conversation deletion event
  'conversation.deleted': [string]; // conversationId
  'conversation.workspace.close': [string]; // workspace path
  // Project events
  'project.updated': void;
  // 预览面板事件 / Preview panel events
  'preview.open': [{ content: string; contentType: PreviewContentType; metadata?: { title?: string; fileName?: string } }];
  // 工作区预览事件 / Workspace preview events
  'workspace.preview.open': [{ content: string; contentType: PreviewContentType; metadata?: PreviewMetadata }];
  'workspace.preview.close': [string]; // workspace path

  // 工作区 Diff 事件 / Workspace diff events
  'workspace.diff.fileChanged': [
    {
      workspace: string;
      filePath: string;
      diff: string;
      changeId?: string;
    },
  ];

  // Conversation thought updates (rendered in chat view)
  // Note: this is UI-only state and is not persisted in DB.
  'conversation.thought.update': [{ conversationId: string; thought: ThoughtData; running: boolean }];
}

export const emitter = new EventEmitter<EventTypes>();

export const addEventListener = <T extends EventEmitter.EventNames<EventTypes>>(event: T, fn: EventEmitter.EventListener<EventTypes, T>) => {
  emitter.on(event, fn);
  return () => {
    emitter.off(event, fn);
  };
};

export const useAddEventListener = <T extends EventEmitter.EventNames<EventTypes>>(event: T, fn: EventEmitter.EventListener<EventTypes, T>, deps?: DependencyList) => {
  useEffect(() => {
    return addEventListener(event, fn);
  }, deps || []);
};
