/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Divider, Form, Input, Message, Tabs } from '@arco-design/web-react';
import SettingsPageWrapper from './components/SettingsPageWrapper';
import { ipcBridge } from '@/common';
import { ConfigStorage, type SkillRepoConfig } from '@/common/storage';
import type { AcpBackend } from '@/types/acpTypes';

type SkillInfo = { name: string; description: string; location: string };

const AGENTS: Array<{ key: AcpBackend; label: string }> = [
  { key: 'claude', label: 'Claude Code' },
  { key: 'codex', label: 'Codex' },
  { key: 'gemini', label: 'Gemini' },
];

const SkillSettings: React.FC = () => {
  const [message, messageContext] = Message.useMessage();
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [repos, setRepos] = useState<SkillRepoConfig[]>([]);
  const [enabledByAgent, setEnabledByAgent] = useState<Record<string, string[]>>({});
  const [newRepo, setNewRepo] = useState<Pick<SkillRepoConfig, 'url' | 'branch' | 'subdir'>>({ url: '', branch: '', subdir: '' });

  const loadSkills = useCallback(async () => {
    const list = await ipcBridge.fs.listAvailableSkills.invoke();
    setSkills(list || []);
  }, []);

  useEffect(() => {
    loadSkills().catch(() => {
      setSkills([]);
    });
  }, [loadSkills]);

  useEffect(() => {
    ConfigStorage.get('skills.repos')
      .then((data) => setRepos(data || []))
      .catch(() => setRepos([]));
    ConfigStorage.get('skills.enabledByAgent')
      .then((data) => setEnabledByAgent(data || {}))
      .catch(() => setEnabledByAgent({}));
  }, []);

  const saveRepos = useCallback(async (next: SkillRepoConfig[]) => {
    setRepos(next);
    await ConfigStorage.set('skills.repos', next);
  }, []);

  const saveEnabled = useCallback(async (next: Record<string, string[]>) => {
    setEnabledByAgent(next);
    await ConfigStorage.set('skills.enabledByAgent', next);
  }, []);

  const handleSyncRepos = useCallback(async () => {
    const result = await ipcBridge.skills.syncRepos.invoke({ repos });
    if (result.success && result.data) {
      await saveRepos(result.data.repos);
      await loadSkills();
      if (result.data.errors?.length) {
        message.warning(`Some repos failed: ${result.data.errors.map((e) => e.id).join(', ')}`);
      } else {
        message.success('Repos synced');
      }
      return;
    }
    message.error(result.msg || 'Failed to sync repos');
  }, [repos, saveRepos, loadSkills, message]);

  const handleAddRepo = useCallback(async () => {
    if (!newRepo.url.trim()) {
      message.warning('Repository URL is required');
      return;
    }
    const repo: SkillRepoConfig = {
      id: String(Date.now()),
      url: newRepo.url.trim(),
      branch: newRepo.branch?.trim() || undefined,
      subdir: newRepo.subdir?.trim() || undefined,
    };
    const next = [...repos, repo];
    await saveRepos(next);
    setNewRepo({ url: '', branch: '', subdir: '' });
  }, [newRepo, repos, saveRepos, message]);

  const handleRemoveRepo = useCallback(
    async (repoId: string) => {
      const next = repos.filter((r) => r.id !== repoId);
      await saveRepos(next);
    },
    [repos, saveRepos]
  );

  const renderSkillList = (agentKey: AcpBackend) => {
    const enabled = new Set(enabledByAgent[agentKey] || []);
    return (
      <div className='grid grid-cols-2 gap-10px'>
        {sortedSkills.map((skill) => {
          const isChecked = enabled.has(skill.name);
          return (
            <div
              key={`${agentKey}-${skill.name}`}
              className='p-12px rounded-8px bg-bg-1 border border-border-2 cursor-pointer'
              onClick={() => {
                const nextEnabled = new Set(enabled);
                if (isChecked) {
                  nextEnabled.delete(skill.name);
                } else {
                  nextEnabled.add(skill.name);
                }
                void saveEnabled({ ...enabledByAgent, [agentKey]: Array.from(nextEnabled) });
              }}
            >
              <div className='flex items-center gap-8px'>
                <Checkbox checked={isChecked} onChange={() => {}} />
                <span className='text-13px font-medium text-t-primary'>{skill.name}</span>
              </div>
              {skill.description && <div className='text-12px text-t-secondary mt-6px ml-24px line-clamp-2'>{skill.description}</div>}
            </div>
          );
        })}
      </div>
    );
  };

  const sortedSkills = useMemo(() => {
    return [...skills].sort((a, b) => a.name.localeCompare(b.name));
  }, [skills]);

  return (
    <SettingsPageWrapper contentClassName='max-w-1200px'>
      {messageContext}
      <div className='space-y-16px'>
        <div className='bg-2 rd-16px px-20px py-16px space-y-12px'>
          <div className='text-14px text-t-primary'>Skill Repositories</div>
          <Form layout='inline' className='gap-8px'>
            <Form.Item>
              <Input placeholder='Repo URL' value={newRepo.url} onChange={(value) => setNewRepo((prev) => ({ ...prev, url: value }))} />
            </Form.Item>
            <Form.Item>
              <Input placeholder='Branch (optional)' value={newRepo.branch} onChange={(value) => setNewRepo((prev) => ({ ...prev, branch: value }))} />
            </Form.Item>
            <Form.Item>
              <Input placeholder='Subdir (optional)' value={newRepo.subdir} onChange={(value) => setNewRepo((prev) => ({ ...prev, subdir: value }))} />
            </Form.Item>
            <Form.Item>
              <Button type='primary' onClick={handleAddRepo}>
                Add Repo
              </Button>
            </Form.Item>
            <Form.Item>
              <Button onClick={handleSyncRepos}>Sync Repos</Button>
            </Form.Item>
          </Form>
          <Divider className='my-12px' />
          {repos.length === 0 ? (
            <div className='text-12px text-t-secondary'>No repositories configured.</div>
          ) : (
            <div className='space-y-8px'>
              {repos.map((repo) => (
                <div key={repo.id} className='flex items-center justify-between bg-bg-1 px-12px py-8px rd-8px border border-border-2'>
                  <div className='text-12px text-t-secondary'>
                    <div className='text-13px text-t-primary'>{repo.url}</div>
                    <div>
                      {repo.branch ? `branch: ${repo.branch}` : 'branch: default'} {repo.subdir ? `| subdir: ${repo.subdir}` : ''}
                    </div>
                  </div>
                  <Button size='mini' status='danger' onClick={() => handleRemoveRepo(repo.id)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className='bg-2 rd-16px px-20px py-16px space-y-12px'>
          <div className='flex items-center justify-between'>
            <div className='text-14px text-t-primary'>Skills</div>
            <Button size='mini' onClick={loadSkills}>
              Refresh
            </Button>
          </div>
          <Divider className='my-12px' />
          {sortedSkills.length === 0 ? (
            <div className='text-12px text-t-secondary'>No skills found.</div>
          ) : (
            <Tabs defaultActiveTab='claude'>
              {AGENTS.map((agent) => (
                <Tabs.TabPane key={agent.key} title={agent.label}>
                  {renderSkillList(agent.key)}
                </Tabs.TabPane>
              ))}
            </Tabs>
          )}
        </div>
      </div>
    </SettingsPageWrapper>
  );
};

export default SkillSettings;
