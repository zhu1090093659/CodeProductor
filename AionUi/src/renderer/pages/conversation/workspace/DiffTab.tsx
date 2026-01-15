/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { Empty, Spin } from '@arco-design/web-react';
import React, { useEffect, useState } from 'react';
import DiffPreview from '@/renderer/pages/conversation/preview/components/viewers/DiffViewer';

const DiffTab: React.FC<{ workspace: string; active: boolean }> = ({ workspace, active }) => {
  const [loading, setLoading] = useState(false);
  const [diffContent, setDiffContent] = useState('');

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    ipcBridge.git
      .diff.invoke({ cwd: workspace })
      .then((res) => {
        if (res?.success) {
          setDiffContent(res.data?.diff || '');
        } else {
          setDiffContent('');
        }
      })
      .finally(() => setLoading(false));
  }, [workspace, active]);

  if (loading) {
    return (
      <div className='flex items-center justify-center h-full'>
        <Spin loading />
      </div>
    );
  }

  if (!diffContent) {
    return (
      <div className='flex items-center justify-center h-full'>
        <Empty description='No diff available' />
      </div>
    );
  }

  return <DiffPreview content={diffContent} hideToolbar />;
};

export default DiffTab;
