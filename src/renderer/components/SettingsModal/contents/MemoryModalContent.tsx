/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConfigStorage, type IConfigStorageRefer } from '@/common/storage';
import { mem0Service as mem0Ipc } from '@/common/ipcBridge';
import { Divider, Form, Switch, Input, Message, Button, Modal, List, Empty, Spin, InputNumber } from '@arco-design/web-react';
import { Delete, Refresh } from '@icon-park/react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AionScrollArea from '@/renderer/components/base/AionScrollArea';
import { useSettingsViewMode } from '../settingsViewContext';
import classNames from 'classnames';

type Mem0Config = NonNullable<IConfigStorageRefer['tools.mem0']>;

interface MemoryItem {
  id: string;
  memory: string;
  created_at: string;
}

const DEFAULT_CONFIG: Mem0Config = {
  enabled: false,
  baseUrl: 'https://api.mem0.ai',
  apiKey: '',
  userId: '',
  retrievalEnabled: false,
  autoAddEnabled: false,
  retrievalLimit: 5,
};

const MemoryModalContent: React.FC = () => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<Mem0Config>(DEFAULT_CONFIG);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [memoryToDelete, setMemoryToDelete] = useState<string | null>(null);

  const viewMode = useSettingsViewMode();
  const isPageMode = viewMode === 'page';

  // Load config on mount
  useEffect(() => {
    ConfigStorage.get('tools.mem0')
      .then((data) => {
        if (data) {
          setConfig({ ...DEFAULT_CONFIG, ...data });
        }
      })
      .catch((error) => {
        console.error('Failed to load Mem0 config:', error);
      });
  }, []);

  // Handle config changes
  const handleConfigChange = useCallback((updates: Partial<Mem0Config>) => {
    setConfig((prev) => {
      const newConfig = { ...prev, ...updates };
      ConfigStorage.set('tools.mem0', newConfig).catch((error) => {
        console.error('Failed to save Mem0 config:', error);
      });
      return newConfig;
    });
  }, []);

  // Load memories
  const loadMemories = useCallback(async () => {
    if (!config.enabled || !config.apiKey || !config.userId) {
      return;
    }
    setLoading(true);
    try {
      const result = await mem0Ipc.getAll.invoke();
      if (result.success && result.data) {
        setMemories(result.data.memories);
      } else {
        Message.error(result.msg || t('settings.mem0LoadFailed'));
      }
    } catch (error) {
      Message.error(t('settings.mem0LoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [config.enabled, config.apiKey, config.userId, t]);

  // Delete memory
  const handleDeleteMemory = useCallback(async () => {
    if (!memoryToDelete) return;
    try {
      const result = await mem0Ipc.delete.invoke({ memoryId: memoryToDelete });
      if (result.success) {
        setMemories((prev) => prev.filter((m) => m.id !== memoryToDelete));
        Message.success(t('settings.mem0DeleteSuccess'));
      } else {
        Message.error(result.msg || t('settings.mem0DeleteFailed'));
      }
    } catch (error) {
      Message.error(t('settings.mem0DeleteFailed'));
    } finally {
      setDeleteConfirmVisible(false);
      setMemoryToDelete(null);
    }
  }, [memoryToDelete, t]);

  // Check if configuration is complete
  const isConfigComplete = config.baseUrl && config.apiKey && config.userId;

  return (
    <div className='flex flex-col h-full w-full'>
      <AionScrollArea className='flex-1 min-h-0 pb-16px' disableOverflow={isPageMode}>
        <div className='space-y-16px'>
          {/* Mem0 Configuration Section */}
          <div className='px-[12px] md:px-[32px] py-[24px] bg-2 rd-12px md:rd-16px border border-border-2'>
            <div className='flex items-center justify-between mb-16px'>
              <span className='text-14px text-t-primary'>{t('settings.mem0Config')}</span>
              <Switch disabled={!isConfigComplete} checked={config.enabled} onChange={(checked) => handleConfigChange({ enabled: checked })} />
            </div>

            <Divider className='mt-0px mb-20px' />

            <Form layout='vertical' className='space-y-16px'>
              <Form.Item label={t('settings.mem0BaseUrl')}>
                <Input value={config.baseUrl} onChange={(value) => handleConfigChange({ baseUrl: value })} placeholder='https://api.mem0.ai' />
              </Form.Item>

              <Form.Item label={t('settings.mem0ApiKey')}>
                <Input.Password value={config.apiKey} onChange={(value) => handleConfigChange({ apiKey: value })} placeholder={t('settings.mem0ApiKeyPlaceholder')} />
              </Form.Item>

              <Form.Item label={t('settings.mem0UserId')}>
                <Input value={config.userId} onChange={(value) => handleConfigChange({ userId: value })} placeholder={t('settings.mem0UserIdPlaceholder')} />
              </Form.Item>

              <Form.Item label={t('settings.mem0RetrievalLimit')}>
                <InputNumber min={1} max={20} value={config.retrievalLimit} onChange={(value) => handleConfigChange({ retrievalLimit: value || 5 })} placeholder='5' />
              </Form.Item>
            </Form>
          </div>

          {/* Memory Retrieval Settings */}
          <div className='px-[12px] md:px-[32px] py-[24px] bg-2 rd-12px md:rd-16px border border-border-2'>
            <div className='flex items-center justify-between'>
              <div>
                <div className='text-14px text-t-primary'>{t('settings.mem0RetrievalEnabled')}</div>
                <div className='text-12px text-t-secondary mt-4px'>{t('settings.mem0RetrievalEnabledDesc')}</div>
              </div>
              <Switch disabled={!config.enabled} checked={config.retrievalEnabled} onChange={(checked) => handleConfigChange({ retrievalEnabled: checked })} />
            </div>
          </div>

          {/* Auto Memory Storage Settings */}
          <div className='px-[12px] md:px-[32px] py-[24px] bg-2 rd-12px md:rd-16px border border-border-2'>
            <div className='flex items-center justify-between'>
              <div>
                <div className='text-14px text-t-primary'>{t('settings.mem0AutoAddEnabled')}</div>
                <div className='text-12px text-t-secondary mt-4px'>{t('settings.mem0AutoAddEnabledDesc')}</div>
              </div>
              <Switch disabled={!config.enabled} checked={config.autoAddEnabled} onChange={(checked) => handleConfigChange({ autoAddEnabled: checked })} />
            </div>
          </div>

          {/* Memory List Section */}
          {config.enabled && isConfigComplete && (
            <div className='px-[12px] md:px-[32px] py-[24px] bg-2 rd-12px md:rd-16px border border-border-2'>
              <div className='flex items-center justify-between mb-16px'>
                <span className='text-14px text-t-primary'>{t('settings.mem0MemoryList')}</span>
                <Button type='outline' icon={<Refresh size='16' />} shape='round' loading={loading} onClick={loadMemories}>
                  {t('common.reload')}
                </Button>
              </div>

              <Divider className='mt-0px mb-16px' />

              <Spin loading={loading} className='w-full'>
                {memories.length === 0 ? (
                  <Empty description={t('settings.mem0NoMemories')} />
                ) : (
                  <AionScrollArea className={classNames('max-h-360px', isPageMode && 'max-h-none')}>
                    <List
                      dataSource={memories}
                      render={(item) => (
                        <List.Item
                          key={item.id}
                          actions={[
                            <Button
                              key='delete'
                              type='text'
                              status='danger'
                              icon={<Delete size='16' />}
                              onClick={() => {
                                setMemoryToDelete(item.id);
                                setDeleteConfirmVisible(true);
                              }}
                            />,
                          ]}
                        >
                          <div>
                            <div className='text-14px text-t-primary'>{item.memory}</div>
                            <div className='text-12px text-t-secondary mt-4px'>{new Date(item.created_at).toLocaleString()}</div>
                          </div>
                        </List.Item>
                      )}
                    />
                  </AionScrollArea>
                )}
              </Spin>
            </div>
          )}
        </div>
      </AionScrollArea>

      {/* Delete Confirmation Modal */}
      <Modal
        title={t('settings.mem0DeleteMemory')}
        visible={deleteConfirmVisible}
        onCancel={() => {
          setDeleteConfirmVisible(false);
          setMemoryToDelete(null);
        }}
        onOk={handleDeleteMemory}
        okButtonProps={{ status: 'danger' }}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
      >
        <p>{t('settings.mem0DeleteConfirm')}</p>
      </Modal>
    </div>
  );
};

export default MemoryModalContent;
