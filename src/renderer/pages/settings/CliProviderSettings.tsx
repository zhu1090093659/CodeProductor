/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Message, Select, Tabs, Switch } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { Download } from '@icon-park/react';
import SettingsPageWrapper from './components/SettingsPageWrapper';
import { CLAUDE_PROVIDER_PRESETS } from '@/renderer/config/cliProviders/claudePresets';
import { CODEX_PROVIDER_PRESETS, generateThirdPartyConfig } from '@/renderer/config/cliProviders/codexPresets';
import { ConfigStorage, type CliProviderConfig, type CliProviderTarget, type CliProvidersStorage } from '@/common/storage';
import { ipcBridge } from '@/common';
import useModeModeList from '@/renderer/hooks/useModeModeList';

type ProviderPreset = {
  name: string;
  websiteUrl: string;
  apiKeyUrl?: string;
  endpointCandidates?: string[];
  settingsConfig?: { env?: Record<string, string | number> };
  templateValues?: Record<string, { label: string; placeholder: string; defaultValue?: string }>;
  category?: string;
  isOfficial?: boolean;
  apiKeyField?: 'ANTHROPIC_AUTH_TOKEN' | 'ANTHROPIC_API_KEY';
};

const DEFAULT_CONFIG: CliProvidersStorage = {
  claude: {},
  codex: {},
};

const buildClaudeEnv = (preset: ProviderPreset, config: CliProviderConfig) => {
  const env = { ...(preset.settingsConfig?.env || {}) } as Record<string, string | number>;
  const templateValues = config.templateValues || {};
  const applyTemplate = (value: string) => {
    return value.replace(/\$\{([^}]+)\}/g, (_, key: string) => {
      const replacement = templateValues[key] || '';
      return replacement;
    });
  };
  Object.keys(env).forEach((key) => {
    const raw = env[key];
    if (typeof raw === 'string') {
      env[key] = applyTemplate(raw);
    }
  });
  const apiKeyField = (preset as { apiKeyField?: string }).apiKeyField || 'ANTHROPIC_AUTH_TOKEN';
  if (config.apiKey) {
    env[apiKeyField] = config.apiKey;
  }
  if (config.baseUrl) {
    env['ANTHROPIC_BASE_URL'] = config.baseUrl;
  }
  if (config.model) {
    env['ANTHROPIC_MODEL'] = config.model;
  }
  return env;
};

const patchCodexConfig = (baseConfig: string, baseUrl?: string, model?: string) => {
  let next = baseConfig || '';
  if (!next) {
    if (baseUrl) {
      next = generateThirdPartyConfig('custom', baseUrl, model || 'gpt-5.1-codex');
    }
    return next;
  }
  if (baseUrl) {
    next = next.replace(/base_url\s*=\s*".*?"/g, `base_url = "${baseUrl}"`);
  }
  if (model) {
    next = next.replace(/model\s*=\s*".*?"/g, `model = "${model}"`);
  }
  return next;
};

const isOfficialCliPreset = (preset?: ProviderPreset) => {
  return preset?.category === 'official';
};

const CliProviderSettings: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { t } = useTranslation();
  const [message, messageContext] = Message.useMessage();
  const [configs, setConfigs] = useState<CliProvidersStorage>(DEFAULT_CONFIG);

  useEffect(() => {
    ConfigStorage.get('cli.providers')
      .then((stored) => {
        if (stored) {
          setConfigs({ ...DEFAULT_CONFIG, ...stored });
        }
      })
      .catch(() => {
        setConfigs(DEFAULT_CONFIG);
      });
  }, []);

  const saveConfigs = useCallback(
    async (next: CliProvidersStorage) => {
      setConfigs(next);
      await ConfigStorage.set('cli.providers', next);
    },
    [setConfigs]
  );

  const handleApply = useCallback(
    async (target: CliProviderTarget) => {
      const applyProvider = ipcBridge.provider.apply.invoke as (payload: unknown) => Promise<{ success: boolean; msg?: string }>;
      const config = configs[target] || {};
      if (target === 'claude') {
        const preset = CLAUDE_PROVIDER_PRESETS.find((p) => p.name === config.presetName);
        if (!preset) return;
        const env = buildClaudeEnv(preset, config);
        const shouldUseOfficial = isOfficialCliPreset(preset) && !config.apiKey;
        const clearEnvKeys = shouldUseOfficial ? ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_MODEL', 'ANTHROPIC_DEFAULT_HAIKU_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_OPUS_MODEL'] : undefined;
        const result = await applyProvider({ target, env, clearEnvKeys });
        if (result.success) {
          message.success('Claude Code settings updated');
        } else {
          message.error(result.msg || 'Failed to update Claude Code settings');
        }
        return;
      }
      if (target === 'codex') {
        const preset = CODEX_PROVIDER_PRESETS.find((p) => p.name === config.presetName);
        if (!preset) return;
        const shouldUseOfficial = isOfficialCliPreset(preset) && !config.apiKey && !config.baseUrl;
        const authPatch = config.apiKey ? ({ OPENAI_API_KEY: config.apiKey } as Record<string, unknown>) : undefined;
        const clearAuthKeys = shouldUseOfficial ? (['OPENAI_API_KEY'] as string[]) : undefined;
        const configToml = patchCodexConfig(preset.config, config.baseUrl, config.model);
        const result = await applyProvider({
          target,
          authPatch,
          clearAuthKeys,
          configToml: configToml && configToml.trim() ? configToml : undefined,
          clearConfigToml: shouldUseOfficial,
        });
        if (result.success) {
          message.success('Codex settings updated');
        } else {
          message.error(result.msg || 'Failed to update Codex settings');
        }
        return;
      }
      return;
    },
    [configs, message]
  );

  const ProviderForm: React.FC<{ target: CliProviderTarget; presets: ProviderPreset[] }> = ({ target, presets }) => {
    const config = configs[target] || {};
    const preset = presets.find((p) => p.name === config.presetName);
    const isOfficial = isOfficialCliPreset(preset);
    const endpointCandidates = preset?.endpointCandidates || [];
    const modelListState = useModeModeList(target === 'codex' ? 'openai' : '', config.baseUrl, config.apiKey);
    const modelOptions = useMemo(() => modelListState.data?.models || [], [modelListState.data?.models]);
    const modelError = typeof modelListState.error === 'string' ? modelListState.error : modelListState.error?.message;
    const availableModels = useMemo(() => {
      if (target === 'codex') {
        return modelOptions.map((option) => option.value);
      }
      return config.model ? [config.model] : [];
    }, [modelOptions, config.model, target]);
    const enabledModels = config.enabledModels || [];
    const effectiveEnabledModels = enabledModels.length > 0 ? enabledModels : availableModels.slice(0, 1);

    useEffect(() => {
      if (!availableModels.length || enabledModels.length > 0) return;
      void saveConfigs({
        ...configs,
        [target]: {
          ...config,
          enabledModels: availableModels.slice(0, 1),
        },
      });
    }, [availableModels, config, configs, enabledModels.length, saveConfigs, target]);

    const toggleModel = (modelName: string, nextEnabled: boolean) => {
      const nextModels = nextEnabled ? [...effectiveEnabledModels, modelName] : effectiveEnabledModels.filter((name) => name !== modelName);
      void saveConfigs({
        ...configs,
        [target]: {
          ...config,
          enabledModels: nextModels,
        },
      });
    };

    useEffect(() => {
      if (!enabledModels.length) return;
      if (!availableModels.length) return;
      const validEnabled = enabledModels.filter((modelName) => availableModels.includes(modelName));
      if (validEnabled.length === enabledModels.length) return;
      void saveConfigs({
        ...configs,
        [target]: {
          ...config,
          enabledModels: validEnabled,
        },
      });
    }, [availableModels, config, configs, enabledModels, saveConfigs, target]);

    const handleFetchModels = async () => {
      if (target === 'codex') {
        await modelListState.mutate();
        return;
      }
      message.info(t('settings.fetchModelsHint'));
    };

    const renderTemplateValues = (templatePreset: ProviderPreset | undefined) => {
      if (!templatePreset?.templateValues) return null;
      const entries = Object.entries(templatePreset.templateValues);
      if (entries.length === 0) return null;
      return (
        <div className='space-y-12px'>
          {entries.map(([key, value]) => (
            <Form.Item key={key} label={value.label || key}>
              <Input
                placeholder={value.placeholder}
                value={configs[target]?.templateValues?.[key] || value.defaultValue || ''}
                onChange={(next) => {
                  const nextConfigs = {
                    ...configs,
                    [target]: {
                      ...configs[target],
                      templateValues: { ...(configs[target]?.templateValues || {}), [key]: next },
                    },
                  };
                  void saveConfigs(nextConfigs);
                }}
              />
            </Form.Item>
          ))}
        </div>
      );
    };

    return (
      <div className='space-y-16px'>
        <Form layout='vertical'>
          <Form.Item label='Provider'>
            <Select
              value={config.presetName}
              placeholder='Select provider'
              onChange={(value) => {
                const nextPreset = presets.find((p) => p.name === value);
                const baseUrl = nextPreset?.settingsConfig?.env?.['ANTHROPIC_BASE_URL'] || nextPreset?.endpointCandidates?.[0] || '';
                const model = (nextPreset as { model?: string })?.model || nextPreset?.settingsConfig?.env?.['ANTHROPIC_MODEL']?.toString() || '';
                const nextConfigs = {
                  ...configs,
                  [target]: {
                    ...configs[target],
                    presetName: value,
                    baseUrl: baseUrl ? String(baseUrl) : '',
                    model: model ? String(model) : '',
                  },
                };
                void saveConfigs(nextConfigs);
              }}
            >
              {presets.map((item) => (
                <Select.Option key={item.name} value={item.name}>
                  {item.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {preset?.websiteUrl && (
            <div className='text-12px text-t-secondary'>
              <span>Website: </span>
              <a href={preset.websiteUrl} target='_blank' rel='noopener noreferrer' className='text-[rgb(var(--primary-6))]'>
                {preset.websiteUrl}
              </a>
            </div>
          )}

          {isOfficial && (
            <div className='text-12px text-t-secondary leading-5'>
              <div>Official provider supports browser sign-in. Leave API Key empty and apply.</div>
              {target === 'codex' ? (
                <div>
                  Then run <span className='font-mono'>codex login</span> in your terminal if needed. See official docs:{' '}
                  <a href='https://developers.openai.com/codex/auth' target='_blank' rel='noopener noreferrer' className='text-[rgb(var(--primary-6))]'>
                    Codex auth
                  </a>
                </div>
              ) : (
                <div>
                  Then run <span className='font-mono'>claude</span> and use <span className='font-mono'>/login</span> if needed. See official docs:{' '}
                  <a href='https://docs.anthropic.com/en/docs/claude-code/quickstart' target='_blank' rel='noopener noreferrer' className='text-[rgb(var(--primary-6))]'>
                    Claude Code quickstart
                  </a>
                </div>
              )}
            </div>
          )}

          <Form.Item label='API Key'>
            <Input.Password placeholder={isOfficial ? 'Optional (leave empty to use browser login)' : 'Enter API key'} value={config.apiKey || ''} onChange={(value) => void saveConfigs({ ...configs, [target]: { ...configs[target], apiKey: value } })} />
          </Form.Item>

          {!isOfficial &&
            (endpointCandidates.length > 0 ? (
              <Form.Item label='Base URL'>
                <Select allowCreate value={config.baseUrl} placeholder='Select or input base url' onChange={(value) => void saveConfigs({ ...configs, [target]: { ...configs[target], baseUrl: value } })}>
                  {endpointCandidates.map((url) => (
                    <Select.Option key={url} value={url}>
                      {url}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            ) : (
              <Form.Item label='Base URL'>
                <Input placeholder='Optional base url' value={config.baseUrl || ''} onChange={(value) => void saveConfigs({ ...configs, [target]: { ...configs[target], baseUrl: value } })} />
              </Form.Item>
            ))}

          {!isOfficial && (
            <div className='space-y-10px'>
              <div className='flex items-center justify-between gap-12px'>
                <div className='text-12px text-t-secondary'>{t('settings.enabledModels')}</div>
                <Button size='mini' type='secondary' shape='round' className='px-10px' icon={<Download theme='outline' size={14} />} onClick={() => void handleFetchModels()}>
                  {t('settings.fetchModels')}
                </Button>
              </div>
              {availableModels.length > 0 && (
                <div className='space-y-8px overflow-y-auto pr-2' style={{ maxHeight: 280 }}>
                  {availableModels.map((modelName) => {
                    const isEnabled = effectiveEnabledModels.includes(modelName);
                    return (
                      <div key={modelName} className='flex items-center justify-between gap-12px bg-fill-2 rd-8px px-12px py-8px'>
                        <span className='text-14px text-t-primary break-all'>{modelName}</span>
                        <Switch checked={isEnabled} onChange={(checked) => toggleModel(modelName, checked)} />
                      </div>
                    );
                  })}
                </div>
              )}
              {modelError && <div className='text-12px text-[rgb(var(--danger-6))]'>{modelError}</div>}
            </div>
          )}

          {renderTemplateValues(preset)}
        </Form>

        <div className='flex items-center gap-12px'>
          <Button
            type='primary'
            onClick={() => {
              void handleApply(target);
            }}
          >
            Apply to CLI
          </Button>
          <Button
            onClick={() => {
              const nextConfigs = { ...configs, [target]: {} };
              void saveConfigs(nextConfigs);
            }}
          >
            Reset
          </Button>
        </div>
      </div>
    );
  };

  const tabs = useMemo(
    () => [
      { key: 'claude', title: 'Claude Code', presets: CLAUDE_PROVIDER_PRESETS },
      { key: 'codex', title: 'Codex', presets: CODEX_PROVIDER_PRESETS },
    ],
    []
  );

  const content = (
    <>
      {messageContext}
      <div className='bg-2 rd-16px px-20px py-16px'>
        <Tabs defaultActiveTab='claude'>
          {tabs.map((tab) => (
            <Tabs.TabPane key={tab.key} title={tab.title}>
              <ProviderForm target={tab.key as CliProviderTarget} presets={tab.presets} />
            </Tabs.TabPane>
          ))}
        </Tabs>
      </div>
    </>
  );

  if (embedded) {
    return <div className='space-y-16px'>{content}</div>;
  }

  return <SettingsPageWrapper contentClassName='max-w-1200px'>{content}</SettingsPageWrapper>;
};

export default CliProviderSettings;
