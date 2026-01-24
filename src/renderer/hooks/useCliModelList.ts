/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import useSWR from 'swr';
import type { CliProviderTarget, CliProvidersStorage, IProvider } from '@/common/storage';
import { ConfigStorage } from '@/common/storage';
import useModeModeList from '@/renderer/hooks/useModeModeList';
import { CLAUDE_PROVIDER_PRESETS } from '@/renderer/config/cliProviders/claudePresets';
import { CODEX_PROVIDER_PRESETS } from '@/renderer/config/cliProviders/codexPresets';
import { hasSpecificModelCapability } from '@/renderer/utils/modelCapabilities';

/**
 * Cache for provider's available models to avoid repeated computation
 */
const availableModelsCache = new Map<string, string[]>();

/**
 * Get all available primary models for a provider (with cache)
 * @param provider - Provider configuration
 * @returns Array of available primary model names
 */
export const getAvailableModels = (provider: IProvider): string[] => {
  // Generate cache key including model list to detect changes
  const cacheKey = `${provider.id}-${(provider.model || []).join(',')}`;

  // Check cache
  if (availableModelsCache.has(cacheKey)) {
    return availableModelsCache.get(cacheKey)!;
  }

  // Compute available models
  const result: string[] = [];
  for (const modelName of provider.model || []) {
    const functionCalling = hasSpecificModelCapability(provider, modelName, 'function_calling');
    const excluded = hasSpecificModelCapability(provider, modelName, 'excludeFromPrimary');

    if ((functionCalling === true || functionCalling === undefined) && excluded !== true) {
      result.push(modelName);
    }
  }

  // Cache result
  availableModelsCache.set(cacheKey, result);
  return result;
};

/**
 * Check if provider has available primary conversation models (efficient version)
 * @param provider - Provider configuration
 * @returns true if provider has available models, false otherwise
 */
export const hasAvailableModels = (provider: IProvider): boolean => {
  // Use cached result directly to avoid repeated computation
  const availableModels = getAvailableModels(provider);
  return availableModels.length > 0;
};

/**
 * Get CLI provider target from agent key and preset type
 */
export const getCliProviderTarget = (agentKey?: string, agentPresetType?: CliProviderTarget | null): CliProviderTarget | null => {
  if (agentKey === 'codex' || agentKey === 'claude') return agentKey;
  return agentPresetType || null;
};

/**
 * Hook to get CLI model list based on selected agent
 * @param selectedAgentKey - The selected agent key (e.g., 'claude', 'codex')
 * @param selectedAgentPresetType - Optional preset type for custom agents
 * @returns Object containing modelList, isConfigured, hasEnabledModels, hasCliTarget, and isLoading
 */
export const useCliModelList = (selectedAgentKey: string, selectedAgentPresetType?: CliProviderTarget | null) => {
  const { data: cliProviders } = useSWR('cli.providers.shared', () => {
    return ConfigStorage.get('cli.providers').then((data) => data || ({} as CliProvidersStorage));
  });

  const cliTarget = useMemo(() => getCliProviderTarget(selectedAgentKey, selectedAgentPresetType || null), [selectedAgentKey, selectedAgentPresetType]);
  const cliConfig = cliTarget ? cliProviders?.[cliTarget] : undefined;

  const cliPreset = useMemo(() => {
    if (!cliTarget || !cliConfig?.presetName) return null;
    const presets = cliTarget === 'codex' ? CODEX_PROVIDER_PRESETS : CLAUDE_PROVIDER_PRESETS;
    return presets.find((p) => p.name === cliConfig.presetName) || null;
  }, [cliConfig?.presetName, cliTarget]);
  const isOfficialCliProvider = useMemo(() => cliPreset?.category === 'official', [cliPreset?.category]);

  const codexModelListState = useModeModeList(cliTarget === 'codex' ? 'openai' : '', cliConfig?.baseUrl, cliConfig?.apiKey, undefined, isOfficialCliProvider);
  const codexModels = useMemo(() => (cliTarget === 'codex' ? codexModelListState.data?.models?.map((item) => item.value) || [] : []), [cliTarget, codexModelListState.data?.models]);
  const claudeModelListState = useModeModeList(cliTarget === 'claude' ? 'anthropic' : '', cliConfig?.baseUrl, cliConfig?.apiKey, undefined, isOfficialCliProvider);
  const claudeModels = useMemo(() => (cliTarget === 'claude' ? claudeModelListState.data?.models?.map((item) => item.value) || [] : []), [cliTarget, claudeModelListState.data?.models]);
  const enabledModelSet = useMemo(() => new Set(cliConfig?.enabledModels || []), [cliConfig?.enabledModels]);

  const providerName = useMemo(() => {
    if (!cliTarget) return '';
    return cliConfig?.presetName || (cliTarget === 'codex' ? 'Codex' : 'Claude Code');
  }, [cliConfig?.presetName, cliTarget]);

  const modelList = useMemo(() => {
    if (!cliTarget) return [];
    const models = cliTarget === 'codex' ? codexModels : claudeModels;
    const filteredModels = enabledModelSet.size > 0 ? models.filter((model) => enabledModelSet.has(model)) : [];
    if (!filteredModels.length) return [];
    const provider: IProvider = {
      id: `cli:${cliTarget}`,
      platform: cliTarget,
      name: providerName,
      baseUrl: cliConfig?.baseUrl || '',
      apiKey: cliConfig?.apiKey || '',
      model: filteredModels,
    };
    return [provider].filter(hasAvailableModels);
  }, [cliTarget, codexModels, claudeModels, providerName, enabledModelSet, cliConfig?.apiKey, cliConfig?.baseUrl]);

  const isConfigured = useMemo(() => {
    if (!cliTarget) return false;
    if (isOfficialCliProvider) return true;
    if (cliTarget === 'codex') {
      return Boolean(cliConfig?.apiKey || cliConfig?.baseUrl);
    }
    return Boolean(cliConfig?.model);
  }, [cliTarget, cliConfig?.apiKey, cliConfig?.baseUrl, cliConfig?.model, isOfficialCliProvider]);

  const hasEnabledModels = useMemo(() => enabledModelSet.size > 0, [enabledModelSet.size]);

  return {
    modelList,
    isConfigured,
    hasEnabledModels,
    hasCliTarget: Boolean(cliTarget),
    isLoading: (cliTarget === 'codex' ? codexModelListState.isLoading : cliTarget === 'claude' ? claudeModelListState.isLoading : false) || false,
  };
};

export default useCliModelList;
