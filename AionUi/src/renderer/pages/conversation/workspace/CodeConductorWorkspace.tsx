/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useState } from 'react';
import { Tabs } from '@arco-design/web-react';
import LiveSpecTab from './LiveSpecTab';
import TerminalTab from './TerminalTab';
import DiffTab from './DiffTab';
import { dispatchTerminalRunEvent } from '@/renderer/utils/terminalEvents';

const TERMINAL_COMMAND = 'claude --prompt-file .ai/tasks/current_task.md';

const CodeConductorWorkspace: React.FC<{
  workspace: string;
}> = ({ workspace }) => {
  const [activeTab, setActiveTab] = useState('spec');

  const handleApproveExecute = useCallback(() => {
    setActiveTab('terminal');
    dispatchTerminalRunEvent({ workspace, command: TERMINAL_COMMAND });
  }, [workspace]);

  return (
    <div className='h-full w-full overflow-hidden'>
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        type='capsule'
        size='small'
        destroyOnHide={false}
        className='h-full'
      >
        <Tabs.TabPane key='spec' title='Live Spec'>
          <div className='h-full'>
            <LiveSpecTab workspace={workspace} onApproveExecute={handleApproveExecute} />
          </div>
        </Tabs.TabPane>
        <Tabs.TabPane key='terminal' title='Terminal'>
          <div className='h-full'>
            <TerminalTab workspace={workspace} active={activeTab === 'terminal'} />
          </div>
        </Tabs.TabPane>
        <Tabs.TabPane key='diff' title='Diff'>
          <div className='h-full'>
            <DiffTab workspace={workspace} active={activeTab === 'diff'} />
          </div>
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default CodeConductorWorkspace;
