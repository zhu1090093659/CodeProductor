/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { ConfigStorage } from '@/common/storage';
import type { IDirOrFile } from '@/common/ipcBridge';
import type { PreviewContentType } from '@/common/types/preview';
import { usePreviewContext } from '@/renderer/pages/conversation/preview';
import { useConversationTabs } from '@/renderer/pages/conversation/context/ConversationTabsContext';
import { Empty, Spin, Switch, Tree } from '@arco-design/web-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

interface TreeNode {
  key: string;
  title: string;
  isLeaf?: boolean;
  children?: TreeNode[];
  data?: IDirOrFile;
}

const getContentType = (fileName: string): PreviewContentType => {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (ext === 'diff' || ext === 'patch') return 'diff';
  if (ext === 'pdf') return 'pdf';
  if (['ppt', 'pptx', 'odp'].includes(ext)) return 'ppt';
  if (['doc', 'docx', 'odt'].includes(ext)) return 'word';
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext)) return 'excel';
  if (['html', 'htm'].includes(ext)) return 'html';
  if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tif', 'tiff', 'avif'].includes(ext)) return 'image';
  return 'code';
};

const buildTreeNodes = (node: IDirOrFile): TreeNode => ({
  key: node.relativePath || node.fullPath || node.name,
  title: node.name,
  isLeaf: node.isFile,
  data: node,
  children: node.children?.map(buildTreeNodes),
});

const ProjectModePanel: React.FC = () => {
  const { openPreview } = usePreviewContext();
  const { activeTab } = useConversationTabs();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [jiraStatus, setJiraStatus] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [mcpStatus, setMcpStatus] = useState<'unknown' | 'ok' | 'error'>('unknown');

  const workspace = activeTab?.workspace;
  const conversationId = activeTab?.id;

  const refreshTree = useCallback(async () => {
    if (!workspace || !conversationId) return;
    setLoading(true);
    try {
      const res = await ipcBridge.conversation.getWorkspace.invoke({ conversation_id: conversationId, workspace, path: workspace });
      const root = res?.[0];
      const aiNode = root?.children?.find((child) => child.name === '.ai');
      if (aiNode) {
        setTreeData([buildTreeNodes(aiNode)]);
      } else {
        setTreeData([]);
      }
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
    if (!enabled) return;
    void refreshTree();
    void refreshStatus();
  }, [enabled, refreshTree, refreshStatus]);

  const handleSelect = useCallback(
    async (_keys: string[], info: any) => {
      const node: TreeNode | undefined = info?.node;
      const nodeData = node?.data;
      if (!nodeData?.isFile || !nodeData.fullPath) return;
      const contentType = getContentType(nodeData.name);
      let content = '';
      if (contentType === 'image') {
        content = await ipcBridge.fs.getImageBase64.invoke({ path: nodeData.fullPath });
      } else if (!['pdf', 'word', 'excel', 'ppt'].includes(contentType)) {
        content = await ipcBridge.fs.readFile.invoke({ path: nodeData.fullPath });
      }
      openPreview(content, contentType, {
        title: nodeData.name,
        fileName: nodeData.name,
        filePath: nodeData.fullPath,
        workspace,
        language: nodeData.name.split('.').pop(),
        editable: contentType === 'markdown' || contentType === 'image' ? false : undefined,
      });
    },
    [openPreview, workspace]
  );

  const statusDot = useCallback((status: 'unknown' | 'ok' | 'error') => {
    if (status === 'ok') return 'bg-green-500';
    if (status === 'error') return 'bg-red-500';
    return 'bg-gray-400';
  }, []);

  return (
    <div className='px-12px py-10px flex flex-col gap-12px'>
      <div className='flex items-center justify-between'>
        <span className='text-12px text-t-secondary'>Project Mode</span>
        <Switch size='small' checked={enabled} onChange={setEnabled} />
      </div>
      {enabled && (
        <>
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
          {loading ? (
            <div className='flex items-center justify-center h-120px'>
              <Spin loading />
            </div>
          ) : treeData.length === 0 ? (
            <Empty description='.ai not found' />
          ) : (
            <Tree treeData={treeData} onSelect={handleSelect} blockNode />
          )}
        </>
      )}
    </div>
  );
};

export default ProjectModePanel;
