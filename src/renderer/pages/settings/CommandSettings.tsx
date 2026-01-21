/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Divider, Input, Message, Modal } from '@arco-design/web-react';
import SettingsPageWrapper from './components/SettingsPageWrapper';
import { ConfigStorage, type CustomCommandConfig } from '@/common/storage';
import { useSlashCommands } from '@/renderer/hooks/useSlashCommands';
import { parseCommandMarkdown } from '@/renderer/utils/commandRegistry';
import { uuid } from '@/common/utils';

const DEFAULT_TEMPLATE = `---
description: Describe what this command does
argument-hint: [args]
---
Explain the task and include $ARGUMENTS or $1..$9 placeholders as needed.`;

const isValidCommandName = (value: string) => {
  if (!value) return false;
  if (value.includes('/') || /\s/.test(value)) return false;
  return true;
};

const CommandSettings: React.FC = () => {
  const [message, messageContext] = Message.useMessage();
  const [customCommands, setCustomCommands] = useState<CustomCommandConfig[]>([]);
  const [editingCommand, setEditingCommand] = useState<CustomCommandConfig | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftContent, setDraftContent] = useState(DEFAULT_TEMPLATE);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { commands, reload, externalStats } = useSlashCommands();

  const loadCustomCommands = useCallback(async () => {
    const list = ((await ConfigStorage.get('commands.custom')) || []) as CustomCommandConfig[];
    setCustomCommands(list);
  }, []);

  useEffect(() => {
    void loadCustomCommands();
  }, [loadCustomCommands]);

  const externalCommands = useMemo(() => {
    return commands.filter((command) => ['cursor', 'claude', 'codex', 'superpowers'].includes(command.source));
  }, [commands]);

  const handleCreate = useCallback(() => {
    setEditingCommand(null);
    setDraftName('');
    setDraftContent(DEFAULT_TEMPLATE);
    setIsModalOpen(true);
  }, []);

  const handleEdit = useCallback((command: CustomCommandConfig) => {
    setEditingCommand(command);
    setDraftName(command.name);
    setDraftContent(command.content || DEFAULT_TEMPLATE);
    setIsModalOpen(true);
  }, []);

  const handleDelete = useCallback(
    (command: CustomCommandConfig) => {
      Modal.confirm({
        title: 'Delete command?',
        content: `/${command.name}`,
        onOk: async () => {
          const next = customCommands.filter((item) => item.id !== command.id);
          await ConfigStorage.set('commands.custom', next);
          setCustomCommands(next);
          await reload();
          message.success('Command deleted');
        },
      });
    },
    [customCommands, message, reload]
  );

  const handleSave = useCallback(async () => {
    const name = draftName.trim();
    if (!isValidCommandName(name)) {
      message.warning('Command name is required and cannot contain spaces or "/"');
      return;
    }
    const existing = customCommands.find((item) => item.name === name && item.id !== editingCommand?.id);
    if (existing) {
      message.warning('Command name already exists');
      return;
    }
    const now = Date.now();
    const next = editingCommand
      ? customCommands.map((item) => (item.id === editingCommand.id ? { ...item, name, content: draftContent, updatedAt: now } : item))
      : [
          ...customCommands,
          {
            id: uuid(),
            name,
            content: draftContent,
            createdAt: now,
            updatedAt: now,
          },
        ];
    await ConfigStorage.set('commands.custom', next);
    setCustomCommands(next);
    await reload();
    setIsModalOpen(false);
    message.success(editingCommand ? 'Command updated' : 'Command created');
  }, [customCommands, draftContent, draftName, editingCommand, message, reload]);

  return (
    <SettingsPageWrapper contentClassName='max-w-1200px'>
      {messageContext}
      <div className='space-y-16px'>
        <div className='bg-2 rd-16px px-20px py-16px space-y-12px'>
          <div className='flex items-center justify-between'>
            <div className='text-14px text-t-primary'>Custom Commands</div>
            <div className='flex items-center gap-8px'>
              <Button size='mini' onClick={() => void reload()}>
                Refresh
              </Button>
              <Button type='primary' size='mini' onClick={handleCreate}>
                Add Command
              </Button>
            </div>
          </div>
          <Divider className='my-12px' />
          {customCommands.length === 0 ? (
            <div className='text-12px text-t-secondary'>No custom commands yet.</div>
          ) : (
            <div className='space-y-8px'>
              {customCommands.map((command) => {
                const parsed = parseCommandMarkdown(command.content || '');
                return (
                  <div key={command.id} className='flex items-start justify-between bg-bg-1 px-12px py-10px rd-8px border border-border-2'>
                    <div className='text-12px text-t-secondary'>
                      <div className='text-13px text-t-primary'>/{command.name}</div>
                      <div className='mt-4px'>{parsed.description || 'No description'}</div>
                      {parsed.argumentHint && <div className='mt-4px'>Args: {parsed.argumentHint}</div>}
                    </div>
                    <div className='flex items-center gap-6px'>
                      <Button size='mini' onClick={() => handleEdit(command)}>
                        Edit
                      </Button>
                      <Button size='mini' status='danger' onClick={() => handleDelete(command)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className='bg-2 rd-16px px-20px py-16px space-y-12px'>
          <div className='flex items-center justify-between'>
            <div className='text-14px text-t-primary'>External Commands</div>
            <Button size='mini' onClick={() => void reload()}>
              Refresh
            </Button>
          </div>
          <div className='text-12px text-t-secondary space-y-2px'>
            <div>
              Cursor: {externalStats.cursor.count} | {externalStats.cursor.dir || '-'}
            </div>
            <div>
              Claude: {externalStats.claude.count} | {externalStats.claude.dir || '-'}
            </div>
            <div>
              Codex: {externalStats.codex.count} | {externalStats.codex.dir || '-'}
            </div>
            <div>
              Superpowers: {externalStats.superpowers.count} | {externalStats.superpowers.dir || '-'}
            </div>
          </div>
          <Divider className='my-12px' />
          {externalCommands.length === 0 ? (
            <div className='text-12px text-t-secondary'>No external commands found.</div>
          ) : (
            <div className='space-y-8px'>
              {externalCommands.map((command) => (
                <div key={command.id} className='bg-bg-1 px-12px py-10px rd-8px border border-border-2'>
                  <div className='flex items-center justify-between text-12px text-t-secondary'>
                    <div className='text-13px text-t-primary'>/{command.trigger}</div>
                    <div className='uppercase'>{command.source}</div>
                  </div>
                  <div className='mt-4px text-12px text-t-secondary'>{command.description || 'No description'}</div>
                  {command.argumentHint && <div className='mt-4px text-12px text-t-secondary'>Args: {command.argumentHint}</div>}
                  {command.sourcePath && <div className='mt-4px text-11px text-t-secondary'>Path: {command.sourcePath}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal title={editingCommand ? 'Edit Command' : 'Add Command'} visible={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={() => void handleSave()} okText='Save' cancelText='Cancel' style={{ width: 720 }}>
        <div className='space-y-12px'>
          <div>
            <div className='text-12px text-t-secondary mb-6px'>Command name</div>
            <Input value={draftName} onChange={setDraftName} placeholder='example-command' />
          </div>
          <div>
            <div className='text-12px text-t-secondary mb-6px'>Markdown content</div>
            <Input.TextArea value={draftContent} onChange={setDraftContent} autoSize={{ minRows: 8, maxRows: 16 }} />
          </div>
        </div>
      </Modal>
    </SettingsPageWrapper>
  );
};

export default CommandSettings;
