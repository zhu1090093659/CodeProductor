/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { ProjectInfo } from '@/common/storage';
import { ConfigStorage } from '@/common/storage';
import type { IDirOrFile } from '@/common/ipcBridge';
import { STORAGE_KEYS } from '@/common/storageKeys';
import { emitter } from '@/renderer/utils/emitter';
import { getPreviewContentType, loadPreviewForFile } from '@/renderer/pages/conversation/workspace/utils/previewUtils';
import { useConversationTabs } from '@/renderer/pages/conversation/context/ConversationTabsContext';
import { useProjects } from '@/renderer/hooks/useProjects';
import { deleteProject, ensureProjectForWorkspace, renameProject, setActiveProjectId, type DeleteProjectResult } from '@/renderer/utils/projectService';
import { Empty, Input, Message, Modal, Popconfirm, Spin, Tree, Tooltip } from '@arco-design/web-react';
import { DeleteOne, Down, EditOne, FileText, FolderOpen, Plus } from '@icon-park/react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { iconColors } from '@/renderer/theme/colors';

interface TreeNode {
  key: string;
  title: string;
  isLeaf?: boolean;
  children?: TreeNode[];
  data?: IDirOrFile;
}

const buildTreeNodes = (node: IDirOrFile): TreeNode => ({
  key: node.relativePath || node.fullPath || node.name,
  title: node.name,
  isLeaf: node.isFile,
  data: node,
  children: node.children?.map(buildTreeNodes),
});

const readStoredBoolean = (key: string, fallback: boolean) => {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      return stored === 'true';
    }
  } catch {
    // Ignore errors
  }
  return fallback;
};

const ProjectModePanel: React.FC = () => {
  const { t } = useTranslation();
  const { activeTab } = useConversationTabs();
  const [loading, setLoading] = useState(false);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [jiraStatus, setJiraStatus] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [mcpStatus, setMcpStatus] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const { projects, activeProjectId, activeProject } = useProjects();
  const [isProjectListCollapsed, setIsProjectListCollapsed] = useState(() => readStoredBoolean(STORAGE_KEYS.PROJECT_LIST_COLLAPSE, false));
  const [isWorkspaceTreeCollapsed, setIsWorkspaceTreeCollapsed] = useState(() => readStoredBoolean(STORAGE_KEYS.PROJECT_TREE_COLLAPSE, false));
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [messageApi, messageContext] = Message.useMessage();

  // Project selection should drive the workspace tree (not the active conversation tab)
  const workspace = activeProject?.workspace || activeTab?.workspace;
  const conversationId = activeTab?.id || '';

  const refreshTree = useCallback(async () => {
    if (!workspace) {
      setTreeData([]);
      setExpandedKeys([]);
      return;
    }
    setLoading(true);
    try {
      // Load full workspace tree (not only .ai)
      const res = await ipcBridge.conversation.getWorkspace.invoke({ conversation_id: conversationId, workspace, path: workspace });
      const root = res?.[0];
      setTreeData(root ? [buildTreeNodes(root)] : []);
      // Default collapse folders when panel is shown
      setExpandedKeys([]);
    } catch {
      setTreeData([]);
      setExpandedKeys([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId, workspace]);

  const refreshStatus = useCallback(async () => {
    try {
      const mcpConfig = (await ConfigStorage.get('mcp.config')) || [];
      const jiraServer = mcpConfig.find((server) => server.name.toLowerCase().includes('jira'));
      if (!jiraServer) {
        setJiraStatus('error');
        setMcpStatus('error');
        return;
      }
      setMcpStatus('ok');
      const test = await ipcBridge.mcpService.testMcpConnection.invoke(jiraServer);
      setJiraStatus(test?.success ? 'ok' : 'error');
    } catch {
      setJiraStatus('error');
      setMcpStatus('error');
    }
  }, []);

  useEffect(() => {
    void refreshTree();
  }, [refreshTree]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROJECT_LIST_COLLAPSE, String(isProjectListCollapsed));
    } catch {
      // Ignore errors
    }
  }, [isProjectListCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROJECT_TREE_COLLAPSE, String(isWorkspaceTreeCollapsed));
    } catch {
      // Ignore errors
    }
  }, [isWorkspaceTreeCollapsed]);

  const handleSelect = useCallback(
    async (_keys: string[], info: any) => {
      // Arco Tree returns a NodeInstance; the tree item is stored in node.props.dataRef
      // We attach IDirOrFile as dataRef.data in our treeData
      const dataRef: TreeNode | undefined = info?.node?.props?.dataRef;
      const nodeData = dataRef?.data;
      if (!nodeData?.isFile || !nodeData.fullPath) return;
      if (!workspace) return;
      try {
        const preview = await loadPreviewForFile(nodeData, workspace);
        if (!preview) return;
        emitter.emit('workspace.preview.open', preview);
      } catch {
        const contentType = getPreviewContentType(nodeData.name);
        const ext = nodeData.name.toLowerCase().split('.').pop() || '';
        emitter.emit('workspace.preview.open', {
          content: '',
          contentType,
          metadata: {
            title: nodeData.name,
            fileName: nodeData.name,
            filePath: nodeData.fullPath,
            workspace,
            language: ext,
          },
        });
      }
    },
    [workspace]
  );

  const statusDot = useCallback((status: 'unknown' | 'ok' | 'error') => {
    if (status === 'ok') return 'bg-green-500';
    if (status === 'error') return 'bg-red-500';
    return 'bg-gray-400';
  }, []);

  const handleCreateProject = useCallback(async () => {
    const files = await ipcBridge.dialog.showOpen.invoke({ properties: ['openDirectory'] });
    if (!files || files.length === 0 || !files[0]) return;
    await ensureProjectForWorkspace(files[0]);
  }, []);

  const handleSelectProject = useCallback(
    async (projectId: string) => {
      const exists = projects.some((project) => project.id === projectId);
      if (!exists) return;
      await setActiveProjectId(projectId);
    },
    [projects]
  );

  const handleEditStart = useCallback((project: ProjectInfo) => {
    setEditingProjectId(project.id);
    setEditingProjectName(project.name);
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!editingProjectId || !editingProjectName.trim()) return;
    const ok = await renameProject(editingProjectId, editingProjectName);
    if (ok) {
      setEditingProjectId(null);
      setEditingProjectName('');
    }
  }, [editingProjectId, editingProjectName]);

  const handleEditCancel = useCallback(() => {
    setEditingProjectId(null);
    setEditingProjectName('');
  }, []);

  const confirmDeleteProject = useCallback(
    (project: ProjectInfo) => {
      Modal.confirm({
        title: t('project.deleteConfirmTitle', { defaultValue: '确认删除项目' }),
        content: t('project.deleteConfirmContent', { defaultValue: '该操作将彻底删除项目、所有会话与本地文件夹，无法恢复。' }),
        okText: t('common.confirm', { defaultValue: '确认' }),
        cancelText: t('common.cancel', { defaultValue: '取消' }),
        onOk: () => {
          void deleteProject(project.id).then((result: DeleteProjectResult) => {
            if (result.success) {
              if (result.workspaceRemoved) {
                messageApi.success(t('project.deleteSuccess', { defaultValue: 'Project deleted.' }));
              } else {
                // Project removed from list, but workspace directory couldn't be deleted
                messageApi.warning(
                  t('project.deletePartial', {
                    defaultValue: 'Project removed. The folder could not be deleted and may need manual removal.',
                    workspace: result.workspace,
                  })
                );
              }
            } else {
              messageApi.error(t('project.deleteFailed', { defaultValue: 'Failed to delete project.' }));
            }
          });
        },
      });
    },
    [messageApi, t]
  );

  return (
    <div className='px-12px py-10px flex flex-col gap-12px'>
      {messageContext}
      <div className='flex items-center justify-between gap-8px'>
        <button type='button' className='flex items-center gap-8px px-6px py-4px rounded-6px text-12px text-t-secondary hover:bg-hover transition-colors' onClick={() => setIsProjectListCollapsed((prev) => !prev)} aria-expanded={!isProjectListCollapsed}>
          <Down size={14} fill={iconColors.secondary} className={`line-height-0 transition-transform duration-200 flex-shrink-0 ${isProjectListCollapsed ? '-rotate-90' : 'rotate-0'}`} />
          <span className='font-medium'>{t('project.title', { defaultValue: '项目' })}</span>
        </button>
        <Tooltip content={t('project.create', { defaultValue: 'New Project' })}>
          <button
            type='button'
            className='flex items-center justify-center w-20px h-20px rounded-6px hover:bg-hover cursor-pointer transition-colors'
            onClick={(event) => {
              event.stopPropagation();
              void handleCreateProject();
            }}
            aria-label={t('project.create', { defaultValue: 'New Project' })}
          >
            <Plus theme='outline' size='14' />
          </button>
        </Tooltip>
      </div>
      {!isProjectListCollapsed && (
        <>
          {projects.length === 0 ? (
            <div className='px-8px text-12px text-t-secondary'>{t('project.empty', { defaultValue: '暂无项目' })}</div>
          ) : (
            <div className='flex flex-col gap-6px'>
              {projects.map((project) => {
                const isEditing = editingProjectId === project.id;
                const isActive = project.id === activeProjectId;
                return (
                  <div key={project.id} className={`flex items-center gap-8px px-8px py-6px rounded-8px cursor-pointer group ${isActive ? 'bg-active' : 'hover:bg-hover'}`} onClick={() => handleSelectProject(project.id)}>
                    <div className='flex-1 min-w-0'>
                      {isEditing ? (
                        <Input
                          size='mini'
                          value={editingProjectName}
                          onChange={setEditingProjectName}
                          onBlur={() => {
                            void handleEditSave();
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              void handleEditSave();
                            } else if (event.key === 'Escape') {
                              handleEditCancel();
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <Tooltip content={project.workspace} position='right'>
                          <div className='text-12px text-t-primary truncate'>{project.name}</div>
                        </Tooltip>
                      )}
                    </div>
                    {!isEditing && (
                      <div className='flex items-center gap-6px opacity-0 group-hover:opacity-100 transition-opacity' onClick={(event) => event.stopPropagation()}>
                        <span
                          className='flex items-center justify-center'
                          onClick={() => {
                            handleEditStart(project);
                          }}
                        >
                          <EditOne theme='outline' size='14' />
                        </span>
                        <Popconfirm title={t('project.deleteTitle', { defaultValue: 'Delete project' })} content={t('project.deleteConfirm', { defaultValue: 'This will remove all files, conversations, and the local folder.' })} onOk={() => confirmDeleteProject(project)}>
                          <span className='flex items-center justify-center'>
                            <DeleteOne theme='outline' size='14' />
                          </span>
                        </Popconfirm>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className='flex items-center gap-12px text-12px text-t-secondary'>
            <span className='flex items-center gap-6px'>
              <span className={`inline-block size-6px rounded-full ${statusDot(jiraStatus)}`} />
              JIRA
            </span>
            <span className='flex items-center gap-6px'>
              <span className={`inline-block size-6px rounded-full ${statusDot(mcpStatus)}`} />
              MCP
            </span>
          </div>
        </>
      )}
      <div className='flex items-center justify-between gap-8px'>
        <button type='button' className='flex items-center gap-8px px-6px py-4px rounded-6px text-12px text-t-secondary hover:bg-hover transition-colors' onClick={() => setIsWorkspaceTreeCollapsed((prev) => !prev)} aria-expanded={!isWorkspaceTreeCollapsed}>
          <Down size={14} fill={iconColors.secondary} className={`line-height-0 transition-transform duration-200 flex-shrink-0 ${isWorkspaceTreeCollapsed ? '-rotate-90' : 'rotate-0'}`} />
          <span className='font-medium'>{t('project.workspace', { defaultValue: '工作区' })}</span>
        </button>
      </div>
      {!isWorkspaceTreeCollapsed && (
        <>
          {loading ? (
            <div className='flex items-center justify-center h-120px'>
              <Spin loading />
            </div>
          ) : !workspace ? (
            <Empty description={t('project.empty', { defaultValue: '暂无项目' })} />
          ) : treeData.length === 0 ? (
            <Empty description={t('project.aiNotFound', { defaultValue: '未找到 .ai' })} />
          ) : (
            <Tree
              className='workspace-tree !pl-0 !pr-0'
              treeData={treeData}
              blockNode
              expandedKeys={expandedKeys}
              renderTitle={(node) => {
                const isFile = Boolean(node.isLeaf);
                const icon = isFile ? <FileText theme='outline' size={14} fill={iconColors.secondary} className='flex-shrink-0' /> : <FolderOpen theme='outline' size={14} fill={iconColors.primary} className='flex-shrink-0' />;
                return (
                  <span className='flex items-center gap-6px min-w-0' style={{ color: 'inherit' }}>
                    {icon}
                    <span className={`truncate ${isFile ? 'text-t-secondary font-normal' : 'text-t-primary font-medium'}`}>{String(node.title)}</span>
                  </span>
                );
              }}
              onSelect={handleSelect}
              onExpand={(keys) => setExpandedKeys(keys)}
            />
          )}
        </>
      )}
    </div>
  );
};

export default ProjectModePanel;
