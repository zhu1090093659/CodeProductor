/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import FlexFullContainer from '@renderer/components/FlexFullContainer';
import MessageList from '@renderer/messages/MessageList';
import { MessageListProvider, useMessageLstCache } from '@renderer/messages/hooks';
import HOC from '@renderer/utils/HOC';
import React, { useEffect } from 'react';
import CodexSendBox from './CodexSendBox';
import LocalImageView from '../../../components/LocalImageView';
import { ConversationProvider } from '@/renderer/context/ConversationContext';
import type { IProvider, TProviderWithModel } from '@/common/storage';

const CodexChat: React.FC<{
  conversation_id: string;
  workspace: string;
  // Action toolbar props
  interactiveMode: boolean;
  onInteractiveModeToggle: () => void;
  showCollabButton: boolean;
  onCollabEnable: () => void;
  // Model selection props
  modelList?: IProvider[];
  currentModel?: TProviderWithModel;
  onModelSelect?: (model: TProviderWithModel) => void;
  isModelLoading?: boolean;
}> = ({ conversation_id, workspace, interactiveMode, onInteractiveModeToggle, showCollabButton, onCollabEnable, modelList, currentModel, onModelSelect, isModelLoading }) => {
  useMessageLstCache(conversation_id);
  const updateLocalImage = LocalImageView.useUpdateLocalImage();
  useEffect(() => {
    updateLocalImage({ root: workspace });
  }, [workspace]);
  return (
    <ConversationProvider value={{ conversationId: conversation_id, workspace, type: 'codex' }}>
      <div className='chat-thread flex-1 min-h-0 flex flex-col px-20px'>
        <FlexFullContainer>
          <MessageList className='flex-1'></MessageList>
        </FlexFullContainer>
        <CodexSendBox conversation_id={conversation_id} interactiveMode={interactiveMode} onInteractiveModeToggle={onInteractiveModeToggle} showCollabButton={showCollabButton} onCollabEnable={onCollabEnable} modelList={modelList} currentModel={currentModel} onModelSelect={onModelSelect} isModelLoading={isModelLoading} />
      </div>
    </ConversationProvider>
  );
};

export default HOC(MessageListProvider)(CodexChat);
