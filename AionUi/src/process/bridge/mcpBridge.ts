/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '../../common';
import { mcpService } from '@process/services/mcpServices/McpService';
import { mcpOAuthService } from '@process/services/mcpServices/McpOAuthService';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { JSONRPC_VERSION } from '@/types/acpTypes';

const callMcpTool = async (server: import('@/common/storage').IMcpServer, toolName: string, toolArgs: Record<string, unknown>) => {
  const transport = server.transport;

  if (transport.type === 'http') {
    const response = await fetch(transport.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...transport.headers,
      },
      body: JSON.stringify({
        jsonrpc: JSONRPC_VERSION,
        method: 'tools/call',
        id: Date.now(),
        params: {
          name: toolName,
          arguments: toolArgs,
        },
      }),
    });

    const result = await response.json();
    if (result?.error) {
      throw new Error(result.error.message || 'MCP tool call failed');
    }
    return result?.result;
  }

  let client: Client | null = null;
  try {
    if (transport.type === 'stdio') {
      client = new Client({ name: 'AionUi', version: 'local' }, { capabilities: { sampling: {} } });
      const stdio = new StdioClientTransport({
        command: transport.command,
        args: transport.args || [],
        env: { ...process.env, ...transport.env },
      });
      await client.connect(stdio);
    } else if (transport.type === 'sse') {
      client = new Client({ name: 'AionUi', version: 'local' }, { capabilities: { sampling: {} } });
      const sse = new SSEClientTransport(new URL(transport.url));
      await client.connect(sse);
    } else if (transport.type === 'streamable_http') {
      client = new Client({ name: 'AionUi', version: 'local' }, { capabilities: { sampling: {} } });
      const streamable = new StreamableHTTPClientTransport(new URL(transport.url));
      await client.connect(streamable);
    } else {
      throw new Error(`Unsupported transport: ${(transport as { type: string }).type}`);
    }

    const callTool = (client as any).callTool;
    if (typeof callTool === 'function') {
      return await callTool.call(client, { name: toolName, arguments: toolArgs });
    }
    return await (client as any).request('tools/call', { name: toolName, arguments: toolArgs });
  } finally {
    if (client) {
      try {
        await client.close();
      } catch {
        // Ignore close errors
      }
    }
  }
};

export function initMcpBridge(): void {
  // MCP 服务相关 IPC 处理程序
  ipcBridge.mcpService.getAgentMcpConfigs.provider(async (agents) => {
    try {
      const result = await mcpService.getAgentMcpConfigs(agents);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error getting MCP configs',
      };
    }
  });

  ipcBridge.mcpService.testMcpConnection.provider(async (server) => {
    try {
      const result = await mcpService.testMcpConnection(server);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error testing MCP connection',
      };
    }
  });

  ipcBridge.mcpService.syncMcpToAgents.provider(async ({ mcpServers, agents }) => {
    try {
      const result = await mcpService.syncMcpToAgents(mcpServers, agents);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error syncing MCP to agents',
      };
    }
  });

  ipcBridge.mcpService.removeMcpFromAgents.provider(async ({ mcpServerName, agents }) => {
    try {
      const result = await mcpService.removeMcpFromAgents(mcpServerName, agents);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error removing MCP from agents',
      };
    }
  });

  ipcBridge.mcpService.callTool.provider(async ({ server, toolName, toolArgs }) => {
    try {
      const result = await callMcpTool(server, toolName, toolArgs);
      return { success: true, data: { result } };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error calling MCP tool',
      };
    }
  });

  // OAuth 相关 IPC 处理程序
  ipcBridge.mcpService.checkOAuthStatus.provider(async (server) => {
    try {
      const result = await mcpOAuthService.checkOAuthStatus(server);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error checking OAuth status',
      };
    }
  });

  ipcBridge.mcpService.loginMcpOAuth.provider(async ({ server, config }) => {
    try {
      const result = await mcpOAuthService.login(server, config);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error during OAuth login',
      };
    }
  });

  ipcBridge.mcpService.logoutMcpOAuth.provider(async (serverName) => {
    try {
      await mcpOAuthService.logout(serverName);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error during OAuth logout',
      };
    }
  });

  ipcBridge.mcpService.getAuthenticatedServers.provider(async () => {
    try {
      const result = await mcpOAuthService.getAuthenticatedServers();
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error getting authenticated servers',
      };
    }
  });
}
