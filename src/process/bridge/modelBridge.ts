/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IProvider } from '@/common/storage';
import { uuid } from '@/common/utils';
import { type ProtocolDetectionRequest, type ProtocolDetectionResponse, type ProtocolType, type MultiKeyTestResult, parseApiKeys, maskApiKey, normalizeBaseUrl, removeApiPathSuffix, guessProtocolFromUrl, guessProtocolFromKey, getProtocolDisplayName } from '@/common/utils/protocolDetector';
import { isGoogleApisHost } from '@/common/utils/urlValidation';
import OpenAI from 'openai';
import { ipcBridge } from '../../common';
import { ProcessConfig } from '../initStorage';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

/**
 * OpenAI 兼容 API 的常见路径格式
 * Common path patterns for OpenAI-compatible APIs
 *
 * 用于自动修复用户输入的 base URL，便于维护和扩展
 * Used to auto-fix user-provided base URLs, easy to maintain and extend
 */
const API_PATH_PATTERNS = [
  '/v1', // 标准格式 / Standard: OpenAI, DeepSeek, Moonshot, Mistral, SiliconFlow, 讯飞星火, 腾讯混元
  '/api/v1', // 代理格式 / Proxy: OpenRouter
  '/openai/v1', // Groq
  '/compatible-mode/v1', // 阿里云 DashScope / Alibaba Cloud
  '/compatibility/v1', // Cohere
  '/v2', // 百度千帆 / Baidu Qianfan
  '/api/v3', // 火山引擎 Ark / Volcengine
  '/api/paas/v4', // 智谱 / Zhipu
];

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';

const getCodexAuthPath = () => {
  const home = os.homedir();
  return path.join(home, '.codex', 'auth.json');
};

const readJsonSafe = async (filePath: string): Promise<Record<string, unknown>> => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const getDefaultOpenAIModels = (): string[] => {
  // NOTE: Fallback list for Official mode when we cannot fetch from /v1/models.
  // Keep it small and conservative to avoid misleading users.
  return ['gpt-5.2', 'gpt-5.2-codex', 'gpt-5.1', 'gpt-5.1-codex'];
};

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
};

const extractTokenCandidatesDeep = (authJson: Record<string, unknown>, maxDepth: number = 6): string[] => {
  const results: Array<{ key: string; value: string }> = [];

  const visit = (node: unknown, pathKey: string, depth: number) => {
    if (depth > maxDepth) return;
    if (typeof node === 'string') {
      const trimmed = node.trim();
      if (trimmed) {
        results.push({ key: pathKey, value: trimmed });
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, idx) => visit(item, `${pathKey}[${idx}]`, depth + 1));
      return;
    }
    if (isPlainObject(node)) {
      for (const [k, v] of Object.entries(node)) {
        visit(v, pathKey ? `${pathKey}.${k}` : k, depth + 1);
      }
    }
  };

  visit(authJson, '', 0);

  // Prefer keys that look like credentials.
  const priorityKeyPatterns = [/OPENAI_API_KEY/i, /api[_-]?key/i, /access[_-]?token/i, /refresh[_-]?token/i, /id[_-]?token/i, /token/i];
  const score = (item: { key: string; value: string }) => {
    const keyScore = priorityKeyPatterns.findIndex((re) => re.test(item.key));
    const keyWeight = keyScore === -1 ? 0 : 100 - keyScore * 10;
    const valueWeight = item.value.startsWith('sk-') ? 50 : item.value.startsWith('eyJ') ? 30 : item.value.length >= 30 ? 10 : 0;
    return keyWeight + valueWeight;
  };

  return results
    .sort((a, b) => score(b) - score(a))
    .map((x) => x.value)
    .filter((v, idx, arr) => arr.indexOf(v) === idx);
};

const getCodexAuthPreferredToken = (authJson: Record<string, unknown>): string | undefined => {
  // Prefer the Codex OAuth access token if present (common shape: { tokens: { access_token: "..." } })
  const tokens = authJson['tokens'];
  if (isPlainObject(tokens)) {
    const access = tokens['access_token'] ?? tokens['accessToken'];
    if (typeof access === 'string' && access.trim()) return access.trim();
  }

  return extractOpenAIBearerToken(authJson);
};

const extractOpenAIBearerToken = (authJson: Record<string, unknown>): string | undefined => {
  // Keep a fast path for common fields, and fall back to a deep scan for unknown shapes.
  const fastCandidates = [authJson['OPENAI_API_KEY'], authJson['api_key'], authJson['access_token'], authJson['accessToken'], authJson['token']];
  for (const c of fastCandidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return extractTokenCandidatesDeep(authJson)[0];
};

const getKnownClaudeModels = (): string[] => {
  // NOTE: Claude Code supports model aliases (recommended) and full model names.
  // There is no public "models list" endpoint for Anthropic, so we return a curated list.
  // Keep aliases first to avoid hard-coding outdated versioned names.
  return [
    // Model aliases (preferred)
    'default',
    'sonnet',
    'opus',
    'haiku',
    'sonnet[1m]',
    'opusplan',

    // Full model name examples (optional)
    // Users can also manually type any valid full model name in settings.json / env.
    'anthropic.claude-sonnet-4-5-20250929-v1:0',
    'anthropic.claude-opus-4-5-20250929-v1:0',
    'anthropic.claude-haiku-4-5-20250929-v1:0',
  ];
};

const normalizeModelId = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return null;
};

const extractModelId = (item: unknown): string | null => {
  const direct = normalizeModelId(item);
  if (direct) return direct;
  if (!item || typeof item !== 'object') return null;
  const obj = item as Record<string, unknown>;
  return normalizeModelId(obj.id) || normalizeModelId(obj.name) || normalizeModelId(obj.model);
};

const extractModelIdsFromResponse = (payload: unknown): string[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    const ids = payload.map(extractModelId).filter((id): id is string => Boolean(id));
    return Array.from(new Set(ids));
  }
  if (typeof payload !== 'object') return [];
  const obj = payload as Record<string, unknown>;
  const list = Array.isArray(obj.data) ? obj.data : Array.isArray(obj.models) ? obj.models : null;
  if (!list) return [];
  const ids = list.map(extractModelId).filter((id): id is string => Boolean(id));
  return Array.from(new Set(ids));
};

const getOpenAIModelListUrls = (baseUrl: string): string[] => {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return [];
  const urls = [`${normalized}/models`];
  if (!/\/v1$/i.test(normalized)) {
    urls.push(`${normalized}/v1/models`);
  }
  return urls;
};

const fetchOpenAICompatibleModels = async (baseUrl: string, apiKey: string): Promise<string[] | null> => {
  const urls = getOpenAIModelListUrls(baseUrl);
  if (!urls.length) return null;

  const headerCandidates: Array<Record<string, string>> = [{ Authorization: `Bearer ${apiKey}` }, { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }];

  for (const url of urls) {
    for (const headers of headerCandidates) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
        });

        if (!response.ok) continue;
        const data = await response.json().catch(() => null);
        const models = extractModelIdsFromResponse(data);
        if (models.length > 0) {
          return models;
        }
      } catch {
        // continue trying other endpoints/headers
      } finally {
        clearTimeout(timeoutId);
      }
    }
  }

  return null;
};

export function initModelBridge(): void {
  ipcBridge.mode.fetchModelList.provider(async function fetchModelList({ base_url, api_key, try_fix, platform }): Promise<{ success: boolean; msg?: string; data?: { mode: Array<string>; fix_base_url?: string } }> {
    // 如果是多key（包含逗号或回车），只取第一个key来获取模型列表
    // If multiple keys (comma or newline separated), use only the first one
    let actualApiKey = api_key;
    if (api_key && (api_key.includes(',') || api_key.includes('\n'))) {
      actualApiKey = api_key.split(/[,\n]/)[0].trim();
    }

    // Claude / Anthropic: try third-party OpenAI-compatible models endpoint, fall back to curated list.
    if (platform?.includes('anthropic') || platform?.includes('claude')) {
      if (base_url && base_url.trim() && actualApiKey && actualApiKey.trim()) {
        const models = await fetchOpenAICompatibleModels(base_url, actualApiKey);
        if (models && models.length > 0) {
          return { success: true, data: { mode: models } };
        }
      }
      return { success: true, data: { mode: getKnownClaudeModels() } };
    }

    // 如果是 Vertex AI 平台，直接返回 Vertex AI 支持的模型列表
    // For Vertex AI platform, return the supported model list directly
    if (platform?.includes('vertex-ai')) {
      console.log('Using Vertex AI model list');
      const vertexAIModels = ['gemini-2.5-pro', 'gemini-2.5-flash'];
      return { success: true, data: { mode: vertexAIModels } };
    }

    // 如果是 Gemini 平台，使用 Gemini API 协议
    // For Gemini platform, use Gemini API protocol
    if (platform?.includes('gemini')) {
      try {
        // 使用自定义 base_url 或默认的 Gemini endpoint
        // Use custom base_url or default Gemini endpoint
        const geminiUrl = base_url ? `${base_url}/models?key=${encodeURIComponent(actualApiKey)}` : `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(actualApiKey)}`;

        const response = await fetch(geminiUrl);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.models || !Array.isArray(data.models)) {
          throw new Error('Invalid response format');
        }

        // 提取模型名称，移除 "models/" 前缀
        // Extract model names, remove "models/" prefix
        const modelList = data.models.map((model: { name: string }) => {
          const name = model.name;
          return name.startsWith('models/') ? name.substring(7) : name;
        });

        return { success: true, data: { mode: modelList } };
      } catch (e: any) {
        // 对于 Gemini 平台，API 调用失败时回退到默认模型列表
        // For Gemini platform, fall back to default model list on API failure
        if (platform?.includes('gemini')) {
          console.warn('Failed to fetch Gemini models via API, falling back to default list:', e.message);
          const defaultGeminiModels = ['gemini-2.5-pro', 'gemini-2.5-flash'];
          return { success: true, data: { mode: defaultGeminiModels } };
        }
        return { success: false, msg: e.message || e.toString() };
      }
    }

    // OpenAI official CLI mode: allow empty base_url/api_key and read credential from ~/.codex/auth.json
    if (platform?.includes('openai')) {
      const resolvedBaseUrl = base_url && base_url.trim() ? base_url : DEFAULT_OPENAI_BASE_URL;
      if (!actualApiKey || !actualApiKey.trim()) {
        const authJson = await readJsonSafe(getCodexAuthPath());
        const token = getCodexAuthPreferredToken(authJson);

        if (token) {
          // Use a direct fetch with timeout to avoid hanging the UI when network is blocked.
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          try {
            const res = await fetch(`${resolvedBaseUrl}/models`, {
              method: 'GET',
              signal: controller.signal,
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            });

            if (res.ok) {
              const json = (await res.json()) as { data?: Array<{ id: string }> } | { models?: Array<{ id?: string; name?: string }> };
              const ids = 'data' in json && Array.isArray(json.data) ? json.data.map((m) => m.id).filter((id): id is string => typeof id === 'string' && id.trim().length > 0) : 'models' in json && Array.isArray(json.models) ? json.models.map((m) => (m.id || m.name || '').toString()).filter((id) => id.trim().length > 0) : [];

              if (ids.length > 0) {
                return { success: true, data: { mode: ids } };
              }
            }
          } catch {
            // ignore, fall back
          } finally {
            clearTimeout(timeoutId);
          }
        }

        // If we cannot fetch (auth shape mismatch / network blocked), fall back so UI remains usable.
        return { success: true, data: { mode: getDefaultOpenAIModels() } };
      }
      base_url = resolvedBaseUrl;
      if (!actualApiKey || !actualApiKey.trim()) {
        return { success: true, data: { mode: getDefaultOpenAIModels() } };
      }
    }

    const openai = new OpenAI({
      baseURL: base_url,
      apiKey: actualApiKey,
    });

    try {
      const res = await openai.models.list();
      // 检查返回的数据是否有效，LM Studio 获取失败时仍会返回空数据
      // Check if response data is valid, LM Studio returns empty data on failure
      if (res.data?.length === 0) {
        throw new Error('Invalid response: empty data');
      }
      return { success: true, data: { mode: res.data.map((v) => v.id) } };
    } catch (e) {
      // For OpenAI official mode, keep UI usable even when auth is not compatible with /v1/models.
      if (platform?.includes('openai') && base_url === DEFAULT_OPENAI_BASE_URL) {
        return { success: true, data: { mode: getDefaultOpenAIModels() } };
      }
      const errRes = { success: false, msg: e.message || e.toString() };

      if (!try_fix) return errRes;

      // 如果是 API key 问题，直接返回错误，不尝试修复 URL
      // If it's an API key issue, return error directly without trying to fix URL
      if (e.status === 401 || e.message?.includes('401') || e.message?.includes('Unauthorized') || e.message?.includes('Invalid API key')) {
        return errRes;
      }

      // 用户输入的 URL 已经请求失败，按优先级尝试多种可能的 URL 格式
      // User's URL request failed, try multiple possible URL formats with priority
      const url = new URL(base_url);
      const pathname = url.pathname.replace(/\/+$/, ''); // 移除末尾斜杠 / Remove trailing slashes
      const base = `${url.protocol}//${url.host}`;

      // 构建优先级候选 URL 列表 / Build prioritized candidate URL list
      // 优先级 1: 用户路径相关的变体 / Priority 1: User path variants
      const userPathUrls = new Set<string>();
      // 优先级 2: 标准 API 路径格式 / Priority 2: Standard API path patterns
      const standardUrls = new Set<string>();

      // 1. 用户路径 + 常见后缀（适用于代理场景）/ User path + common suffixes (for proxy scenarios)
      if (pathname && pathname !== '/') {
        userPathUrls.add(`${base}${pathname}/v1`);
        // 也尝试用户路径本身（可能只是缺少末尾斜杠）
        // Also try user's path itself (might just be missing trailing slash)
        userPathUrls.add(`${base}${pathname}`);
      }

      // 2. 尝试所有已知的 API 路径格式 / Try all known API path patterns
      API_PATH_PATTERNS.forEach((pattern) => standardUrls.add(`${base}${pattern}`));

      // 移除原始 URL（已经请求过了）/ Remove original URL (already tried)
      userPathUrls.delete(base_url);
      standardUrls.delete(base_url);

      const tryFetch = (candidateUrl: string) =>
        fetchModelList({ base_url: candidateUrl, api_key: api_key, try_fix: false }).then((res) => {
          if (res.success) {
            return { ...res, data: { mode: res.data.mode, fix_base_url: candidateUrl } };
          }
          return Promise.reject(res);
        });

      // 实现 Promise.any 的效果：第一个成功的 resolve，全部失败才 reject
      // Implement Promise.any: resolve on first success, reject only if all fail
      const promiseAny = <T>(promises: Promise<T>[]): Promise<T> =>
        new Promise((resolve, reject) => {
          let rejectCount = 0;
          if (promises.length === 0) {
            reject(new Error('No promises to try'));
            return;
          }
          promises.forEach((p) =>
            p.then(resolve).catch(() => {
              rejectCount++;
              if (rejectCount === promises.length) reject(new Error('All promises rejected'));
            })
          );
        });

      // 按优先级顺序尝试：先用户路径变体，再标准格式
      // Try in priority order: user path variants first, then standard patterns
      try {
        // 优先级 1: 并行尝试用户路径相关的 URL
        // Priority 1: Try user path variants in parallel
        if (userPathUrls.size > 0) {
          try {
            return await promiseAny([...userPathUrls].map(tryFetch));
          } catch {
            // 用户路径变体全部失败，继续尝试标准格式
            // User path variants all failed, continue to standard patterns
          }
        }

        // 优先级 2: 并行尝试标准 API 路径格式
        // Priority 2: Try standard API path patterns in parallel
        if (standardUrls.size > 0) {
          return await promiseAny([...standardUrls].map(tryFetch));
        }

        return errRes;
      } catch {
        // 所有尝试都失败，返回原始错误 / All attempts failed, return original error
        return errRes;
      }
    }
  });

  ipcBridge.mode.saveModelConfig.provider((models) => {
    return ProcessConfig.set('model.config', models)
      .then(() => {
        return { success: true };
      })
      .catch((e) => {
        return { success: false, msg: e.message || e.toString() };
      });
  });

  ipcBridge.mode.getModelConfig.provider(() => {
    return ProcessConfig.get('model.config')
      .then((data) => {
        if (!data) return [];

        // Handle migration from old IModel format to new IProvider format
        return data.map((v: any, _index: number) => {
          // Check if this is old format (has 'selectedModel' field) vs new format (has 'useModel')
          if ('selectedModel' in v && !('useModel' in v)) {
            // Migrate from old format
            return {
              ...v,
              useModel: v.selectedModel, // Rename selectedModel to useModel
              id: v.id || uuid(),
              capabilities: v.capabilities || [], // Add missing capabilities field
              contextLimit: v.contextLimit, // Keep existing contextLimit if present
            };
            // Note: we don't delete selectedModel here as this is read-only migration
          }

          // Already in new format or unknown format, just ensure ID exists
          return {
            ...v,
            id: v.id || uuid(),
            useModel: v.useModel || v.selectedModel || '', // Fallback for edge cases
          };
        });
      })
      .catch(() => {
        return [] as IProvider[];
      });
  });

  // 协议检测接口实现 / Protocol detection implementation
  ipcBridge.mode.detectProtocol.provider(async function detectProtocol(request: ProtocolDetectionRequest): Promise<{ success: boolean; msg?: string; data?: ProtocolDetectionResponse }> {
    const { baseUrl: rawBaseUrl, apiKey: apiKeyString, timeout = 10000, testAllKeys = false, preferredProtocol } = request;

    const baseUrl = normalizeBaseUrl(rawBaseUrl);
    const baseUrlCandidates = buildBaseUrlCandidates(baseUrl);
    const apiKeys = parseApiKeys(apiKeyString);

    if (!baseUrl) {
      return {
        success: false,
        msg: 'Base URL is required',
        data: {
          success: false,
          protocol: 'unknown',
          confidence: 0,
          error: 'Base URL is required',
        },
      };
    }

    if (apiKeys.length === 0) {
      return {
        success: false,
        msg: 'API Key is required',
        data: {
          success: false,
          protocol: 'unknown',
          confidence: 0,
          error: 'API Key is required',
        },
      };
    }

    const firstKey = apiKeys[0];

    // 智能预判：根据 URL 和 Key 格式猜测协议
    // Smart prediction: guess protocol from URL and key format
    const urlGuess = guessProtocolFromUrl(baseUrl);
    const keyGuess = guessProtocolFromKey(firstKey);

    // 确定测试顺序：优先测试猜测的协议
    // Determine test order: prioritize guessed protocols
    const protocolsToTest: ProtocolType[] = [];

    if (preferredProtocol && preferredProtocol !== 'unknown') {
      protocolsToTest.push(preferredProtocol);
    }
    if (urlGuess && !protocolsToTest.includes(urlGuess)) {
      protocolsToTest.push(urlGuess);
    }
    if (keyGuess && !protocolsToTest.includes(keyGuess)) {
      protocolsToTest.push(keyGuess);
    }
    // 添加剩余协议
    for (const p of ['gemini', 'openai', 'anthropic'] as ProtocolType[]) {
      if (!protocolsToTest.includes(p)) {
        protocolsToTest.push(p);
      }
    }

    let detectedProtocol: ProtocolType = 'unknown';
    let confidence = 0;
    let models: string[] = [];
    let detectionError: string | undefined;
    let fixedBaseUrl: string | undefined;
    let detectedBaseUrl: string | undefined;

    // 依次测试每种协议
    // Test each protocol in order
    for (const protocol of protocolsToTest) {
      for (const candidateBaseUrl of baseUrlCandidates) {
        const result = await testProtocol(candidateBaseUrl, firstKey, protocol, timeout);

        if (result.success) {
          detectedProtocol = protocol;
          confidence = result.confidence;
          models = result.models || [];
          fixedBaseUrl = result.fixedBaseUrl;
          detectedBaseUrl = candidateBaseUrl;
          break;
        } else if (!detectionError) {
          detectionError = result.error;
        }
      }
      if (detectedProtocol !== 'unknown') {
        break;
      }
    }

    // 多 Key 测试
    // Multi-key testing
    let multiKeyResult: MultiKeyTestResult | undefined;
    const baseUrlForTesting = detectedBaseUrl || baseUrlCandidates[0] || baseUrl;
    if (testAllKeys && apiKeys.length > 1 && detectedProtocol !== 'unknown') {
      multiKeyResult = await testMultipleKeys(baseUrlForTesting, apiKeys, detectedProtocol, timeout);
    }

    // 生成建议
    // Generate suggestion
    const suggestion = generateSuggestion(detectedProtocol, confidence, baseUrlForTesting, detectionError);

    const response: ProtocolDetectionResponse = {
      success: detectedProtocol !== 'unknown',
      protocol: detectedProtocol,
      confidence,
      error: detectedProtocol === 'unknown' ? detectionError : undefined,
      fixedBaseUrl,
      suggestion,
      multiKeyResult,
      models,
    };

    return {
      success: true,
      data: response,
    };
  });
}

/**
 * 构建候选 URL 列表
 * Build candidate URL list
 *
 * 策略：
 * 1. 先尝试用户输入的原始 URL
 * 2. 如果原始 URL 包含已知的 API 路径后缀，添加移除后缀的版本作为备选
 * 3. 哪个先成功就用哪个
 *
 * Strategy:
 * 1. Try user's original URL first
 * 2. If original URL contains known API path suffix, add suffix-removed version as fallback
 * 3. Use whichever succeeds first
 */
function buildBaseUrlCandidates(baseUrl: string): string[] {
  if (!baseUrl) return [];

  const candidates: string[] = [];

  // 处理协议前缀
  const hasProtocol = /^https?:\/\//i.test(baseUrl);
  const urlsToProcess = hasProtocol ? [baseUrl] : [`https://${baseUrl}`, `http://${baseUrl}`];

  for (const url of urlsToProcess) {
    // 1. 原始 URL 优先
    candidates.push(url);

    // 2. 如果包含已知路径后缀，添加移除后缀的版本
    const strippedUrl = removeApiPathSuffix(url);
    if (strippedUrl && strippedUrl !== url && !candidates.includes(strippedUrl)) {
      candidates.push(strippedUrl);
    }
  }

  return candidates;
}

/**
 * 测试单个协议
 * Test a single protocol
 */
async function testProtocol(
  baseUrl: string,
  apiKey: string,
  protocol: ProtocolType,
  timeout: number
): Promise<{
  success: boolean;
  confidence: number;
  error?: string;
  models?: string[];
  fixedBaseUrl?: string;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    switch (protocol) {
      case 'gemini':
        return await testGeminiProtocol(baseUrl, apiKey, controller.signal);
      case 'openai':
        return await testOpenAIProtocol(baseUrl, apiKey, controller.signal);
      case 'anthropic':
        return await testAnthropicProtocol(baseUrl, apiKey, controller.signal);
      default:
        return { success: false, confidence: 0, error: 'Unknown protocol' };
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, confidence: 0, error: 'Request timeout' };
    }
    return { success: false, confidence: 0, error: error.message || String(error) };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 测试 Gemini 协议
 * Test Gemini protocol
 */
async function testGeminiProtocol(baseUrl: string, apiKey: string, signal: AbortSignal): Promise<{ success: boolean; confidence: number; error?: string; models?: string[]; fixedBaseUrl?: string }> {
  // Gemini API Key 格式: AIza...
  // 尝试多个可能的端点
  const endpoints = [
    { url: `${baseUrl}/v1beta/models?key=${encodeURIComponent(apiKey)}`, version: 'v1beta' },
    { url: `${baseUrl}/v1/models?key=${encodeURIComponent(apiKey)}`, version: 'v1' },
    { url: `${baseUrl}/models?key=${encodeURIComponent(apiKey)}`, version: 'root' },
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, {
        method: 'GET',
        signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.models && Array.isArray(data.models)) {
          const models = data.models.map((m: any) => {
            const name = m.name || '';
            return name.startsWith('models/') ? name.substring(7) : name;
          });
          return {
            success: true,
            confidence: 95,
            models,
            fixedBaseUrl: endpoint.version !== 'v1beta' ? baseUrl : undefined,
          };
        }
      }

      // 检查特定的 Gemini 错误响应
      if (response.status === 400 || response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error?.message?.includes('API key')) {
          // API key 格式错误但确认是 Gemini 协议
          return { success: false, confidence: 80, error: 'Invalid API key format for Gemini' };
        }
      }
    } catch (e) {
      // 继续尝试下一个端点
    }
  }

  return { success: false, confidence: 0, error: 'Not a Gemini API endpoint' };
}

/**
 * 测试 OpenAI 协议
 * Test OpenAI protocol
 */
async function testOpenAIProtocol(baseUrl: string, apiKey: string, signal: AbortSignal): Promise<{ success: boolean; confidence: number; error?: string; models?: string[]; fixedBaseUrl?: string }> {
  // 尝试多个可能的端点
  const endpoints = [
    { url: `${baseUrl}/models`, path: '' },
    { url: `${baseUrl}/v1/models`, path: '/v1' },
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, {
        method: 'GET',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          const models = data.data.map((m: any) => m.id);
          return {
            success: true,
            confidence: 95,
            models,
            fixedBaseUrl: endpoint.path ? `${baseUrl}${endpoint.path}` : undefined,
          };
        }
        // 有些 OpenAI 兼容 API 返回 models 而不是 data
        if (data.models && Array.isArray(data.models)) {
          const models = data.models.map((m: any) => m.id || m.name);
          return {
            success: true,
            confidence: 85,
            models,
            fixedBaseUrl: endpoint.path ? `${baseUrl}${endpoint.path}` : undefined,
          };
        }
      }

      // 401 错误说明是 OpenAI 协议但 key 无效
      if (response.status === 401) {
        return { success: false, confidence: 70, error: 'Invalid API key for OpenAI protocol' };
      }
    } catch (e) {
      // 继续尝试下一个端点
    }
  }

  return { success: false, confidence: 0, error: 'Not an OpenAI-compatible API endpoint' };
}

/**
 * 检查响应是否为 Anthropic 格式
 * Check if response is in Anthropic format
 *
 * Anthropic 的响应/错误格式特征：
 * - 成功响应: { id: "msg_...", type: "message", ... }
 * - 错误响应: { type: "error", error: { type: "...", message: "..." } }
 */
function isAnthropicResponse(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;

  // 成功响应格式
  if (obj.type === 'message' && typeof obj.id === 'string' && obj.id.startsWith('msg_')) {
    return true;
  }

  // 错误响应格式
  if (obj.type === 'error' && obj.error && typeof obj.error === 'object') {
    const errorObj = obj.error as Record<string, unknown>;
    // Anthropic 错误类型: invalid_request_error, authentication_error, etc.
    if (typeof errorObj.type === 'string' && typeof errorObj.message === 'string') {
      return true;
    }
  }

  return false;
}

/**
 * 测试 Anthropic 协议
 * Test Anthropic protocol
 */
async function testAnthropicProtocol(baseUrl: string, apiKey: string, signal: AbortSignal): Promise<{ success: boolean; confidence: number; error?: string; models?: string[]; fixedBaseUrl?: string }> {
  // Anthropic 没有 models 端点，需要用 messages 端点测试
  // 发送一个最小请求来验证认证
  const endpoints = [
    { url: `${baseUrl}/v1/messages`, path: '/v1' },
    { url: `${baseUrl}/messages`, path: '' },
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });

      // 尝试解析响应体
      let responseData: unknown;
      try {
        responseData = await response.json();
      } catch {
        // 无法解析 JSON，不是 Anthropic 协议
        continue;
      }

      // 200 表示成功
      if (response.ok && isAnthropicResponse(responseData)) {
        const models = ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-3-5-sonnet-20241022'];
        return {
          success: true,
          confidence: 95,
          models,
          fixedBaseUrl: endpoint.path ? `${baseUrl}${endpoint.path}` : undefined,
        };
      }

      // 400/401 需要验证是否为 Anthropic 格式的错误响应
      if ((response.status === 400 || response.status === 401) && isAnthropicResponse(responseData)) {
        if (response.status === 401) {
          return { success: false, confidence: 70, error: 'Invalid API key for Anthropic protocol' };
        }
        // 400 参数错误但认证成功（Anthropic 格式验证通过）
        const models = ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-3-5-sonnet-20241022'];
        return {
          success: true,
          confidence: 90,
          models,
          fixedBaseUrl: endpoint.path ? `${baseUrl}${endpoint.path}` : undefined,
        };
      }
    } catch (e) {
      // 继续尝试下一个端点
    }
  }

  return { success: false, confidence: 0, error: 'Not an Anthropic API endpoint' };
}

/**
 * 测试多个 Key 的连通性（并发执行）
 * Test connectivity for multiple keys (concurrent execution)
 *
 * 参考 GPT-Load 的设计，采用并发测试提高效率
 * Reference GPT-Load design, use concurrent testing for efficiency
 */
async function testMultipleKeys(
  baseUrl: string,
  apiKeys: string[],
  protocol: ProtocolType,
  timeout: number,
  concurrency: number = 5 // 最大并发数，避免触发限流 / Max concurrency to avoid rate limiting
): Promise<MultiKeyTestResult> {
  const results: MultiKeyTestResult['details'] = [];

  // 分批并发执行 / Execute in batches concurrently
  for (let batchStart = 0; batchStart < apiKeys.length; batchStart += concurrency) {
    const batchEnd = Math.min(batchStart + concurrency, apiKeys.length);
    const batch = apiKeys.slice(batchStart, batchEnd);

    const batchPromises = batch.map(async (key, batchIndex) => {
      const globalIndex = batchStart + batchIndex;
      const startTime = Date.now();

      try {
        const result = await testProtocol(baseUrl, key, protocol, timeout);
        return {
          index: globalIndex,
          maskedKey: maskApiKey(key),
          valid: result.success,
          error: result.error,
          latency: Date.now() - startTime,
        };
      } catch (e: unknown) {
        return {
          index: globalIndex,
          maskedKey: maskApiKey(key),
          valid: false,
          error: e instanceof Error ? e.message : String(e),
          latency: Date.now() - startTime,
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  // 按原始索引排序 / Sort by original index
  results.sort((a, b) => a.index - b.index);

  return {
    total: apiKeys.length,
    valid: results.filter((r) => r.valid).length,
    invalid: results.filter((r) => !r.valid).length,
    details: results,
  };
}

/**
 * 生成建议
 * Generate suggestion
 *
 * 返回 i18n key 和参数，前端负责翻译
 * Return i18n key and params, frontend handles translation
 */
function generateSuggestion(protocol: ProtocolType, _confidence: number, baseUrl: string, error?: string): ProtocolDetectionResponse['suggestion'] {
  if (protocol === 'unknown') {
    if (error?.includes('timeout') || error?.includes('Timeout')) {
      return {
        type: 'check_key',
        message: 'Connection timeout, please check network or API URL',
        i18nKey: 'settings.protocolTimeout',
      };
    }
    if (error?.includes('API key') || error?.includes('401') || error?.includes('Unauthorized')) {
      return {
        type: 'check_key',
        message: 'Invalid API Key, please check your key',
        i18nKey: 'settings.protocolInvalidKey',
      };
    }
    return {
      type: 'check_key',
      message: 'Unable to identify API protocol, please check configuration',
      i18nKey: 'settings.protocolCheckConfig',
    };
  }

  const displayName = getProtocolDisplayName(protocol);

  // 检测到 Gemini 协议但用户可能选择了其他平台
  // Detected Gemini protocol but user may have selected a different platform
  if (protocol === 'gemini' && !isGoogleApisHost(baseUrl)) {
    return {
      type: 'switch_platform',
      message: `Detected ${displayName} protocol, consider switching to Gemini for better support`,
      suggestedPlatform: 'gemini',
      i18nKey: 'settings.protocolSwitchSuggestion',
      i18nParams: { protocol: displayName, platform: 'Gemini' },
    };
  }

  // 检测到 Anthropic 协议
  if (protocol === 'anthropic') {
    return {
      type: 'switch_platform',
      message: `Detected ${displayName} protocol, using custom mode`,
      suggestedPlatform: 'Anthropic',
      i18nKey: 'settings.protocolSwitchSuggestion',
      i18nParams: { protocol: displayName, platform: 'Anthropic' },
    };
  }

  // OpenAI 协议是默认支持的
  if (protocol === 'openai') {
    return {
      type: 'none',
      message: `Detected ${displayName}-compatible protocol, configuration is correct`,
      i18nKey: 'settings.protocolOpenAICompatible',
    };
  }

  return {
    type: 'none',
    message: `Identified as ${displayName} protocol`,
    i18nKey: 'settings.protocolDetected',
    i18nParams: { protocol: displayName },
  };
}
