/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/storage';
import React from 'react';
import CodeConductorWorkspace from './workspace/CodeConductorWorkspace';

const ChatSider: React.FC<{
  conversation?: TChatConversation;
}> = ({ conversation }) => {
  let workspaceNode: React.ReactNode = null;
  if (conversation?.extra?.workspace) {
    workspaceNode = <CodeConductorWorkspace workspace={conversation.extra.workspace} />;
  }

  if (!workspaceNode) {
    return <div></div>;
  }

  return (
    <>
      {workspaceNode}
    </>
  );
};

export default ChatSider;
