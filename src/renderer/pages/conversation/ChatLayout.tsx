import { ConfigStorage } from '@/common/storage';
import { STORAGE_KEYS } from '@/common/storageKeys';
import type { IMessageAgentStatus } from '@/common/chatLib';
import FlexFullContainer from '@/renderer/components/FlexFullContainer';
import { useLayoutContext } from '@/renderer/context/LayoutContext';
import { useResizableSplit } from '@/renderer/hooks/useResizableSplit';
import { usePreviewContext } from '@/renderer/pages/conversation/workspace/preview';
import ConversationTabs from '@/renderer/pages/conversation/ConversationTabs';
import { useConversationTabs } from '@/renderer/pages/conversation/context/ConversationTabsContext';
import { Badge, Layout as ArcoLayout } from '@arco-design/web-react';
import { ExpandLeft, ExpandRight, Robot } from '@icon-park/react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import ClaudeLogo from '@/renderer/assets/logos/claude.svg';
import CodexLogo from '@/renderer/assets/logos/codex.svg';
import type { AcpBackend } from '@/types/acpTypes';

// Agent Logo 映射
const AGENT_LOGO_MAP: Partial<Record<AcpBackend, string>> = {
  claude: ClaudeLogo,
  codex: CodexLogo,
};

import { iconColors } from '@/renderer/theme/colors';
import { WORKSPACE_TOGGLE_EVENT, WORKSPACE_HAS_FILES_EVENT, dispatchWorkspaceStateEvent, dispatchWorkspaceToggleEvent, type WorkspaceHasFilesDetail } from '@/renderer/utils/workspaceEvents';
import { ACP_BACKENDS_ALL } from '@/types/acpTypes';
import { addEventListener } from '@/renderer/utils/emitter';
import classNames from 'classnames';

const MIN_WORKSPACE_RATIO = 12;
const WORKSPACE_HEADER_HEIGHT = 32;

const isMacEnvironment = () => {
  if (typeof navigator === 'undefined') return false;
  return /mac/i.test(navigator.userAgent);
};

interface WorkspaceHeaderProps {
  children?: React.ReactNode;
  showToggle?: boolean;
  collapsed: boolean;
  onToggle: () => void;
  togglePlacement?: 'left' | 'right';
}

const WorkspacePanelHeader: React.FC<WorkspaceHeaderProps> = ({ children, showToggle = false, collapsed, onToggle, togglePlacement = 'right' }) => (
  <div className='workspace-panel-header flex items-center justify-start px-12px py-4px gap-12px border-b border-[var(--bg-3)]' style={{ height: WORKSPACE_HEADER_HEIGHT, minHeight: WORKSPACE_HEADER_HEIGHT }}>
    {showToggle && togglePlacement === 'left' && (
      <button type='button' className='workspace-header__toggle mr-4px' aria-label='Toggle workspace' onClick={onToggle}>
        {collapsed ? <ExpandRight size={16} /> : <ExpandLeft size={16} />}
      </button>
    )}
    <div className='flex-1 truncate'>{children}</div>
    {showToggle && togglePlacement === 'right' && (
      <button type='button' className='workspace-header__toggle' aria-label='Toggle workspace' onClick={onToggle}>
        {collapsed ? <ExpandRight size={16} /> : <ExpandLeft size={16} />}
      </button>
    )}
  </div>
);

// headerExtra 用于在会话头部右侧插入自定义操作（如模型选择）
// headerExtra allows injecting custom actions (e.g., model picker) into the header's right area
const ChatLayout: React.FC<{
  children: React.ReactNode;
  title?: React.ReactNode;
  sider: React.ReactNode;
  siderTitle?: React.ReactNode;
  backend?: string;
  agentName?: string;
  agentStatus?: IMessageAgentStatus['content'] | null;
  /** 自定义 agent logo（可以是 SVG 路径或 emoji 字符串）/ Custom agent logo (can be SVG path or emoji string) */
  agentLogo?: string;
  /** 是否为 emoji 类型的 logo / Whether the logo is an emoji */
  agentLogoIsEmoji?: boolean;
  headerExtra?: React.ReactNode;
  headerLeft?: React.ReactNode;
  workspaceEnabled?: boolean;
}> = (props) => {
  const { t } = useTranslation();
  // 工作空间面板折叠状态 - 全局持久化
  // Workspace panel collapse state - globally persisted
  const [rightSiderCollapsed, setRightSiderCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.WORKSPACE_PANEL_COLLAPSE);
      if (stored !== null) {
        return stored === 'true';
      }
    } catch {
      // 忽略错误
    }
    return false; // 默认展开
  });
  // 当前活跃的会话 ID（用于记录用户手动操作偏好）
  // Current active conversation ID (for recording user manual operation preference)
  const currentConversationIdRef = useRef<string | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth));
  const { backend, agentName, agentLogo, agentLogoIsEmoji, workspaceEnabled = true } = props;
  const layout = useLayoutContext();
  const isMacRuntime = isMacEnvironment();
  // 右侧栏折叠状态引用 / Mirror ref for collapse state
  const rightCollapsedRef = useRef(rightSiderCollapsed);
  const previousRightSiderCollapsedRef = useRef(rightSiderCollapsed);

  // 预览面板状态 / Preview panel state
  const { isOpen: isPreviewOpen } = usePreviewContext();

  // Compute display name with fallback chain
  const displayName = agentName || ACP_BACKENDS_ALL[backend as keyof typeof ACP_BACKENDS_ALL]?.name || backend || 'agent';
  const statusKey = props.agentStatus?.status || null;
  const statusTextFull = statusKey ? t(`acp.status.${statusKey}`, { agent: displayName }) : null;
  const statusText = statusTextFull && displayName ? statusTextFull.split(displayName).join('').replace(/\s+/g, ' ').trim() : statusTextFull;
  const badgeStatus: React.ComponentProps<typeof Badge>['status'] | null = (function resolveBadgeStatus() {
    if (!statusKey) return null;
    switch (statusKey) {
      case 'connecting':
      case 'disconnected':
        return 'default';
      case 'connected':
      case 'authenticated':
      case 'session_active':
        return 'success';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  })();

  // 获取 tabs 状态，有 tabs 时隐藏会话标题
  const { openTabs } = useConversationTabs();
  const hasTabs = openTabs.length > 0;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const handleWorkspaceToggle = () => {
      if (!workspaceEnabled) {
        return;
      }
      setRightSiderCollapsed((prev) => {
        const newState = !prev;
        // 记录用户手动操作偏好 / Record user manual operation preference
        const conversationId = currentConversationIdRef.current;
        if (conversationId) {
          try {
            localStorage.setItem(`workspace-preference-${conversationId}`, newState ? 'collapsed' : 'expanded');
          } catch {
            // 忽略错误
          }
        }
        return newState;
      });
    };
    window.addEventListener(WORKSPACE_TOGGLE_EVENT, handleWorkspaceToggle);
    return () => {
      window.removeEventListener(WORKSPACE_TOGGLE_EVENT, handleWorkspaceToggle);
    };
  }, [workspaceEnabled]);

  // 根据文件状态自动展开/折叠工作空间面板（优先使用用户手动偏好）
  // Auto expand/collapse workspace panel based on files state (user preference takes priority)
  useEffect(() => {
    if (typeof window === 'undefined' || !workspaceEnabled) {
      return undefined;
    }
    const handleHasFiles = (event: Event) => {
      const detail = (event as CustomEvent<WorkspaceHasFilesDetail>).detail;
      const conversationId = detail.conversationId;

      // 更新当前会话 ID / Update current conversation ID
      currentConversationIdRef.current = conversationId;

      // 检查用户是否有手动设置的偏好 / Check if user has manual preference
      let userPreference: 'expanded' | 'collapsed' | null = null;
      if (conversationId) {
        try {
          const stored = localStorage.getItem(`workspace-preference-${conversationId}`);
          if (stored === 'expanded' || stored === 'collapsed') {
            userPreference = stored;
          }
        } catch {
          // 忽略错误
        }
      }

      // 如果有用户偏好，按偏好设置；否则按文件状态决定
      // If user has preference, use it; otherwise decide by file state
      if (userPreference) {
        const shouldCollapse = userPreference === 'collapsed';
        if (shouldCollapse !== rightSiderCollapsed) {
          setRightSiderCollapsed(shouldCollapse);
        }
      } else {
        // 无用户偏好：有文件展开；无文件时不强制折叠（保持默认展开/用户当前状态）
        // No user preference: expand if has files; don't force-collapse when empty
        if (detail.hasFiles && rightSiderCollapsed) {
          setRightSiderCollapsed(false);
        }
      }
    };
    window.addEventListener(WORKSPACE_HAS_FILES_EVENT, handleHasFiles);
    return () => {
      window.removeEventListener(WORKSPACE_HAS_FILES_EVENT, handleHasFiles);
    };
  }, [workspaceEnabled, rightSiderCollapsed]);

  useEffect(() => {
    if (!workspaceEnabled) {
      dispatchWorkspaceStateEvent(true);
      return;
    }
    dispatchWorkspaceStateEvent(rightSiderCollapsed);
  }, [rightSiderCollapsed, workspaceEnabled]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      setContainerWidth(typeof window === 'undefined' ? 0 : window.innerWidth);
      return;
    }
    setContainerWidth(element.offsetWidth);
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      if (!entries.length) return;
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    rightCollapsedRef.current = rightSiderCollapsed;
  }, [rightSiderCollapsed]);

  // 持久化工作空间面板折叠状态
  // Persist workspace panel collapse state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.WORKSPACE_PANEL_COLLAPSE, String(rightSiderCollapsed));
    } catch {
      // 忽略错误
    }
  }, [rightSiderCollapsed]);

  useEffect(() => {
    if (!workspaceEnabled) {
      setRightSiderCollapsed(true);
    }
  }, [workspaceEnabled]);

  useEffect(() => {
    if (!workspaceEnabled || !layout?.isMobile || rightCollapsedRef.current) {
      return;
    }
    setRightSiderCollapsed(true);
  }, [layout?.isMobile, workspaceEnabled]);

  const { splitRatio: workspaceSplitRatio, createDragHandle: createWorkspaceDragHandle } = useResizableSplit({
    defaultWidth: 60,
    minWidth: MIN_WORKSPACE_RATIO,
    maxWidth: 75,
    storageKey: 'chat-workspace-split-ratio',
  });

  const isDesktop = !layout?.isMobile;
  const effectiveWorkspaceRatio = workspaceEnabled && isDesktop && !rightSiderCollapsed ? workspaceSplitRatio : 0;
  const chatFlex = isDesktop ? 100 - effectiveWorkspaceRatio : 100;
  const workspaceFlex = effectiveWorkspaceRatio;
  const viewportWidth = containerWidth || (typeof window === 'undefined' ? 0 : window.innerWidth);
  const workspaceWidthPx = workspaceEnabled ? Math.min(500, Math.max(200, (workspaceSplitRatio / 100) * (viewportWidth || 0))) : 0;

  useEffect(() => {
    if (!workspaceEnabled || !isPreviewOpen || !isDesktop) {
      return;
    }
    // Preview panel is rendered inside workspace; ensure workspace panel is visible
    setRightSiderCollapsed(false);
  }, [isDesktop, isPreviewOpen, workspaceEnabled]);

  // When sidebar triggers workspace file preview, ensure workspace panel is visible
  // Keep it simple: force expand workspace panel on preview request
  useEffect(() => {
    if (!workspaceEnabled) return;
    return addEventListener('workspace.preview.open', () => {
      setRightSiderCollapsed(false);
    });
  }, [workspaceEnabled]);

  // Auto-collapse left sidebar when workspace is expanded (desktop only)
  useEffect(() => {
    if (!workspaceEnabled || !isDesktop) {
      previousRightSiderCollapsedRef.current = rightSiderCollapsed;
      return;
    }

    const wasCollapsed = previousRightSiderCollapsedRef.current;
    // Only collapse sidebar on transition: collapsed -> expanded
    if (wasCollapsed && !rightSiderCollapsed && layout?.setSiderCollapsed && !layout.siderCollapsed) {
      layout.setSiderCollapsed(true);
    }

    previousRightSiderCollapsedRef.current = rightSiderCollapsed;
  }, [isDesktop, layout?.setSiderCollapsed, layout?.siderCollapsed, rightSiderCollapsed, workspaceEnabled]);

  const mobileHandle =
    workspaceEnabled && layout?.isMobile
      ? createWorkspaceDragHandle({
          className: 'absolute left-0 top-0 bottom-0',
          style: { borderRight: 'none', borderLeft: '1px solid var(--bg-3)' },
          reverse: true,
        })
      : null;

  return (
    <ArcoLayout className='size-full'>
      {/* 主内容区域：会话面板 + 工作空间面板 / Main content area: chat + workspace */}
      <div ref={containerRef} className='flex flex-1 relative w-full overflow-hidden'>
        {/* 会话面板（带拖动句柄）/ Chat panel (with drag handle) */}
        <div
          className='flex flex-col relative'
          style={{
            // 使用 flexBasis 设置宽度，避免 width 和 flexBasis 冲突
            flexGrow: chatFlex,
            flexShrink: 0,
            flexBasis: 0,
            display: 'flex',
            minWidth: isDesktop ? '240px' : '100%',
          }}
        >
          <ArcoLayout.Content
            className='flex flex-col h-full'
            onClick={() => {
              const isMobile = window.innerWidth < 768;
              if (isMobile && !rightSiderCollapsed) {
                setRightSiderCollapsed(true);
              }
            }}
          >
            {/* 会话 Tabs 栏 / Conversation tabs bar */}
            <ConversationTabs />
            <ArcoLayout.Header className={classNames('h-36px flex items-center justify-between p-16px gap-16px !bg-1 chat-layout-header')}>
              <div>{props.headerLeft}</div>
              <FlexFullContainer className='h-full' containerClassName='flex items-center gap-16px'>
                {!hasTabs && <span className='font-bold text-16px text-t-primary inline-block overflow-hidden text-ellipsis whitespace-nowrap shrink-0 max-w-[50%]'>{props.title}</span>}
              </FlexFullContainer>
              <div className='flex items-center gap-12px'>
                {/* headerExtra 会在右上角优先渲染，例如模型切换按钮 / headerExtra renders at top-right for items like model switchers */}
                {props.headerExtra}
                {(backend || agentLogo) && (
                  <div className='ml-16px flex items-center gap-2 bg-2 w-fit rounded-full px-[8px] py-[2px]'>
                    {agentLogo ? agentLogoIsEmoji ? <span className='text-sm'>{agentLogo}</span> : <img src={agentLogo} alt={`${agentName || 'agent'} logo`} width={16} height={16} style={{ objectFit: 'contain' }} /> : AGENT_LOGO_MAP[backend as AcpBackend] ? <img src={AGENT_LOGO_MAP[backend as AcpBackend]} alt={`${backend} logo`} width={16} height={16} style={{ objectFit: 'contain' }} /> : <Robot theme='outline' size={16} fill={iconColors.primary} />}
                    <span className='text-sm'>{displayName}</span>
                    {badgeStatus && statusText && (
                      <span className='flex items-center gap-6px text-sm' title={statusTextFull || undefined}>
                        <Badge status={badgeStatus} />
                        <span>{statusText}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </ArcoLayout.Header>
            <ArcoLayout.Content className='flex flex-col flex-1 bg-1 overflow-hidden'>{props.children}</ArcoLayout.Content>
          </ArcoLayout.Content>
        </div>

        {/* 工作空间面板（移到最右边）/ Workspace panel (moved to rightmost position) */}
        {workspaceEnabled && !layout?.isMobile && (
          <div
            className={classNames('!bg-1 relative chat-layout-right-sider layout-sider')}
            style={{
              // 使用 flexBasis 设置宽度，避免 width 和 flexBasis 冲突
              flexGrow: workspaceFlex,
              flexShrink: 0,
              flexBasis: rightSiderCollapsed ? '0px' : 0,
              minWidth: rightSiderCollapsed ? '0px' : '220px',
              overflow: 'hidden',
              borderLeft: rightSiderCollapsed ? 'none' : '1px solid var(--bg-3)',
            }}
          >
            {isDesktop &&
              !rightSiderCollapsed &&
              createWorkspaceDragHandle({
                className: 'absolute left-0 top-0 bottom-0',
                style: {},
                reverse: true,
              })}
            <WorkspacePanelHeader showToggle={!isMacRuntime} collapsed={rightSiderCollapsed} onToggle={() => dispatchWorkspaceToggleEvent()} togglePlacement={layout?.isMobile ? 'left' : 'right'}>
              {props.siderTitle}
            </WorkspacePanelHeader>
            <ArcoLayout.Content style={{ height: `calc(100% - ${WORKSPACE_HEADER_HEIGHT}px)` }}>{props.sider}</ArcoLayout.Content>
          </div>
        )}

        {/* 移动端工作空间遮罩层 / Mobile workspace backdrop */}
        {workspaceEnabled && layout?.isMobile && !rightSiderCollapsed && <div className='fixed inset-0 bg-black/30 z-90' onClick={() => setRightSiderCollapsed(true)} aria-hidden='true' />}

        {/* 移动端工作空间（保持原有的固定定位）/ Mobile workspace (keep original fixed positioning) */}
        {workspaceEnabled && layout?.isMobile && (
          <div
            className='!bg-1 relative chat-layout-right-sider'
            style={{
              position: 'fixed',
              right: 0,
              top: 0,
              height: '100vh',
              width: `${Math.round(workspaceWidthPx)}px`,
              zIndex: 100,
              transform: rightSiderCollapsed ? 'translateX(100%)' : 'translateX(0)',
              transition: 'none',
              pointerEvents: rightSiderCollapsed ? 'none' : 'auto',
            }}
          >
            {mobileHandle}
            <WorkspacePanelHeader showToggle collapsed={rightSiderCollapsed} onToggle={() => dispatchWorkspaceToggleEvent()} togglePlacement='left'>
              {props.siderTitle}
            </WorkspacePanelHeader>
            <ArcoLayout.Content className='bg-1' style={{ height: `calc(100% - ${WORKSPACE_HEADER_HEIGHT}px)` }}>
              {props.sider}
            </ArcoLayout.Content>
          </div>
        )}

        {!isMacRuntime && workspaceEnabled && rightSiderCollapsed && !layout?.isMobile && (
          <button type='button' className='workspace-toggle-floating workspace-header__toggle absolute top-1/2 right-2 z-10' style={{ transform: 'translateY(-50%)' }} onClick={() => dispatchWorkspaceToggleEvent()} aria-label='Expand workspace'>
            <ExpandLeft size={16} />
          </button>
        )}
      </div>
    </ArcoLayout>
  );
};

export default ChatLayout;
