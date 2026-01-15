/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PresetTheme, ProviderCategory } from './claudePresets';

export interface CodexProviderPreset {
  name: string;
  websiteUrl: string;
  apiKeyUrl?: string;
  auth: Record<string, unknown>;
  config: string;
  isOfficial?: boolean;
  isPartner?: boolean;
  partnerPromotionKey?: string;
  category?: ProviderCategory;
  isCustomTemplate?: boolean;
  endpointCandidates?: string[];
  theme?: PresetTheme;
  icon?: string;
  iconColor?: string;
}

export function generateThirdPartyAuth(apiKey: string): Record<string, unknown> {
  return {
    OPENAI_API_KEY: apiKey || '',
  };
}

export function generateThirdPartyConfig(providerName: string, baseUrl: string, modelName = 'gpt-5.1-codex'): string {
  const cleanProviderName = providerName
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '') || 'custom';

  return `model_provider = "${cleanProviderName}"
model = "${modelName}"
model_reasoning_effort = "high"
disable_response_storage = true

[model_providers.${cleanProviderName}]
name = "${cleanProviderName}"
base_url = "${baseUrl}"
wire_api = "responses"
requires_openai_auth = true`;
}

export const CODEX_PROVIDER_PRESETS: CodexProviderPreset[] = [
  {
    name: 'OpenAI Official',
    websiteUrl: 'https://chatgpt.com/codex',
    isOfficial: true,
    category: 'official',
    auth: {},
    config: '',
    theme: {
      icon: 'codex',
      backgroundColor: '#1F2937',
      textColor: '#FFFFFF',
    },
    icon: 'openai',
    iconColor: '#00A67E',
  },
  {
    name: 'Azure OpenAI',
    websiteUrl: 'https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/codex',
    category: 'third_party',
    isOfficial: true,
    auth: generateThirdPartyAuth(''),
    config: `model_provider = "azure"
model = "gpt-5.2"
model_reasoning_effort = "high"
disable_response_storage = true

[model_providers.azure]
name = "Azure OpenAI"
base_url = "https://YOUR_RESOURCE_NAME.openai.azure.com/openai"
env_key = "OPENAI_API_KEY"
query_params = { "api-version" = "2025-04-01-preview" }
wire_api = "responses"
requires_openai_auth = true`,
    endpointCandidates: ['https://YOUR_RESOURCE_NAME.openai.azure.com/openai'],
    theme: {
      icon: 'codex',
      backgroundColor: '#0078D4',
      textColor: '#FFFFFF',
    },
    icon: 'azure',
    iconColor: '#0078D4',
  },
  {
    name: 'AiHubMix',
    websiteUrl: 'https://aihubmix.com',
    category: 'aggregator',
    auth: generateThirdPartyAuth(''),
    config: generateThirdPartyConfig('aihubmix', 'https://aihubmix.com/v1', 'gpt-5.2'),
    endpointCandidates: ['https://aihubmix.com/v1', 'https://api.aihubmix.com/v1'],
  },
  {
    name: 'DMXAPI',
    websiteUrl: 'https://www.dmxapi.cn',
    category: 'aggregator',
    auth: generateThirdPartyAuth(''),
    config: generateThirdPartyConfig('dmxapi', 'https://www.dmxapi.cn/v1', 'gpt-5.2'),
    endpointCandidates: ['https://www.dmxapi.cn/v1'],
    isPartner: true,
    partnerPromotionKey: 'dmxapi',
  },
  {
    name: 'PackyCode',
    websiteUrl: 'https://www.packyapi.com',
    apiKeyUrl: 'https://www.packyapi.com/register?aff=cc-switch',
    category: 'third_party',
    auth: generateThirdPartyAuth(''),
    config: generateThirdPartyConfig('packycode', 'https://www.packyapi.com/v1', 'gpt-5.2'),
    endpointCandidates: ['https://www.packyapi.com/v1', 'https://api-slb.packyapi.com/v1'],
    isPartner: true,
    partnerPromotionKey: 'packycode',
    icon: 'packycode',
  },
  {
    name: 'Cubence',
    websiteUrl: 'https://cubence.com',
    apiKeyUrl: 'https://cubence.com/signup?code=CCSWITCH&source=ccs',
    auth: generateThirdPartyAuth(''),
    config: generateThirdPartyConfig('cubence', 'https://api.cubence.com/v1', 'gpt-5.2'),
    endpointCandidates: ['https://api.cubence.com/v1', 'https://api-cf.cubence.com/v1', 'https://api-dmit.cubence.com/v1', 'https://api-bwg.cubence.com/v1'],
    category: 'third_party',
    isPartner: true,
    partnerPromotionKey: 'cubence',
    icon: 'cubence',
    iconColor: '#000000',
  },
  {
    name: 'AIGoCode',
    websiteUrl: 'https://aigocode.com',
    apiKeyUrl: 'https://aigocode.com/invite/CC-SWITCH',
    category: 'third_party',
    auth: generateThirdPartyAuth(''),
    config: generateThirdPartyConfig('aigocode', 'https://api.aigocode.com/openai', 'gpt-5.2'),
    endpointCandidates: ['https://api.aigocode.com'],
    isPartner: true,
    partnerPromotionKey: 'aigocode',
    icon: 'aigocode',
    iconColor: '#5B7FFF',
  },
  {
    name: 'OpenRouter',
    websiteUrl: 'https://openrouter.ai',
    apiKeyUrl: 'https://openrouter.ai/keys',
    auth: generateThirdPartyAuth(''),
    config: generateThirdPartyConfig('openrouter', 'https://openrouter.ai/api/v1', 'gpt-5.2'),
    category: 'aggregator',
    icon: 'openrouter',
    iconColor: '#6566F1',
  },
];
