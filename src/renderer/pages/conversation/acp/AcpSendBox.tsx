import { ipcBridge } from '@/common';
import type { AcpBackend } from '@/types/acpTypes';
import { transformMessage, type TMessage } from '@/common/chatLib';
import type { IResponseMessage } from '@/common/ipcBridge';
import { uuid } from '@/common/utils';
import SendBox from '@/renderer/components/sendbox';
import type { ThoughtData } from '@/renderer/components/ThoughtDisplay';
import { getSendBoxDraftHook, type FileOrFolderItem } from '@/renderer/hooks/useSendBoxDraft';
import { createSetUploadFile, useSendBoxFiles } from '@/renderer/hooks/useSendBoxFiles';
import { useAddOrUpdateMessage } from '@/renderer/messages/hooks';
import { allSupportedExts } from '@/renderer/services/FileService';
import { emitter, useAddEventListener } from '@/renderer/utils/emitter';
import { mergeFileSelectionItems } from '@/renderer/utils/fileSelection';
import { handleSlashCommand } from '@/renderer/utils/slashCommands';
import { Button, Message, Tag } from '@arco-design/web-react';
import { Plus } from '@icon-park/react';
import { iconColors } from '@/renderer/theme/colors';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FilePreview from '@/renderer/components/FilePreview';
import HorizontalFileList from '@/renderer/components/HorizontalFileList';
import { usePreviewContext } from '@/renderer/pages/conversation/workspace/preview';
import { buildDisplayMessage } from '@/renderer/utils/messageFiles';
import { useLatestRef } from '@/renderer/hooks/useLatestRef';
import { useAutoTitle } from '@/renderer/hooks/useAutoTitle';
import { useSlashCommands } from '@/renderer/hooks/useSlashCommands';
import ActionToolbar from '@/renderer/components/ActionToolbar';

const useAcpSendBoxDraft = getSendBoxDraftHook('acp', {
  _type: 'acp',
  atPath: [],
  content: '',
  uploadFile: [],
});

const useAcpMessage = (conversation_id: string, options?: { optimisticUserMessage?: boolean }) => {
  const addOrUpdateMessage = useAddOrUpdateMessage();
  const [running, setRunning] = useState(false);
  const thoughtRef = useRef<ThoughtData>({ subject: '', description: '' });
  const thoughtIdRef = useRef<string | null>(null);
  const lastUserMessageIdRef = useRef<string | null>(null); // Track last user message ID for thought anchoring
  const [acpStatus, setAcpStatus] = useState<'connecting' | 'connected' | 'authenticated' | 'session_active' | 'disconnected' | 'error' | null>(null);
  const [aiProcessing, setAiProcessing] = useState(false); // New loading state for AI response
  const optimisticUserMessage = options?.optimisticUserMessage === true;
  const optimisticMsgIdsRef = useRef<Set<string>>(new Set());

  const registerOptimisticMessageId = useCallback(
    (msgId: string) => {
      if (!optimisticUserMessage) return;
      optimisticMsgIdsRef.current.add(msgId);
    },
    [optimisticUserMessage]
  );

  const clearOptimisticMessageId = useCallback((msgId: string) => {
    optimisticMsgIdsRef.current.delete(msgId);
  }, []);

  // Allow external code to set the last user message ID before sending
  const setLastUserMessageId = useCallback((msgId: string | null) => {
    lastUserMessageIdRef.current = msgId;
  }, []);

  const handleResponseMessage = useCallback(
    (message: IResponseMessage) => {
      if (conversation_id !== message.conversation_id) {
        return;
      }
      if (message.type === 'user_content' && optimisticUserMessage) {
        const msgId = message.msg_id;
        if (msgId && optimisticMsgIdsRef.current.has(msgId)) {
          optimisticMsgIdsRef.current.delete(msgId);
          return;
        }
      }
      const transformedMessage = transformMessage(message);
      switch (message.type) {
        case 'thought':
          thoughtRef.current = (message.data as ThoughtData) || { subject: 'Thinking', description: '' };
          thoughtIdRef.current = message.msg_id || thoughtIdRef.current || uuid();
          emitter.emit('conversation.thought.update', {
            conversationId: conversation_id,
            thought: thoughtRef.current,
            running: true,
            thoughtId: thoughtIdRef.current,
          });
          break;
        case 'start':
          setRunning(true);
          thoughtIdRef.current = null;
          // Use saved user message ID to anchor thought correctly
          emitter.emit('conversation.thought.update', {
            conversationId: conversation_id,
            thought: { subject: '', description: '' },
            running: true,
            anchorId: lastUserMessageIdRef.current,
          });
          break;
        case 'finish':
          setRunning(false);
          setAiProcessing(false);
          emitter.emit('conversation.thought.update', {
            conversationId: conversation_id,
            thought: thoughtRef.current,
            running: false,
            thoughtId: thoughtIdRef.current,
          });
          thoughtRef.current = { subject: '', description: '' };
          thoughtIdRef.current = null;
          break;
        case 'content':
          addOrUpdateMessage(transformedMessage);
          break;
        case 'agent_status': {
          // Update ACP/Agent status
          const agentData = message.data as {
            status?: 'connecting' | 'connected' | 'authenticated' | 'session_active' | 'disconnected' | 'error';
            backend?: string;
          };
          if (agentData?.status) {
            setAcpStatus(agentData.status);
            // Reset running state when authentication is complete
            if (['authenticated', 'session_active'].includes(agentData.status)) {
              setRunning(false);
            }
          }
          addOrUpdateMessage(transformedMessage);
          break;
        }
        case 'user_content':
          addOrUpdateMessage(transformedMessage);
          // Save user message ID for thought anchoring in start event
          lastUserMessageIdRef.current = message.msg_id || null;
          // Trigger thought loading after user message is added to list
          // This ensures the anchor message exists when thought is rendered
          setAiProcessing(true);
          emitter.emit('conversation.thought.update', {
            conversationId: conversation_id,
            thought: { subject: '', description: '' },
            running: true,
            anchorId: message.msg_id,
          });
          break;
        case 'acp_permission':
          addOrUpdateMessage(transformedMessage);
          break;
        case 'error':
          // Stop AI processing state when error occurs
          setAiProcessing(false);
          emitter.emit('conversation.thought.update', {
            conversationId: conversation_id,
            thought: { subject: '', description: '' },
            running: false,
            thoughtId: thoughtIdRef.current,
          });
          thoughtIdRef.current = null;
          addOrUpdateMessage(transformedMessage);
          break;
        default:
          addOrUpdateMessage(transformedMessage);
          break;
      }
    },
    [conversation_id, addOrUpdateMessage, setRunning, setAiProcessing, setAcpStatus, optimisticUserMessage]
  );

  useEffect(() => {
    return ipcBridge.acpConversation.responseStream.on(handleResponseMessage);
  }, [handleResponseMessage]);

  // Reset state when conversation changes
  useEffect(() => {
    setRunning(false);
    thoughtRef.current = { subject: '', description: '' };
    thoughtIdRef.current = null;
    lastUserMessageIdRef.current = null;
    setAcpStatus(null);
    setAiProcessing(false);
    emitter.emit('conversation.thought.update', {
      conversationId: conversation_id,
      thought: { subject: '', description: '' },
      running: false,
    });
  }, [conversation_id]);

  return { running, acpStatus, aiProcessing, setAiProcessing, registerOptimisticMessageId, clearOptimisticMessageId, setLastUserMessageId };
};

const EMPTY_AT_PATH: Array<string | FileOrFolderItem> = [];
const EMPTY_UPLOAD_FILES: string[] = [];

const useSendBoxDraft = (conversation_id: string) => {
  const { data, mutate } = useAcpSendBoxDraft(conversation_id);
  const atPath = data?.atPath ?? EMPTY_AT_PATH;
  const uploadFile = data?.uploadFile ?? EMPTY_UPLOAD_FILES;
  const content = data?.content ?? '';

  const setAtPath = useCallback(
    (atPath: Array<string | FileOrFolderItem>) => {
      mutate((prev) => ({ ...prev, atPath }));
    },
    [data, mutate]
  );

  const setUploadFile = createSetUploadFile(mutate, data);

  const setContent = useCallback(
    (content: string) => {
      mutate((prev) => ({ ...prev, content }));
    },
    [data, mutate]
  );

  return {
    atPath,
    uploadFile,
    setAtPath,
    setUploadFile,
    content,
    setContent,
  };
};

import type { IProvider, TProviderWithModel } from '@/common/storage';

const AcpSendBox: React.FC<{
  conversation_id: string;
  backend: AcpBackend;
  mentionOptions?: Array<{ key: string; label: string }>;
  onMentionSelect?: (key: string) => void;
  optimisticUserMessage?: boolean;
  // Action toolbar props
  interactiveMode?: boolean;
  onInteractiveModeToggle?: () => void;
  showCollabButton?: boolean;
  onCollabEnable?: () => void;
  // Model selection props
  modelList?: IProvider[];
  currentModel?: TProviderWithModel;
  onModelSelect?: (model: TProviderWithModel) => void;
  isModelLoading?: boolean;
}> = ({ conversation_id, backend, mentionOptions, onMentionSelect, optimisticUserMessage, interactiveMode, onInteractiveModeToggle, showCollabButton, onCollabEnable, modelList, currentModel, onModelSelect, isModelLoading }) => {
  const [workspacePath, setWorkspacePath] = useState('');
  const { running, acpStatus, setAiProcessing, registerOptimisticMessageId, clearOptimisticMessageId, setLastUserMessageId } = useAcpMessage(conversation_id, {
    optimisticUserMessage,
  });
  const { t } = useTranslation();
  const { checkAndUpdateTitle } = useAutoTitle();
  const { commands: slashCommands } = useSlashCommands();
  const { atPath, uploadFile, setAtPath, setUploadFile, content, setContent } = useSendBoxDraft(conversation_id);
  const { setSendBoxHandler } = usePreviewContext();

  useEffect(() => {
    void ipcBridge.conversation.get.invoke({ id: conversation_id }).then((res) => {
      if (!res?.extra?.workspace) return;
      setWorkspacePath(res.extra.workspace);
    });
  }, [conversation_id]);

  // 使用 useLatestRef 保存最新的 setContent/atPath，避免重复注册 handler
  // Use useLatestRef to keep latest setters to avoid re-registering handler
  const setContentRef = useLatestRef(setContent);
  const atPathRef = useLatestRef(atPath);

  const sendingInitialMessageRef = useRef(false); // Prevent duplicate sends
  const addOrUpdateMessage = useAddOrUpdateMessage(); // Move this here so it's available in useEffect
  const addOrUpdateMessageRef = useLatestRef(addOrUpdateMessage);

  // 使用共享的文件处理逻辑
  const { handleFilesAdded, clearFiles } = useSendBoxFiles({
    atPath,
    uploadFile,
    setAtPath,
    setUploadFile,
  });

  // 注册预览面板添加到发送框的 handler
  // Register handler for adding text from preview panel to sendbox
  useEffect(() => {
    const handler = (text: string) => {
      // 如果已有内容，添加换行和新文本；否则直接设置文本
      // If there's existing content, add newline and new text; otherwise just set the text
      const newContent = content ? `${content}\n${text}` : text;
      setContentRef.current(newContent);
    };
    setSendBoxHandler(handler);
  }, [setSendBoxHandler, content]);

  // Check for and send initial message from guid page when ACP is authenticated
  useEffect(() => {
    console.log('[AcpSendBox] Initial message check - conversation:', conversation_id, 'acpStatus:', acpStatus);
    if (!acpStatus) {
      return;
    }
    if (acpStatus !== 'session_active') {
      console.log('[AcpSendBox] Waiting for session_active, current status:', acpStatus);
      return;
    }

    const sendInitialMessage = async () => {
      // Check flag at the actual execution time
      if (sendingInitialMessageRef.current) {
        console.log('[AcpSendBox] Already sending initial message, skipping');
        return;
      }
      sendingInitialMessageRef.current = true;
      const storageKey = `acp_initial_message_${conversation_id}`;
      const storedMessage = sessionStorage.getItem(storageKey);

      console.log('[AcpSendBox] Checking for initial message with key:', storageKey, 'found:', !!storedMessage);
      if (!storedMessage) {
        return;
      }
      try {
        const initialMessage = JSON.parse(storedMessage);
        const { input, files } = initialMessage;
        const displayMessage = buildDisplayMessage(input, files || [], workspacePath);
        const msg_id = uuid();

        // Set user message ID immediately so start event can use it for thought anchoring
        setLastUserMessageId(msg_id);

        // Send the message
        // Note: Thought loading will be triggered when backend echoes user_content message
        const result = await ipcBridge.acpConversation.sendMessage.invoke({
          input: displayMessage,
          msg_id,
          conversation_id,
          files,
        });

        if (result && result.success === true) {
          // Initial message sent successfully
          void checkAndUpdateTitle(conversation_id, input);
          // 等待一小段时间确保后端数据库更新完成
          await new Promise((resolve) => setTimeout(resolve, 100));
          sessionStorage.removeItem(storageKey);
          emitter.emit('chat.history.refresh');
        } else {
          // Handle send failure
          console.error('[ACP-FRONTEND] Failed to send initial message:', result);
          // Create error message in UI
          const errorMessage: TMessage = {
            id: uuid(),
            msg_id: uuid(),
            conversation_id,
            type: 'tips',
            position: 'center',
            content: {
              content: 'Failed to send message. Please try again.',
              type: 'error',
            },
            createdAt: Date.now() + 2,
          };
          addOrUpdateMessageRef.current(errorMessage, true);
          sendingInitialMessageRef.current = false; // Reset flag on failure
          setAiProcessing(false); // Stop loading state on failure
        }
      } catch (error) {
        console.error('Error sending initial message:', error);
        sessionStorage.removeItem(storageKey);
        sendingInitialMessageRef.current = false; // Reset flag on error
        setAiProcessing(false); // Stop loading state on error
      }
    };

    sendInitialMessage().catch((error) => {
      console.error('Failed to send initial message:', error);
    });
  }, [conversation_id, backend, acpStatus, setLastUserMessageId]);

  const onSendHandler = async (message: string) => {
    let finalMessage = message;
    if (workspacePath) {
      const slashResult = await handleSlashCommand(message, workspacePath, { commands: slashCommands });
      if (slashResult.handled) {
        if (slashResult.message) {
          Message.success(slashResult.message);
        }
        if (slashResult.error) {
          Message.error(slashResult.error);
        }
        if (!slashResult.messageToSend) {
          return;
        }
        finalMessage = slashResult.messageToSend;
      }
    }
    const msg_id = uuid();

    // Set user message ID immediately so start event can use it for thought anchoring
    // This ensures correct anchor even if start event arrives before user_content echo
    setLastUserMessageId(msg_id);

    const displayMessage = buildDisplayMessage(finalMessage, uploadFile, workspacePath);

    if (optimisticUserMessage) {
      registerOptimisticMessageId(msg_id);
      const userMessage: TMessage = {
        id: msg_id,
        msg_id,
        type: 'text',
        position: 'right',
        conversation_id,
        content: { content: displayMessage },
        createdAt: Date.now(),
      };
      addOrUpdateMessageRef.current(userMessage, true);
    }

    // 立即清空输入框，避免用户误以为消息没发送
    // Clear input immediately to avoid user thinking message wasn't sent
    setContent('');
    clearFiles();

    // Trigger thought loading for optimistic messages (user message already in list)
    // For non-optimistic messages, thought will be triggered when backend echoes user_content
    if (optimisticUserMessage) {
      setAiProcessing(true);
      emitter.emit('conversation.thought.update', {
        conversationId: conversation_id,
        thought: { subject: '', description: '' },
        running: true,
        anchorId: msg_id,
      });
    }

    // Send message via ACP
    try {
      const result = await ipcBridge.acpConversation.sendMessage.invoke({
        input: displayMessage,
        msg_id,
        conversation_id,
        files: uploadFile,
      });
      if (result && result.success === false) {
        clearOptimisticMessageId(msg_id);
        setAiProcessing(false);
        emitter.emit('conversation.thought.update', {
          conversationId: conversation_id,
          thought: { subject: '', description: '' },
          running: false,
        });
        const errorMessage: TMessage = {
          id: uuid(),
          msg_id: uuid(),
          conversation_id,
          type: 'tips',
          position: 'center',
          content: {
            content: result.msg || 'Failed to send message. Please try again.',
            type: 'error',
          },
          createdAt: Date.now() + 2,
        };
        addOrUpdateMessageRef.current(errorMessage, true);
        return;
      }
      void checkAndUpdateTitle(conversation_id, finalMessage);
      emitter.emit('chat.history.refresh');
    } catch (error: unknown) {
      clearOptimisticMessageId(msg_id);
      const errorMsg = error instanceof Error ? error.message : String(error);
      // Check if it's an ACP authentication error
      const isAuthError = errorMsg.includes('[ACP-AUTH-') || errorMsg.includes('authentication failed') || errorMsg.includes('认证失败');

      if (isAuthError) {
        // Create error message in conversation instead of alert
        const errorMessage = {
          id: uuid(),
          msg_id: uuid(),
          conversation_id,
          type: 'error',
          data: t('acp.auth.failed', {
            backend,
            error: errorMsg,
            defaultValue: `${backend} authentication failed:\n\n{{error}}\n\nPlease check your local CLI tool authentication status`,
          }),
        };

        // Add error message to conversation
        ipcBridge.acpConversation.responseStream.emit(errorMessage);

        // Stop loading state since AI won't respond
        setAiProcessing(false);
        return; // Don't re-throw error, just show the message
      }
      // Stop loading state for other errors too
      setAiProcessing(false);
      throw error;
    }

    // Clear selected files (similar to GeminiSendBox)
    emitter.emit('acp.selected.file.clear');
    if (uploadFile.length) {
      emitter.emit('acp.workspace.refresh');
    }
  };

  useAddEventListener('acp.selected.file', setAtPath);
  useAddEventListener('acp.selected.file.append', (items: Array<string | FileOrFolderItem>) => {
    const merged = mergeFileSelectionItems(atPathRef.current, items);
    if (merged !== atPathRef.current) {
      setAtPath(merged as Array<string | FileOrFolderItem>);
    }
  });

  // 停止会话处理函数 Stop conversation handler
  const handleStop = () => {
    return ipcBridge.conversation.stop.invoke({ conversation_id }).then(() => {});
  };

  return (
    <div className='chat-sendbox w-full mx-auto flex flex-col mt-auto mb-16px'>
      <SendBox
        value={content}
        onChange={setContent}
        loading={running}
        disabled={false}
        placeholder={t('acp.sendbox.placeholder', { backend, defaultValue: `Send message to {{backend}}...` })}
        onStop={handleStop}
        className='z-10'
        onFilesAdded={handleFilesAdded}
        supportedExts={allSupportedExts}
        slashCommands={slashCommands}
        mentionOptions={mentionOptions}
        onMentionSelect={onMentionSelect}
        tools={
          <Button
            type='secondary'
            shape='circle'
            icon={<Plus theme='outline' size='14' strokeWidth={2} fill={iconColors.primary} />}
            onClick={() => {
              void ipcBridge.dialog.showOpen.invoke({ properties: ['openFile', 'multiSelections'] }).then((files) => {
                if (files && files.length > 0) {
                  setUploadFile([...uploadFile, ...files]);
                }
              });
            }}
          />
        }
        prefix={
          <>
            {/* Files on top */}
            {(uploadFile.length > 0 || atPath.some((item) => (typeof item === 'string' ? true : item.isFile))) && (
              <HorizontalFileList>
                {uploadFile.map((path) => (
                  <FilePreview key={path} path={path} onRemove={() => setUploadFile(uploadFile.filter((v) => v !== path))} />
                ))}
                {atPath.map((item) => {
                  const isFile = typeof item === 'string' ? true : item.isFile;
                  const path = typeof item === 'string' ? item : item.path;
                  if (isFile) {
                    return (
                      <FilePreview
                        key={path}
                        path={path}
                        onRemove={() => {
                          const newAtPath = atPath.filter((v) => (typeof v === 'string' ? v !== path : v.path !== path));
                          emitter.emit('acp.selected.file', newAtPath);
                          setAtPath(newAtPath);
                        }}
                      />
                    );
                  }
                  return null;
                })}
              </HorizontalFileList>
            )}
            {/* Folder tags below */}
            {atPath.some((item) => (typeof item === 'string' ? false : !item.isFile)) && (
              <div className='flex flex-wrap items-center gap-8px mb-8px'>
                {atPath.map((item) => {
                  if (typeof item === 'string') return null;
                  if (!item.isFile) {
                    return (
                      <Tag
                        key={item.path}
                        color='blue'
                        closable
                        onClose={() => {
                          const newAtPath = atPath.filter((v) => (typeof v === 'string' ? true : v.path !== item.path));
                          emitter.emit('acp.selected.file', newAtPath);
                          setAtPath(newAtPath);
                        }}
                      >
                        {item.name}
                      </Tag>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </>
        }
        onSend={onSendHandler}
      ></SendBox>

      {/* Action Toolbar */}
      {(interactiveMode !== undefined || modelList || showCollabButton) && <ActionToolbar interactiveMode={interactiveMode ?? false} onInteractiveModeToggle={onInteractiveModeToggle ?? (() => {})} showCollabButton={showCollabButton ?? false} onCollabButtonClick={onCollabEnable ?? (() => {})} modelList={modelList} currentModel={currentModel} onModelSelect={onModelSelect} isModelLoading={isModelLoading} showInteractiveToggle={!!onInteractiveModeToggle} showModelSelector={!!modelList} t={t} />}
    </div>
  );
};

export default AcpSendBox;
