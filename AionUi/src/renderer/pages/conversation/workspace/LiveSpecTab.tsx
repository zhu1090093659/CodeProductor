/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { Button } from '@arco-design/web-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import MarkdownPreview from '@/renderer/pages/conversation/preview/components/viewers/MarkdownViewer';
import { joinPath } from '@/renderer/utils/path';

const readFileSafe = async (filePath: string) => {
  try {
    return await ipcBridge.fs.readFile.invoke({ path: filePath });
  } catch {
    return '';
  }
};

const LiveSpecTab: React.FC<{
  workspace: string;
  onApproveExecute: () => void;
}> = ({ workspace, onApproveExecute }) => {
  const specPath = useMemo(() => joinPath(workspace, '.ai', 'specs', 'tech_spec.md'), [workspace]);
  const taskPath = useMemo(() => joinPath(workspace, '.ai', 'tasks', 'current_task.md'), [workspace]);
  const [specContent, setSpecContent] = useState('');
  const [taskContent, setTaskContent] = useState('');

  const refreshContent = useCallback(async () => {
    const [spec, task] = await Promise.all([readFileSafe(specPath), readFileSafe(taskPath)]);
    setSpecContent(spec || '');
    setTaskContent(task || '');
  }, [specPath, taskPath]);

  useEffect(() => {
    void refreshContent();
  }, [refreshContent]);

  useEffect(() => {
    void ipcBridge.fileWatch.startWatch.invoke({ filePath: specPath });
    void ipcBridge.fileWatch.startWatch.invoke({ filePath: taskPath });
    const unsubscribe = ipcBridge.fileWatch.fileChanged.on((payload) => {
      if (payload.filePath === specPath || payload.filePath === taskPath) {
        void refreshContent();
      }
    });
    return () => {
      void ipcBridge.fileWatch.stopWatch.invoke({ filePath: specPath });
      void ipcBridge.fileWatch.stopWatch.invoke({ filePath: taskPath });
      unsubscribe?.();
    };
  }, [refreshContent, specPath, taskPath]);

  return (
    <div className='relative h-full w-full overflow-hidden'>
      <div className='absolute right-12px top-12px z-10'>
        <Button type='primary' onClick={onApproveExecute}>
          Approve & Execute
        </Button>
      </div>
      <div className='h-full overflow-auto p-12px space-y-12px'>
        <div className='rounded-8px border border-[var(--bg-3)] overflow-hidden'>
          <div className='h-32px px-12px flex items-center bg-bg-2 text-12px text-t-secondary'>tech_spec.md</div>
          <div className='p-12px'>
            <MarkdownPreview content={specContent} hideToolbar filePath={specPath} />
          </div>
        </div>
        <div className='rounded-8px border border-[var(--bg-3)] overflow-hidden'>
          <div className='h-32px px-12px flex items-center bg-bg-2 text-12px text-t-secondary'>current_task.md</div>
          <div className='p-12px'>
            <MarkdownPreview content={taskContent} hideToolbar filePath={taskPath} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveSpecTab;
