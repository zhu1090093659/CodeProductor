/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProviderCategory } from './claudePresets';

export interface GeminiPresetTheme {
  icon?: 'gemini' | 'generic';
  backgroundColor?: string;
  textColor?: string;
}

export interface GeminiProviderPreset {
  name: string;
  websiteUrl: string;
  apiKeyUrl?: string;
  settingsConfig: {
    env: Record<string, string>;
  };
  baseURL?: string;
  model?: string;
  description?: string;
  category?: ProviderCategory;
  isPartner?: boolean;
  partnerPromotionKey?: string;
  endpointCandidates?: string[];
  theme?: GeminiPresetTheme;
  icon?: string;
  iconColor?: string;
}

export const GEMINI_PROVIDER_PRESETS: GeminiProviderPreset[] = [
  {
    name: 'Google Official',
    websiteUrl: 'https://ai.google.dev/',
    apiKeyUrl: 'https://aistudio.google.com/apikey',
    settingsConfig: {
      env: {},
    },
    description: 'Google 官方 Gemini API (OAuth)',
    category: 'official',
    partnerPromotionKey: 'google-official',
    theme: {
      icon: 'gemini',
      backgroundColor: '#4285F4',
      textColor: '#FFFFFF',
    },
    icon: 'gemini',
    iconColor: '#4285F4',
  },
  {
    name: 'PackyCode',
    websiteUrl: 'https://www.packyapi.com',
    apiKeyUrl: 'https://www.packyapi.com/register?aff=cc-switch',
    settingsConfig: {
      env: {
        GOOGLE_GEMINI_BASE_URL: 'https://www.packyapi.com',
        GEMINI_MODEL: 'gemini-3-pro',
      },
    },
    baseURL: 'https://www.packyapi.com',
    model: 'gemini-3-pro',
    description: 'PackyCode',
    category: 'third_party',
    isPartner: true,
    partnerPromotionKey: 'packycode',
    endpointCandidates: ['https://api-slb.packyapi.com', 'https://www.packyapi.com'],
    icon: 'packycode',
  },
  {
    name: 'Cubence',
    websiteUrl: 'https://cubence.com',
    apiKeyUrl: 'https://cubence.com/signup?code=CCSWITCH&source=ccs',
    settingsConfig: {
      env: {
        GOOGLE_GEMINI_BASE_URL: 'https://api.cubence.com',
        GEMINI_MODEL: 'gemini-3-pro',
      },
    },
    baseURL: 'https://api.cubence.com',
    model: 'gemini-3-pro',
    description: 'Cubence',
    category: 'third_party',
    isPartner: true,
    partnerPromotionKey: 'cubence',
    endpointCandidates: ['https://api.cubence.com/v1', 'https://api-cf.cubence.com/v1', 'https://api-dmit.cubence.com/v1', 'https://api-bwg.cubence.com/v1'],
    icon: 'cubence',
    iconColor: '#000000',
  },
  {
    name: 'AIGoCode',
    websiteUrl: 'https://aigocode.com',
    apiKeyUrl: 'https://aigocode.com/invite/CC-SWITCH',
    settingsConfig: {
      env: {
        GOOGLE_GEMINI_BASE_URL: 'https://api.aigocode.com/gemini',
        GEMINI_MODEL: 'gemini-3-pro',
      },
    },
    baseURL: 'https://api.aigocode.com/gemini',
    model: 'gemini-3-pro',
    description: 'AIGoCode',
    category: 'third_party',
    isPartner: true,
    partnerPromotionKey: 'aigocode',
    endpointCandidates: ['https://api.aigocode.com/gemini'],
    icon: 'aigocode',
    iconColor: '#5B7FFF',
  },
  {
    name: 'OpenRouter',
    websiteUrl: 'https://openrouter.ai',
    apiKeyUrl: 'https://openrouter.ai/keys',
    settingsConfig: {
      env: {
        GOOGLE_GEMINI_BASE_URL: 'https://openrouter.ai/api',
        GEMINI_MODEL: 'gemini-3-pro-preview',
      },
    },
    baseURL: 'https://openrouter.ai/api',
    model: 'gemini-3-pro',
    description: 'OpenRouter',
    category: 'aggregator',
    icon: 'openrouter',
    iconColor: '#6566F1',
  },
  {
    name: '自定义',
    websiteUrl: '',
    settingsConfig: {
      env: {
        GOOGLE_GEMINI_BASE_URL: '',
        GEMINI_MODEL: 'gemini-3-pro',
      },
    },
    model: 'gemini-3-pro',
    description: '自定义 Gemini API 端点',
    category: 'custom',
  },
];
