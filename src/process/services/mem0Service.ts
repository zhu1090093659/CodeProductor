/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IConfigStorageRefer } from '@/common/storage';
import { ProcessConfig } from '../initStorage';

export interface Mem0Memory {
  id: string;
  memory: string;
  created_at: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}

export interface Mem0SearchResult {
  id: string;
  memory: string;
  score: number;
  created_at: string;
  metadata?: Record<string, unknown>;
}

type Mem0Config = NonNullable<IConfigStorageRefer['tools.mem0']>;

/**
 * Mem0 Memory Service - Singleton for memory management via Mem0 REST API
 */
class Mem0Service {
  private cachedConfig: Mem0Config | null = null;

  private async getConfig(): Promise<Mem0Config | null> {
    if (this.cachedConfig) return this.cachedConfig;

    try {
      const config = await ProcessConfig.get('tools.mem0');
      if (!config?.enabled || !config?.apiKey || !config?.baseUrl) return null;
      this.cachedConfig = config;
      return config;
    } catch {
      return null;
    }
  }

  private async request<T>(config: Mem0Config, path: string, options: RequestInit = {}): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const baseUrl = config.baseUrl.replace(/\/$/, '');
      const headers: Record<string, string> = {
        Authorization: `Token ${config.apiKey}`,
        Accept: 'application/json',
      };
      if (options.method === 'POST') headers['Content-Type'] = 'application/json';

      const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
      if (!response.ok) throw new Error(`API error: ${response.status} - ${await response.text()}`);

      const data = options.method === 'DELETE' ? undefined : await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async isRetrievalEnabled(): Promise<boolean> {
    return (await this.getConfig())?.retrievalEnabled === true;
  }

  async isAutoAddEnabled(): Promise<boolean> {
    return (await this.getConfig())?.autoAddEnabled === true;
  }

  async searchMemories(query: string): Promise<{ success: boolean; memories?: Mem0SearchResult[]; error?: string }> {
    const config = await this.getConfig();
    if (!config) return { success: false, error: 'Mem0 is not configured or enabled' };

    const result = await this.request<{ results: Mem0SearchResult[] }>(config, '/v2/memories/search/', {
      method: 'POST',
      body: JSON.stringify({ query, filters: { user_id: config.userId }, top_k: config.retrievalLimit || 5 }),
    });
    return { success: result.success, memories: result.data?.results, error: result.error };
  }

  async getAllMemories(): Promise<{ success: boolean; memories?: Mem0Memory[]; error?: string }> {
    const config = await this.getConfig();
    if (!config) return { success: false, error: 'Mem0 is not configured or enabled' };

    const result = await this.request<{ results: Mem0Memory[] }>(config, '/v2/memories/', {
      method: 'POST',
      body: JSON.stringify({ filters: { user_id: config.userId } }),
    });
    return { success: result.success, memories: result.data?.results, error: result.error };
  }

  async addMemory(messages: Array<{ role: 'user' | 'assistant'; content: string }>): Promise<{ success: boolean; error?: string }> {
    const config = await this.getConfig();
    if (!config) return { success: false, error: 'Mem0 is not configured or enabled' };

    return this.request(config, '/v1/memories/', {
      method: 'POST',
      body: JSON.stringify({ messages, user_id: config.userId }),
    });
  }

  async deleteMemory(memoryId: string): Promise<{ success: boolean; error?: string }> {
    const config = await this.getConfig();
    if (!config) return { success: false, error: 'Mem0 is not configured or enabled' };

    return this.request(config, `/v1/memories/${encodeURIComponent(memoryId)}/`, { method: 'DELETE' });
  }

  async getStatus(): Promise<{ enabled: boolean; configured: boolean; retrievalEnabled: boolean }> {
    const config = await ProcessConfig.get('tools.mem0').catch(() => null);
    return {
      enabled: config?.enabled ?? false,
      configured: !!(config?.baseUrl && config?.apiKey && config?.userId),
      retrievalEnabled: config?.retrievalEnabled ?? false,
    };
  }

  reset(): void {
    this.cachedConfig = null;
  }
}

export const mem0Service = new Mem0Service();
