/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AcpBackend } from '@/types/acpTypes';
import type { IProvider, TProviderWithModel } from '@/common/storage';
import FlexFullContainer from '@renderer/components/FlexFullContainer';
import MessageList from '@renderer/messages/MessageList';
import { MessageListProvider, useMessageLstCache } from '@renderer/messages/hooks';
import HOC from '@renderer/utils/HOC';
import React from 'react';
import AcpSendBox from './AcpSendBox';
import { ConversationProvider } from '@/renderer/context/ConversationContext';

const AcpChat: React.FC<{
  conversation_id: string;
  workspace?: string;
  backend: AcpBackend;
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
}> = ({ conversation_id, workspace, backend, interactiveMode, onInteractiveModeToggle, showCollabButton, onCollabEnable, modelList, currentModel, onModelSelect, isModelLoading }) => {
  useMessageLstCache(conversation_id);

  return (
    <ConversationProvider value={{ conversationId: conversation_id, workspace, type: 'acp', backend }}>
      <div className='chat-thread flex-1 min-h-0 flex flex-col px-20px'>
        <FlexFullContainer>
          <MessageList className='flex-1'></MessageList>
        </FlexFullContainer>
        <AcpSendBox conversation_id={conversation_id} backend={backend} interactiveMode={interactiveMode} onInteractiveModeToggle={onInteractiveModeToggle} showCollabButton={showCollabButton} onCollabEnable={onCollabEnable} modelList={modelList} currentModel={currentModel} onModelSelect={onModelSelect} isModelLoading={isModelLoading} />
      </div>
    </ConversationProvider>
  );
};

export default HOC(MessageListProvider)(AcpChat);
