/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConfigStorage, type IConfigStorageRefer } from '@/common/storage';

// Mem0 API response types
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
    const config = await ConfigStorage.get('tools.mem0');
    if (!config?.enabled || !config?.apiKey || !config?.baseUrl) return null;
    this.cachedConfig = config;
    return config;
  }

  private getBaseUrl(config: Mem0Config): string {
    return config.baseUrl.replace(/\/$/, '');
  }

  private getHeaders(config: Mem0Config, json = true): Record<string, string> {
    const headers: Record<string, string> = { Authorization: `Token ${config.apiKey}` };
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
  }

  private async request<T>(config: Mem0Config, path: string, options: RequestInit = {}): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const response = await fetch(`${this.getBaseUrl(config)}${path}`, {
        ...options,
        headers: this.getHeaders(config, options.method === 'POST'),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }
      const data = options.method === 'DELETE' ? undefined : await response.json();
      return { success: true, data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Mem0Service] Request failed:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async isRetrievalEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config?.retrievalEnabled === true;
  }

  async isAutoAddEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config?.autoAddEnabled === true;
  }

  async searchMemories(query: string): Promise<{ success: boolean; memories?: Mem0SearchResult[]; error?: string }> {
    const config = await this.getConfig();
    if (!config) return { success: false, error: 'Mem0 is not configured or enabled' };

    const result = await this.request<Mem0SearchResult[]>(config, '/v1/memories/search', {
      method: 'POST',
      body: JSON.stringify({ query, user_id: config.userId, limit: config.retrievalLimit || 5 }),
    });
    return { success: result.success, memories: result.data, error: result.error };
  }

  async getAllMemories(): Promise<{ success: boolean; memories?: Mem0Memory[]; error?: string }> {
    const config = await this.getConfig();
    if (!config) return { success: false, error: 'Mem0 is not configured or enabled' };

    const result = await this.request<Mem0Memory[]>(config, `/v1/memories?user_id=${encodeURIComponent(config.userId)}`);
    return { success: result.success, memories: result.data, error: result.error };
  }

  async addMemory(messages: Array<{ role: 'user' | 'assistant'; content: string }>): Promise<{ success: boolean; error?: string }> {
    const config = await this.getConfig();
    if (!config) return { success: false, error: 'Mem0 is not configured or enabled' };

    return this.request(config, '/v1/memories', {
      method: 'POST',
      body: JSON.stringify({ messages, user_id: config.userId }),
    });
  }

  async deleteMemory(memoryId: string): Promise<{ success: boolean; error?: string }> {
    const config = await this.getConfig();
    if (!config) return { success: false, error: 'Mem0 is not configured or enabled' };

    return this.request(config, `/v1/memories/${encodeURIComponent(memoryId)}`, { method: 'DELETE' });
  }

  async getStatus(): Promise<{ enabled: boolean; configured: boolean; retrievalEnabled: boolean }> {
    const config = await ConfigStorage.get('tools.mem0');
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
