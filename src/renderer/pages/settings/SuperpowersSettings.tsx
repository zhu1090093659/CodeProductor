/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Divider, Message, Radio, Switch, Tabs, Tag } from '@arco-design/web-react';
import SettingsPageWrapper from './components/SettingsPageWrapper';
import { ipcBridge } from '@/common';
import { ConfigStorage, type SkillRepoConfig, type SuperpowersConfig, type SuperpowersWorkflowMode } from '@/common/storage';
import type { AcpBackend } from '@/types/acpTypes';
import { useTranslation } from 'react-i18next';

const OFFICIAL_REPO: SkillRepoConfig = {
  id: 'superpowers-official',
  url: 'https://github.com/obra/superpowers.git',
  branch: 'main',
};

const DEFAULT_CONFIG: SuperpowersConfig = {
  repoId: OFFICIAL_REPO.id,
  workflowMode: 'guided',
  enabledForAgents: {
    claude: { enabled: false, autoInject: false },
    codex: { enabled: false, autoInject: false },
  },
};

const AGENTS: Array<{ key: AcpBackend; label: string }> = [
  { key: 'claude', label: 'Claude Code' },
  { key: 'codex', label: 'Codex' },
];

const normalizeConfig = (config?: SuperpowersConfig | null): SuperpowersConfig => {
  const repoId = config?.repoId?.trim() ? config.repoId : DEFAULT_CONFIG.repoId;
  return {
    ...DEFAULT_CONFIG,
    ...config,
    repoId,
    enabledForAgents: {
      ...DEFAULT_CONFIG.enabledForAgents,
      ...(config?.enabledForAgents || {}),
    },
  };
};

const isSkillFromRepo = (location: string, repoId: string) => {
  const normalized = location.replace(/\\/g, '/');
  return normalized.includes(`/remote/${repoId}/`) || normalized.endsWith(`/remote/${repoId}`);
};

const SuperpowersSettings: React.FC = () => {
  const { t } = useTranslation();
  const [message, messageContext] = Message.useMessage();
  const [config, setConfig] = useState<SuperpowersConfig>(DEFAULT_CONFIG);
  const [repos, setRepos] = useState<SkillRepoConfig[]>([]);
  const [stats, setStats] = useState({ skills: 0, commands: 0 });
  const [commandsDir, setCommandsDir] = useState('');
  const [loadingStats, setLoadingStats] = useState(false);

  const activeRepo = useMemo(() => repos.find((repo) => repo.id === config.repoId) || null, [repos, config.repoId]);

  const saveConfig = useCallback(
    async (next: SuperpowersConfig) => {
      setConfig(next);
      await ConfigStorage.set('superpowers.config', next);
    },
    [setConfig]
  );

  const loadData = useCallback(async () => {
    try {
      const [storedConfig, storedRepos] = await Promise.all([ConfigStorage.get('superpowers.config'), ConfigStorage.get('skills.repos')]);
      setConfig(normalizeConfig(storedConfig as SuperpowersConfig | null));
      setRepos((storedRepos || []) as SkillRepoConfig[]);
    } catch {
      setConfig(DEFAULT_CONFIG);
      setRepos([]);
    }
  }, []);

  const loadStats = useCallback(async () => {
    if (!activeRepo) {
      setStats({ skills: 0, commands: 0 });
      setCommandsDir('');
      return;
    }
    setLoadingStats(true);
    try {
      const [skills, commandDirResult] = await Promise.all([ipcBridge.fs.listAvailableSkills.invoke(), ipcBridge.application.superpowersCommandDir.invoke({ repoId: activeRepo.id, subdir: activeRepo.subdir })]);
      const skillsCount = (skills || []).filter((skill) => isSkillFromRepo(skill.location, activeRepo.id)).length;
      const commandDir = commandDirResult?.dir || '';
      const commandFiles = commandDir ? await ipcBridge.fs.listMarkdownFiles.invoke({ dir: commandDir }) : [];
      setStats({ skills: skillsCount, commands: commandFiles.length });
      setCommandsDir(commandDir);
    } catch {
      setStats({ skills: 0, commands: 0 });
      setCommandsDir('');
    } finally {
      setLoadingStats(false);
    }
  }, [activeRepo]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const handleAddRepo = useCallback(async () => {
    if (repos.some((repo) => repo.id === OFFICIAL_REPO.id)) {
      message.info(t('superpowers.repoExists'));
      return;
    }
    const next = [...repos, OFFICIAL_REPO];
    await ConfigStorage.set('skills.repos', next);
    setRepos(next);
    if (config.repoId !== OFFICIAL_REPO.id) {
      await saveConfig({ ...config, repoId: OFFICIAL_REPO.id });
    }
    message.success(t('superpowers.repoAdded'));
  }, [repos, config, saveConfig, message, t]);

  const handleRemoveRepo = useCallback(async () => {
    if (!activeRepo) return;
    const next = repos.filter((repo) => repo.id !== activeRepo.id);
    await ConfigStorage.set('skills.repos', next);
    setRepos(next);
    message.success(t('superpowers.repoRemoved'));
  }, [activeRepo, repos, message, t]);

  const handleSyncRepo = useCallback(async () => {
    if (!repos.length) {
      message.warning(t('superpowers.repoMissing'));
      return;
    }
    const result = await ipcBridge.skills.syncRepos.invoke({ repos });
    if (result.success && result.data) {
      setRepos(result.data.repos);
      await ConfigStorage.set('skills.repos', result.data.repos);
      if (result.data.errors?.length) {
        message.warning(t('superpowers.repoSyncPartial', { ids: result.data.errors.map((e) => e.id).join(', ') }));
      } else {
        message.success(t('superpowers.repoSynced'));
      }
      return;
    }
    message.error(result.msg || t('superpowers.repoSyncFailed'));
  }, [repos, message, t]);

  const handleModeChange = useCallback(
    (value: SuperpowersWorkflowMode) => {
      void saveConfig({ ...config, workflowMode: value });
    },
    [config, saveConfig]
  );

  const updateAgentConfig = useCallback(
    (agent: AcpBackend, updates: { enabled?: boolean; autoInject?: boolean }) => {
      const current = config.enabledForAgents?.[agent] || { enabled: false, autoInject: false };
      void saveConfig({
        ...config,
        enabledForAgents: {
          ...config.enabledForAgents,
          [agent]: { ...current, ...updates },
        },
      });
    },
    [config, saveConfig]
  );

  const lastSyncLabel = activeRepo?.lastSync ? new Date(activeRepo.lastSync).toLocaleString() : t('superpowers.repoNotSynced');

  return (
    <SettingsPageWrapper contentClassName='max-w-1200px'>
      {messageContext}
      <div className='space-y-16px'>
        <div className='bg-2 rd-16px px-20px py-16px space-y-12px'>
          <div className='flex items-center justify-between'>
            <div className='text-14px text-t-primary'>{t('superpowers.repoTitle')}</div>
            <div className='flex items-center gap-8px'>
              <Button size='mini' onClick={() => void loadData()}>
                {t('superpowers.refresh')}
              </Button>
              {activeRepo ? (
                <Button size='mini' onClick={() => void handleSyncRepo()}>
                  {t('superpowers.syncNow')}
                </Button>
              ) : (
                <Button type='primary' size='mini' onClick={() => void handleAddRepo()}>
                  {t('superpowers.addRepo')}
                </Button>
              )}
            </div>
          </div>
          <Divider className='my-12px' />
          {!activeRepo ? (
            <div className='text-12px text-t-secondary'>{t('superpowers.repoEmpty')}</div>
          ) : (
            <div className='space-y-10px'>
              <div className='flex items-center justify-between bg-bg-1 px-12px py-10px rd-8px border border-border-2'>
                <div className='text-12px text-t-secondary'>
                  <div className='text-13px text-t-primary'>{activeRepo.url}</div>
                  <div>
                    {activeRepo.branch ? `branch: ${activeRepo.branch}` : 'branch: default'}
                    {activeRepo.subdir ? ` | subdir: ${activeRepo.subdir}` : ''}
                  </div>
                </div>
                <div className='flex items-center gap-8px'>
                  <Tag color={activeRepo.lastSync ? 'green' : 'orange'}>{activeRepo.lastSync ? t('superpowers.repoSyncedShort') : t('superpowers.repoNotSyncedShort')}</Tag>
                  <Button size='mini' status='danger' onClick={() => void handleRemoveRepo()}>
                    {t('superpowers.removeRepo')}
                  </Button>
                </div>
              </div>
              <div className='text-12px text-t-secondary'>
                {t('superpowers.lastSync')}: {lastSyncLabel}
              </div>
            </div>
          )}
        </div>

        <div className='bg-2 rd-16px px-20px py-16px space-y-12px'>
          <div className='text-14px text-t-primary'>{t('superpowers.workflowTitle')}</div>
          <Divider className='my-12px' />
          <Radio.Group value={config.workflowMode} onChange={(value) => handleModeChange(value as SuperpowersWorkflowMode)}>
            <div className='space-y-10px'>
              <div>
                <Radio value='passive'>{t('superpowers.modePassive')}</Radio>
                <div className='text-12px text-t-secondary ml-24px'>{t('superpowers.modePassiveDesc')}</div>
              </div>
              <div>
                <Radio value='guided'>{t('superpowers.modeGuided')}</Radio>
                <div className='text-12px text-t-secondary ml-24px'>{t('superpowers.modeGuidedDesc')}</div>
              </div>
              <div>
                <Radio value='enforced'>{t('superpowers.modeEnforced')}</Radio>
                <div className='text-12px text-t-secondary ml-24px'>{t('superpowers.modeEnforcedDesc')}</div>
              </div>
            </div>
          </Radio.Group>
        </div>

        <div className='bg-2 rd-16px px-20px py-16px space-y-12px'>
          <div className='text-14px text-t-primary'>{t('superpowers.agentTitle')}</div>
          <Divider className='my-12px' />
          <Tabs defaultActiveTab='claude'>
            {AGENTS.map((agent) => {
              const agentConfig = config.enabledForAgents?.[agent.key] || { enabled: false, autoInject: false };
              return (
                <Tabs.TabPane key={agent.key} title={agent.label}>
                  <div className='space-y-10px'>
                    <div className='flex items-center justify-between bg-bg-1 px-12px py-10px rd-8px border border-border-2'>
                      <div>
                        <div className='text-13px text-t-primary'>{t('superpowers.enableForAgent')}</div>
                        <div className='text-12px text-t-secondary'>{t('superpowers.enableForAgentDesc')}</div>
                      </div>
                      <Switch checked={agentConfig.enabled} onChange={(value) => updateAgentConfig(agent.key, { enabled: value })} />
                    </div>
                    <div className='flex items-center justify-between bg-bg-1 px-12px py-10px rd-8px border border-border-2'>
                      <div>
                        <div className='text-13px text-t-primary'>{t('superpowers.autoInject')}</div>
                        <div className='text-12px text-t-secondary'>{t('superpowers.autoInjectDesc')}</div>
                      </div>
                      <Switch checked={agentConfig.autoInject} disabled={!agentConfig.enabled} onChange={(value) => updateAgentConfig(agent.key, { autoInject: value })} />
                    </div>
                  </div>
                </Tabs.TabPane>
              );
            })}
          </Tabs>
        </div>

        <div className='bg-2 rd-16px px-20px py-16px space-y-12px'>
          <div className='flex items-center justify-between'>
            <div className='text-14px text-t-primary'>{t('superpowers.statsTitle')}</div>
            <Button size='mini' onClick={() => void loadStats()} loading={loadingStats}>
              {t('superpowers.refresh')}
            </Button>
          </div>
          <Divider className='my-12px' />
          <div className='text-12px text-t-secondary space-y-4px'>
            <div>
              {t('superpowers.statsSkills')}: {stats.skills}
            </div>
            <div>
              {t('superpowers.statsCommands')}: {stats.commands}
            </div>
            <div>
              {t('superpowers.commandsDir')}: {commandsDir || '-'}
            </div>
            <div>
              {t('superpowers.lastWorkflow')}: {config.stats?.lastWorkflowUsed || '-'}
            </div>
          </div>
        </div>
      </div>
    </SettingsPageWrapper>
  );
};

export default SuperpowersSettings;
