import { ipcBridge } from '@/common';
import { useLayoutContext } from '@/renderer/context/LayoutContext';
import { Spin } from '@arco-design/web-react';
import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import ChatConversation from './ChatConversation';
import { usePreviewContext } from '@/renderer/pages/conversation/workspace/preview';
import { useConversationTabs } from './context/ConversationTabsContext';

const ChatConversationIndex: React.FC = () => {
  const { id } = useParams();
  const { closePreview } = usePreviewContext();
  const { openTab } = useConversationTabs();
  const layout = useLayoutContext();
  const previousConversationIdRef = useRef<string | undefined>(undefined);
  const autoCollapsedConversationIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!id) return;

    // 切换会话时自动关闭预览面板，避免跨会话残留
    // Ensure preview panel closes when switching conversations
    if (previousConversationIdRef.current && previousConversationIdRef.current !== id) {
      closePreview();
    }

    // Entering a conversation: auto-collapse left sidebar once per conversation
    if (autoCollapsedConversationIdRef.current !== id) {
      if (layout && layout.siderCollapsed === false) {
        layout.setSiderCollapsed(true);
      }
      autoCollapsedConversationIdRef.current = id;
    }

    previousConversationIdRef.current = id;
  }, [id, closePreview, layout]);

  const { data, isLoading } = useSWR(`conversation/${id}`, () => {
    return ipcBridge.conversation.get.invoke({ id });
  });

  // 当会话数据加载完成后，自动打开 tab
  // Automatically open tab when conversation data is loaded
  useEffect(() => {
    if (data) {
      openTab(data);
    }
  }, [data, openTab]);

  if (isLoading) return <Spin loading></Spin>;
  return <ChatConversation conversation={data}></ChatConversation>;
};

export default ChatConversationIndex;
