/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ClaudeProviderPreset } from '@/renderer/config/cliProviders/claudePresets';
import type { CodexProviderPreset } from '@/renderer/config/cliProviders/codexPresets';
import { generateThirdPartyConfig } from '@/renderer/config/cliProviders/codexPresets';
import type { CliProviderConfig } from '@/common/storage';

// Re-export presets for convenience
export { CLAUDE_PROVIDER_PRESETS } from '@/renderer/config/cliProviders/claudePresets';
export { CODEX_PROVIDER_PRESETS } from '@/renderer/config/cliProviders/codexPresets';
export type { ClaudeProviderPreset, CodexProviderPreset };

/**
 * Check if a preset is an official CLI preset
 */
type ProviderPresetLike = { category?: string };

export const isOfficialCliPreset = (preset?: ProviderPresetLike): boolean => {
  return preset?.category === 'official';
};

/**
 * Build Claude environment variables from preset and config
 * Used for writing to ~/.claude/settings.json
 */
export const buildClaudeEnv = (preset: ClaudeProviderPreset, config: CliProviderConfig): Record<string, string | number> => {
  const env = { ...(preset.settingsConfig?.env || {}) } as Record<string, string | number>;
  const templateValues = config.templateValues || {};

  // Apply template variable substitution
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

  // Set API key
  const apiKeyField = preset.apiKeyField || 'ANTHROPIC_AUTH_TOKEN';
  const hasApiKey = Boolean(config.apiKey);
  if (hasApiKey) {
    env[apiKeyField] = config.apiKey!;
  }

  // Set base URL if provided
  if (config.baseUrl) {
    env['ANTHROPIC_BASE_URL'] = config.baseUrl;
  }

  // Set model
  if (config.model) {
    env['ANTHROPIC_MODEL'] = config.model;
  }
  if (!env['ANTHROPIC_MODEL']) {
    env['ANTHROPIC_MODEL'] = 'default';
  }

  // Set model aliases when using API key with specific model
  if (hasApiKey && config.model) {
    env['ANTHROPIC_SMALL_FAST_MODEL'] = config.model;
    env['ANTHROPIC_DEFAULT_SONNET_MODEL'] = config.model;
    env['ANTHROPIC_DEFAULT_OPUS_MODEL'] = config.model;
    env['ANTHROPIC_DEFAULT_HAIKU_MODEL'] = config.model;
  }

  // Set thinking tokens
  if (config.maxThinkingTokens) {
    const parsed = Number.parseInt(config.maxThinkingTokens, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      env['MAX_THINKING_TOKENS'] = parsed;
    }
  } else if (config.alwaysThinkingEnabled !== false) {
    // When thinking is enabled (default true) but no custom tokens set, use a sensible default
    // Claude Code ACP requires MAX_THINKING_TOKENS env to enable thinking mode
    env['MAX_THINKING_TOKENS'] = 16000;
  }

  return env;
};

/**
 * Patch Codex config.toml with base URL, model, and reasoning effort
 * Used for writing to ~/.codex/config.toml
 */
export const patchCodexConfig = (baseConfig: string, baseUrl?: string, model?: string, reasoningEffort?: string): string => {
  let next = baseConfig || '';

  if (!next) {
    const resolvedModel = model || '';
    if (!resolvedModel) return next;
    // For Official mode, allow writing only the model by generating a minimal OpenAI provider block
    const resolvedBaseUrl = baseUrl || 'https://api.openai.com/v1';
    next = generateThirdPartyConfig('openai', resolvedBaseUrl, resolvedModel, reasoningEffort);
    return next;
  }

  // Patch base_url
  if (baseUrl) {
    next = next.replace(/base_url\s*=\s*".*?"/g, `base_url = "${baseUrl}"`);
  }

  // Patch model
  if (model) {
    next = next.replace(/model\s*=\s*".*?"/g, `model = "${model}"`);
  }

  // Patch reasoning effort
  if (reasoningEffort) {
    if (/model_reasoning_effort\s*=\s*".*?"/g.test(next)) {
      next = next.replace(/model_reasoning_effort\s*=\s*".*?"/g, `model_reasoning_effort = "${reasoningEffort}"`);
    } else {
      // Add after model line
      next = next.replace(/model\s*=\s*".*?"/g, (match) => `${match}\nmodel_reasoning_effort = "${reasoningEffort}"`);
    }
  }

  return next;
};

/**
 * Environment keys that should be cleared when switching to official mode
 */
export const CLAUDE_THIRD_PARTY_ENV_KEYS = ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_SMALL_FAST_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_OPUS_MODEL', 'ANTHROPIC_DEFAULT_HAIKU_MODEL'] as const;
