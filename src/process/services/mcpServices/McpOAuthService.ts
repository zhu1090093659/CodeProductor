/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMcpServer } from '../../../common/storage';

export interface OAuthStatus {
  isAuthenticated: boolean;
  needsLogin: boolean;
  error?: string;
}

/**
 * MCP OAuth 服务（简化版）
 *
 * 当前不处理完整的 OAuth 流程，仅用于检测是否需要 OAuth。
 * 若需要登录，login 会返回未支持提示，避免依赖外部实现。
 */
export class McpOAuthService {
  /**
   * 检查 MCP 服务器是否需要 OAuth 认证
   * 通过尝试连接并检查 WWW-Authenticate 头来判断
   */
  async checkOAuthStatus(server: IMcpServer): Promise<OAuthStatus> {
    try {
      if (server.transport.type !== 'http' && server.transport.type !== 'sse') {
        return { isAuthenticated: true, needsLogin: false };
      }

      const url = server.transport.url;
      if (!url) {
        return { isAuthenticated: false, needsLogin: false, error: 'No URL provided' };
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (response.status === 401 && response.headers.get('WWW-Authenticate')) {
        return { isAuthenticated: false, needsLogin: true };
      }

      return { isAuthenticated: true, needsLogin: false };
    } catch (error) {
      console.error('[McpOAuthService] Error checking OAuth status:', error);
      return {
        isAuthenticated: false,
        needsLogin: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 执行 OAuth 登录流程（当前未实现）
   */
  login(_server: IMcpServer, _oauthConfig?: unknown): Promise<{ success: boolean; error?: string }> {
    return Promise.resolve({ success: false, error: 'OAuth login is not available in this build.' });
  }

  /**
   * 获取有效的访问 token（当前未实现）
   */
  getValidToken(_server: IMcpServer, _oauthConfig?: unknown): Promise<string | null> {
    return Promise.resolve(null);
  }

  /**
   * 登出（当前未实现）
   */
  logout(_serverName: string): Promise<void> {
    return Promise.resolve();
  }

  /**
   * 获取所有已认证的服务器列表（当前未实现）
   */
  getAuthenticatedServers(): Promise<string[]> {
    return Promise.resolve([]);
  }
}

export const mcpOAuthService = new McpOAuthService();
