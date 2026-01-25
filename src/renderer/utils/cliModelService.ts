/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { ConfigStorage, type CliProviderTarget, type TProviderWithModel } from '@/common/storage';
import type { CliProviderApplyPayload } from '@/common/types/provider';
import { buildClaudeEnv, patchCodexConfig, isOfficialCliPreset, CLAUDE_PROVIDER_PRESETS, CODEX_PROVIDER_PRESETS, CLAUDE_THIRD_PARTY_ENV_KEYS } from './cliProviderUtils';

const applyProvider = ipcBridge.provider.apply.invoke as (payload: CliProviderApplyPayload) => Promise<{ success: boolean; msg?: string }>;

/**
 * Apply CLI model configuration when user manually selects a model
 * This writes to external CLI config files:
 * - Claude: ~/.claude/settings.json
 * - Codex: ~/.codex/config.toml
 *
 * @param modelInfo - The selected model info, id should be "cli:claude" or "cli:codex"
 */
export async function applyCliModelOnSelect(modelInfo: TProviderWithModel): Promise<void> {
  // Only process CLI models
  if (!modelInfo.id?.startsWith('cli:')) {
    return;
  }

  const target = modelInfo.id.replace('cli:', '') as CliProviderTarget;

  // Get CLI provider configuration from storage
  const cliProviders = await ConfigStorage.get('cli.providers');
  const config = cliProviders?.[target];

  if (!config?.presetName) {
    console.warn('[cliModelService] CLI provider not configured, skipping auto-apply');
    return;
  }

  const selectedModel = modelInfo.useModel;

  if (target === 'claude') {
    await applyClaudeModel(config.presetName, { ...config, model: selectedModel });
  } else if (target === 'codex') {
    await applyCodexModel(config.presetName, { ...config, model: selectedModel });
  }
}

/**
 * Apply Claude model configuration to ~/.claude/settings.json
 */
async function applyClaudeModel(presetName: string, config: { model?: string; apiKey?: string; baseUrl?: string; alwaysThinkingEnabled?: boolean; maxThinkingTokens?: string; templateValues?: Record<string, string> }): Promise<void> {
  const preset = CLAUDE_PROVIDER_PRESETS.find((p) => p.name === presetName);
  if (!preset) {
    console.warn('[cliModelService] Claude preset not found:', presetName);
    return;
  }

  const isOfficial = isOfficialCliPreset(preset);
  const shouldUseOfficial = isOfficial && !config.apiKey;

  // Build environment variables
  const env = buildClaudeEnv(preset, config);

  // Determine which keys to clear
  const clearEnvKeys: string[] = [];
  if (shouldUseOfficial) {
    clearEnvKeys.push(...CLAUDE_THIRD_PARTY_ENV_KEYS);
    for (const key of CLAUDE_THIRD_PARTY_ENV_KEYS) {
      delete env[key];
    }
  }

  // Only clear MAX_THINKING_TOKENS if thinking mode is explicitly disabled
  const thinkingEnabled = typeof config.alwaysThinkingEnabled === 'boolean' ? config.alwaysThinkingEnabled : true;
  if (!thinkingEnabled) {
    clearEnvKeys.push('MAX_THINKING_TOKENS');
  }

  // Build settings patch
  const settingsPatch = {
    alwaysThinkingEnabled: typeof config.alwaysThinkingEnabled === 'boolean' ? config.alwaysThinkingEnabled : true,
  };

  // Call IPC to write config
  const result = await applyProvider({
    target: 'claude',
    env,
    clearEnvKeys: clearEnvKeys.length ? clearEnvKeys : undefined,
    settingsPatch,
  });

  if (!result.success) {
    console.error('[cliModelService] Failed to apply Claude model config:', result.msg);
  }
}

/**
 * Apply Codex model configuration to ~/.codex/config.toml
 */
async function applyCodexModel(presetName: string, config: { model?: string; apiKey?: string; baseUrl?: string; reasoningEffort?: string }): Promise<void> {
  const preset = CODEX_PROVIDER_PRESETS.find((p) => p.name === presetName);
  if (!preset) {
    console.warn('[cliModelService] Codex preset not found:', presetName);
    return;
  }

  const isOfficial = isOfficialCliPreset(preset);
  const shouldUseOfficial = isOfficial && !config.apiKey && !config.baseUrl;

  // Build config TOML
  const configToml = patchCodexConfig(preset.config, config.baseUrl, config.model, config.reasoningEffort);

  // Build auth patch
  const authPatch = config.apiKey ? { OPENAI_API_KEY: config.apiKey } : undefined;
  const clearAuthKeys = shouldUseOfficial ? ['OPENAI_API_KEY'] : undefined;

  // Call IPC to write config
  const result = await applyProvider({
    target: 'codex',
    authPatch,
    clearAuthKeys,
    configToml: configToml?.trim() ? configToml : undefined,
    clearConfigToml: shouldUseOfficial && !config.model,
  });

  if (!result.success) {
    console.error('[cliModelService] Failed to apply Codex model config:', result.msg);
  }
}
