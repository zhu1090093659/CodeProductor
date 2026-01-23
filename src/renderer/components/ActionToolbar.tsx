/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Dropdown, Menu, Tooltip } from '@arco-design/web-react';
import { Plus } from '@icon-park/react';
import type { TFunction } from 'i18next';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { IProvider, TProviderWithModel } from '@/common/storage';

interface ActionToolbarProps {
  // Interactive mode state
  interactiveMode: boolean;
  onInteractiveModeToggle: () => void;

  // Collab mode state (only for showing Collab button)
  showCollabButton: boolean;
  onCollabButtonClick: () => void;

  // Model selection
  modelList?: IProvider[];
  currentModel?: TProviderWithModel;
  onModelSelect?: (model: TProviderWithModel) => void;
  isModelLoading?: boolean;

  // Visibility control
  showInteractiveToggle?: boolean;
  showModelSelector?: boolean;

  // i18n
  t: TFunction;
}

/**
 * Get available models from a provider
 */
const getAvailableModels = (provider: IProvider): string[] => {
  if (!provider.model || !Array.isArray(provider.model)) return [];
  return provider.model;
};

const ActionToolbar: React.FC<ActionToolbarProps> = ({ interactiveMode, onInteractiveModeToggle, showCollabButton, onCollabButtonClick, modelList, currentModel, onModelSelect, isModelLoading, showInteractiveToggle = true, showModelSelector = true, t }) => {
  const navigate = useNavigate();

  // Don't render if nothing to show
  if (!showInteractiveToggle && !showCollabButton && !showModelSelector) {
    return null;
  }

  // Get display name for current model
  const getModelDisplayName = () => {
    if (!currentModel) return t('conversation.welcome.selectModel', { defaultValue: 'Select Model' });
    if (currentModel.id?.startsWith('cli:') && currentModel.useModel === 'default') {
      return t('common.default', { defaultValue: 'Default' });
    }
    return currentModel.useModel;
  };

  return (
    <div className='flex items-center gap-8px mt-12px'>
      {/* Model selector dropdown */}
      {showModelSelector && (
        <Dropdown
          trigger='hover'
          droplist={
            <Menu selectedKeys={currentModel ? [currentModel.id + currentModel.useModel] : []}>
              {!modelList || modelList.length === 0
                ? [
                    <Menu.Item key='no-models' className='px-12px py-12px text-t-secondary text-14px text-center flex justify-center items-center' disabled>
                      {isModelLoading ? t('common.loading', { defaultValue: 'Loading...' }) : t('settings.noAvailableModels', { defaultValue: 'No available models' })}
                    </Menu.Item>,
                    <Menu.Item key='add-model' className='text-12px text-t-secondary' onClick={() => navigate('/settings/model')}>
                      <Plus theme='outline' size='12' />
                      {t('settings.addProvider', { defaultValue: 'Add Provider' })}
                    </Menu.Item>,
                  ]
                : [
                    ...modelList.map((provider) => {
                      const availableModels = getAvailableModels(provider);
                      if (availableModels.length === 0) return null;
                      return (
                        <Menu.ItemGroup title={provider.name} key={provider.id}>
                          {availableModels.map((modelName) => (
                            <Menu.Item
                              key={provider.id + modelName}
                              className={currentModel?.id + currentModel?.useModel === provider.id + modelName ? '!bg-2' : ''}
                              onClick={() => {
                                if (onModelSelect) {
                                  onModelSelect({ ...provider, useModel: modelName });
                                }
                              }}
                            >
                              {provider.id?.startsWith('cli:') && modelName === 'default' ? t('common.default', { defaultValue: 'Default' }) : modelName}
                            </Menu.Item>
                          ))}
                        </Menu.ItemGroup>
                      );
                    }),
                    <Menu.Item key='add-model' className='text-12px text-t-secondary' onClick={() => navigate('/settings/model')}>
                      <Plus theme='outline' size='12' />
                      {t('settings.addProvider', { defaultValue: 'Add Provider' })}
                    </Menu.Item>,
                  ]}
            </Menu>
          }
        >
          <Button className='sendbox-model-btn' shape='round'>
            {getModelDisplayName()}
          </Button>
        </Dropdown>
      )}

      {/* Interactive button */}
      {showInteractiveToggle && (
        <Tooltip content={t('conversation.interactiveModeTooltip', { defaultValue: 'Interactive requirement discovery' })}>
          <Button shape='round' type='secondary' size='mini' className={`collab-enable-btn ${interactiveMode ? 'mode-toggle-active' : ''}`} onClick={onInteractiveModeToggle}>
            {t('conversation.interactiveMode', { defaultValue: 'Interactive' })}
          </Button>
        </Tooltip>
      )}

      {/* Collab button */}
      {showCollabButton && (
        <Tooltip content='Enable PM/Analyst/Engineer collaboration'>
          <Button shape='round' type='secondary' size='mini' className='collab-enable-btn' onClick={onCollabButtonClick}>
            Collab
          </Button>
        </Tooltip>
      )}
    </div>
  );
};

export default ActionToolbar;
