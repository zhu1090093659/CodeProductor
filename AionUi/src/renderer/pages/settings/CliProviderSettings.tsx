/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Message, Select, Tabs } from '@arco-design/web-react';
import SettingsPageWrapper from './components/SettingsPageWrapper';
import { CLAUDE_PROVIDER_PRESETS } from '@/renderer/config/cliProviders/claudePresets';
import { CODEX_PROVIDER_PRESETS, generateThirdPartyConfig } from '@/renderer/config/cliProviders/codexPresets';
import { GEMINI_PROVIDER_PRESETS } from '@/renderer/config/cliProviders/geminiPresets';
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
};

const DEFAULT_CONFIG: CliProvidersStorage = {
  claude: {},
  codex: {},
  gemini: {},
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

const buildGeminiEnv = (config: CliProviderConfig) => {
  const env: Record<string, string> = {};
  if (config.apiKey) {
    env['GEMINI_API_KEY'] = config.apiKey;
  }
  if (config.baseUrl) {
    env['GOOGLE_GEMINI_BASE_URL'] = config.baseUrl;
  }
  if (config.model) {
    env['GEMINI_MODEL'] = config.model;
  }
  return env;
};

const CliProviderSettings: React.FC = () => {
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
      const config = configs[target] || {};
      if (target === 'claude') {
        const preset = CLAUDE_PROVIDER_PRESETS.find((p) => p.name === config.presetName);
        if (!preset) return;
        const env = buildClaudeEnv(preset, config);
        const result = await ipcBridge.provider.apply.invoke({ target, env });
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
        const auth = { ...(preset.auth || {}) } as Record<string, unknown>;
        if (config.apiKey) {
          auth['OPENAI_API_KEY'] = config.apiKey;
        }
        const configToml = patchCodexConfig(preset.config, config.baseUrl, config.model);
        const result = await ipcBridge.provider.apply.invoke({ target, auth, configToml });
        if (result.success) {
          message.success('Codex settings updated');
        } else {
          message.error(result.msg || 'Failed to update Codex settings');
        }
        return;
      }
      if (target === 'gemini') {
        const env = buildGeminiEnv(config);
        const result = await ipcBridge.provider.apply.invoke({ target, env });
        if (result.success) {
          message.success('Gemini settings updated');
        } else {
          message.error(result.msg || 'Failed to update Gemini settings');
        }
      }
    },
    [configs, message]
  );

  const ProviderForm: React.FC<{ target: CliProviderTarget; presets: ProviderPreset[] }> = ({ target, presets }) => {
    const config = configs[target] || {};
    const preset = presets.find((p) => p.name === config.presetName);
    const endpointCandidates = preset?.endpointCandidates || [];
    const modelListState = useModeModeList('openai', config.baseUrl, config.apiKey);
    const modelOptions = useMemo(() => modelListState.data?.models || [], [modelListState.data?.models]);
    const modelError = typeof modelListState.error === 'string' ? modelListState.error : modelListState.error?.message;

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
                const baseUrl =
                  nextPreset?.settingsConfig?.env?.['ANTHROPIC_BASE_URL'] ||
                  nextPreset?.settingsConfig?.env?.['GOOGLE_GEMINI_BASE_URL'] ||
                  nextPreset?.endpointCandidates?.[0] ||
                  '';
                const model =
                  (nextPreset as { model?: string })?.model ||
                  nextPreset?.settingsConfig?.env?.['ANTHROPIC_MODEL']?.toString() ||
                  nextPreset?.settingsConfig?.env?.['GEMINI_MODEL']?.toString() ||
                  '';
                const nextConfigs = {
                  ...configs,
                  [target]: {
                    ...configs[target],
                    presetName: value,
                    baseUrl: baseUrl ? String(baseUrl) : '',
                    model: model ? String(model) : config.model,
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

          <Form.Item label='API Key'>
            <Input.Password
              placeholder='Enter API key'
              value={config.apiKey || ''}
              onChange={(value) => void saveConfigs({ ...configs, [target]: { ...configs[target], apiKey: value } })}
            />
          </Form.Item>

          {endpointCandidates.length > 0 ? (
            <Form.Item label='Base URL'>
              <Select
                allowCreate
                value={config.baseUrl}
                placeholder='Select or input base url'
                onChange={(value) => void saveConfigs({ ...configs, [target]: { ...configs[target], baseUrl: value } })}
              >
                {endpointCandidates.map((url) => (
                  <Select.Option key={url} value={url}>
                    {url}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          ) : (
            <Form.Item label='Base URL'>
              <Input
                placeholder='Optional base url'
                value={config.baseUrl || ''}
                onChange={(value) => void saveConfigs({ ...configs, [target]: { ...configs[target], baseUrl: value } })}
              />
            </Form.Item>
          )}

          <Form.Item label='Model' validateStatus={modelError ? 'error' : undefined} help={modelError}>
            <Select
              allowCreate
              showSearch
              loading={modelListState.isLoading}
              placeholder='Select or input model'
              value={config.model || ''}
              onChange={(value) => void saveConfigs({ ...configs, [target]: { ...configs[target], model: value } })}
              options={modelOptions}
            />
          </Form.Item>

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
      { key: 'gemini', title: 'Gemini', presets: GEMINI_PROVIDER_PRESETS },
    ],
    []
  );

  return (
    <SettingsPageWrapper contentClassName='max-w-1200px'>
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
    </SettingsPageWrapper>
  );
};

export default CliProviderSettings;
