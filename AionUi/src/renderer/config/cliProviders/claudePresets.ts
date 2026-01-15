/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type ProviderCategory = 'official' | 'cn_official' | 'third_party' | 'aggregator' | 'custom';

export interface TemplateValueConfig {
  label: string;
  placeholder: string;
  defaultValue?: string;
  editorValue: string;
}

export interface PresetTheme {
  icon?: 'claude' | 'codex' | 'gemini' | 'generic';
  backgroundColor?: string;
  textColor?: string;
}

export interface ClaudeProviderPreset {
  name: string;
  websiteUrl: string;
  apiKeyUrl?: string;
  settingsConfig: {
    env: Record<string, string | number>;
  };
  isOfficial?: boolean;
  isPartner?: boolean;
  partnerPromotionKey?: string;
  category?: ProviderCategory;
  apiKeyField?: 'ANTHROPIC_AUTH_TOKEN' | 'ANTHROPIC_API_KEY';
  templateValues?: Record<string, TemplateValueConfig>;
  endpointCandidates?: string[];
  theme?: PresetTheme;
  icon?: string;
  iconColor?: string;
}

export const CLAUDE_PROVIDER_PRESETS: ClaudeProviderPreset[] = [
  {
    name: 'Claude Official',
    websiteUrl: 'https://www.anthropic.com/claude-code',
    settingsConfig: {
      env: {},
    },
    isOfficial: true,
    category: 'official',
    theme: {
      icon: 'claude',
      backgroundColor: '#D97757',
      textColor: '#FFFFFF',
    },
    icon: 'anthropic',
    iconColor: '#D4915D',
  },
  {
    name: 'DeepSeek',
    websiteUrl: 'https://platform.deepseek.com',
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_MODEL: 'DeepSeek-V3.2',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'DeepSeek-V3.2',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'DeepSeek-V3.2',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'DeepSeek-V3.2',
      },
    },
    category: 'cn_official',
    icon: 'deepseek',
    iconColor: '#1E88E5',
  },
  {
    name: 'Zhipu GLM',
    websiteUrl: 'https://open.bigmodel.cn',
    apiKeyUrl: 'https://www.bigmodel.cn/claude-code?ic=RRVJPB5SII',
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/anthropic',
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_MODEL: 'glm-4.7',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'glm-4.7',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'glm-4.7',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-4.7',
      },
    },
    category: 'cn_official',
    isPartner: true,
    partnerPromotionKey: 'zhipu',
    icon: 'zhipu',
    iconColor: '#0F62FE',
  },
  {
    name: 'Z.ai GLM',
    websiteUrl: 'https://z.ai',
    apiKeyUrl: 'https://z.ai/subscribe?ic=8JVLJQFSKB',
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic',
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_MODEL: 'glm-4.7',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'glm-4.7',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'glm-4.7',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-4.7',
      },
    },
    category: 'cn_official',
    isPartner: true,
    partnerPromotionKey: 'zhipu',
    icon: 'zhipu',
    iconColor: '#0F62FE',
  },
  {
    name: 'Qwen Coder',
    websiteUrl: 'https://bailian.console.aliyun.com',
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: 'https://dashscope.aliyuncs.com/apps/anthropic',
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_MODEL: 'qwen3-max',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'qwen3-max',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'qwen3-max',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'qwen3-max',
      },
    },
    category: 'cn_official',
    icon: 'qwen',
    iconColor: '#FF6A00',
  },
  {
    name: 'Kimi k2',
    websiteUrl: 'https://platform.moonshot.cn/console',
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.moonshot.cn/anthropic',
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_MODEL: 'kimi-k2-thinking',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'kimi-k2-thinking',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'kimi-k2-thinking',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'kimi-k2-thinking',
      },
    },
    category: 'cn_official',
    icon: 'kimi',
    iconColor: '#6366F1',
  },
  {
    name: 'Kimi For Coding',
    websiteUrl: 'https://www.kimi.com/coding/docs/',
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.kimi.com/coding/',
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_MODEL: 'kimi-for-coding',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'kimi-for-coding',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'kimi-for-coding',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'kimi-for-coding',
      },
    },
    category: 'cn_official',
    icon: 'kimi',
    iconColor: '#6366F1',
  },
  {
    name: 'ModelScope',
    websiteUrl: 'https://modelscope.cn',
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: 'https://api-inference.modelscope.cn',
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_MODEL: 'ZhipuAI/GLM-4.7',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'ZhipuAI/GLM-4.7',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'ZhipuAI/GLM-4.7',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'ZhipuAI/GLM-4.7',
      },
    },
    category: 'aggregator',
    icon: 'modelscope',
    iconColor: '#624AFF',
  },
  {
    name: 'KAT-Coder',
    websiteUrl: 'https://console.streamlake.ai',
    apiKeyUrl: 'https://console.streamlake.ai/console/api-key',
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: 'https://vanchin.streamlake.ai/api/gateway/v1/endpoints/${ENDPOINT_ID}/claude-code-proxy',
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_MODEL: 'KAT-Coder-Pro V1',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'KAT-Coder-Air V1',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'KAT-Coder-Pro V1',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'KAT-Coder-Pro V1',
      },
    },
    category: 'cn_official',
    templateValues: {
      ENDPOINT_ID: {
        label: 'Vanchin Endpoint ID',
        placeholder: 'ep-xxx-xxx',
        defaultValue: '',
        editorValue: '',
      },
    },
  },
  {
    name: 'Longcat',
    websiteUrl: 'https://longcat.chat/platform',
    apiKeyUrl: 'https://longcat.chat/platform/api_keys',
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.longcat.chat/anthropic',
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_MODEL: 'LongCat-Flash-Chat',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'LongCat-Flash-Chat',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'LongCat-Flash-Chat',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'LongCat-Flash-Chat',
        CLAUDE_CODE_MAX_OUTPUT_TOKENS: '6000',
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: 1,
      },
    },
    category: 'cn_official',
    icon: 'longcat',
    iconColor: '#29E154',
  },
  {
    name: 'MiniMax',
    websiteUrl: 'https://platform.minimaxi.com',
    apiKeyUrl: 'https://platform.minimaxi.com/subscribe/coding-plan',
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.minimaxi.com/anthropic',
        ANTHROPIC_AUTH_TOKEN: '',
        API_TIMEOUT_MS: '3000000',
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: 1,
        ANTHROPIC_MODEL: 'MiniMax-M2.1',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'MiniMax-M2.1',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'MiniMax-M2.1',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'MiniMax-M2.1',
      },
    },
    category: 'cn_official',
    isPartner: true,
    partnerPromotionKey: 'minimax_cn',
    theme: {
      backgroundColor: '#f64551',
      textColor: '#FFFFFF',
    },
    icon: 'minimax',
    iconColor: '#FF6B6B',
  },
  {
    name: 'MiniMax en',
    websiteUrl: 'https://platform.minimax.io',
    apiKeyUrl: 'https://platform.minimax.io/subscribe/coding-plan',
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.minimax.io/anthropic',
        ANTHROPIC_AUTH_TOKEN: '',
        API_TIMEOUT_MS: '3000000',
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: 1,
        ANTHROPIC_MODEL: 'MiniMax-M2.1',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'MiniMax-M2.1',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'MiniMax-M2.1',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'MiniMax-M2.1',
      },
    },
    category: 'cn_official',
    isPartner: true,
    partnerPromotionKey: 'minimax_en',
    theme: {
      backgroundColor: '#f64551',
      textColor: '#FFFFFF',
    },
    icon: 'minimax',
    iconColor: '#FF6B6B',
  },
  {
    name: 'DouBaoSeed',
    websiteUrl: 'https://www.volcengine.com/product/doubao',
    apiKeyUrl: 'https://www.volcengine.com/product/doubao',
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: 'https://ark.cn-beijing.volces.com/api/coding',
        ANTHROPIC_AUTH_TOKEN: '',
        API_TIMEOUT_MS: '3000000',
        ANTHROPIC_MODEL: 'doubao-seed-code-preview-latest',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'doubao-seed-code-preview-latest',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'doubao-seed-code-preview-latest',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'doubao-seed-code-preview-latest',
      },
    },
    category: 'cn_official',
    icon: 'doubao',
    iconColor: '#3370FF',
  },
  {
    name: 'BaiLing',
    websiteUrl: 'https://alipaytbox.yuque.com/sxs0ba/ling/get_started',
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.tbox.cn/api/anthropic',
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_MODEL: 'Ling-1T',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'Ling-1T',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'Ling-1T',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'Ling-1T',
      },
    },
    category: 'cn_official',
  },
  {
    name: 'AiHubMix',
    websiteUrl: 'https://aihubmix.com',
    apiKeyUrl: 'https://aihubmix.com',
    apiKeyField: 'ANTHROPIC_API_KEY',
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: 'https://aihubmix.com',
        ANTHROPIC_API_KEY: '',
      },
    },
    endpointCandidates: ['https://aihubmix.com', 'https://api.aihubmix.com'],
    category: 'aggregator',
    icon: 'aihubmix',
    iconColor: '#006FFB',
  },
  {
    name: 'DMXAPI',
    websiteUrl: 'https://www.dmxapi.cn',
    apiKeyUrl: 'https://www.dmxapi.cn',
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: 'https://www.dmxapi.cn',
        ANTHROPIC_AUTH_TOKEN: '',
      },
    },
    endpointCandidates: ['https://www.dmxapi.cn', 'https://api.dmxapi.cn'],
    category: 'aggregator',
    isPartner: true,
    partnerPromotionKey: 'dmxapi',
  },
  {
    name: 'PackyCode',
    websiteUrl: 'https://www.packyapi.com',
    apiKeyUrl: 'https://www.packyapi.com/register?aff=cc-switch',
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: 'https://www.packyapi.com',
        ANTHROPIC_AUTH_TOKEN: '',
      },
    },
    endpointCandidates: ['https://www.packyapi.com', 'https://api-slb.packyapi.com'],
    category: 'third_party',
    isPartner: true,
    partnerPromotionKey: 'packycode',
    icon: 'packycode',
  },
  {
    name: 'Cubence',
    websiteUrl: 'https://cubence.com',
    apiKeyUrl: 'https://cubence.com/signup?code=CCSWITCH&source=ccs',
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.cubence.com',
        ANTHROPIC_AUTH_TOKEN: '',
      },
    },
    endpointCandidates: ['https://api.cubence.com', 'https://api-cf.cubence.com', 'https://api-dmit.cubence.com', 'https://api-bwg.cubence.com'],
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
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.aigocode.com/api',
        ANTHROPIC_AUTH_TOKEN: '',
      },
    },
    endpointCandidates: ['https://api.aigocode.com'],
    category: 'third_party',
    isPartner: true,
    partnerPromotionKey: 'aigocode',
    icon: 'aigocode',
    iconColor: '#5B7FFF',
  },
  {
    name: 'OpenRouter',
    websiteUrl: 'https://openrouter.ai',
    apiKeyUrl: 'https://openrouter.ai/keys',
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: 'https://openrouter.ai/api',
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_MODEL: 'anthropic/claude-sonnet-4.5',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'anthropic/claude-haiku-4.5',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'anthropic/claude-sonnet-4.5',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'anthropic/claude-opus-4.5',
      },
    },
    category: 'aggregator',
    icon: 'openrouter',
    iconColor: '#6566F1',
  },
  {
    name: 'Xiaomi MiMo',
    websiteUrl: 'https://platform.xiaomimimo.com',
    apiKeyUrl: 'https://platform.xiaomimimo.com/#/console/api-keys',
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.xiaomimimo.com/anthropic',
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_MODEL: 'mimo-v2-flash',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'mimo-v2-flash',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'mimo-v2-flash',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'mimo-v2-flash',
      },
    },
    category: 'cn_official',
    icon: 'xiaomimimo',
    iconColor: '#000000',
  },
];
