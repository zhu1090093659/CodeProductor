/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import MemoryModalContent from '@/renderer/components/SettingsModal/contents/MemoryModalContent';
import SettingsPageWrapper from './components/SettingsPageWrapper';

const MemorySettings: React.FC = () => {
  return (
    <SettingsPageWrapper contentClassName='max-w-1200px'>
      <MemoryModalContent />
    </SettingsPageWrapper>
  );
};

export default MemorySettings;
