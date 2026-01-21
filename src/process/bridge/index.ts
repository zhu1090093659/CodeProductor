/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { app } from 'electron';
import { acpDetector } from '@/agent/acp/AcpDetector';
import { initAcpConversationBridge } from './acpConversationBridge';
import { initApplicationBridge } from './applicationBridge';
import { initAutoUpdaterBridge } from './autoUpdaterBridge';
import { initCodexConversationBridge } from './codexConversationBridge';
import { initConversationBridge } from './conversationBridge';
import { initDocumentBridge } from './documentBridge';
import { initDatabaseBridge } from './databaseBridge';
import { initDialogBridge } from './dialogBridge';
import { initFsBridge } from './fsBridge';
import { initMcpBridge } from './mcpBridge';
import { initModelBridge } from './modelBridge';
import { initPreviewHistoryBridge } from './previewHistoryBridge';
import { initShellBridge } from './shellBridge';
import { initProviderBridge } from './providerBridge';
import { initSkillsBridge } from './skillsBridge';
import { initGitBridge } from './gitBridge';
import { initTerminalBridge } from './terminalBridge';
import { initWindowControlsBridge } from './windowControlsBridge';
import { initSuperpowersBridge } from './superpowersBridge';

/**
 * 初始化所有IPC桥接模块
 */
export function initAllBridges(): void {
  initDialogBridge();
  initShellBridge();
  initFsBridge();
  initConversationBridge();
  initApplicationBridge();
  initAcpConversationBridge();
  initCodexConversationBridge();
  initModelBridge();
  initProviderBridge();
  initSkillsBridge();
  initSuperpowersBridge();
  initMcpBridge();
  initDatabaseBridge();
  initPreviewHistoryBridge();
  initDocumentBridge();
  initWindowControlsBridge();
  initGitBridge();
  initTerminalBridge();

  // Auto-updater bridge (only in packaged app)
  if (app.isPackaged) {
    initAutoUpdaterBridge();
  }
}

/**
 * 初始化ACP检测器
 */
export async function initializeAcpDetector(): Promise<void> {
  try {
    await acpDetector.initialize();
  } catch (error) {
    console.error('[ACP] Failed to initialize detector:', error);
  }
}

// 导出初始化函数供单独使用
export { initAcpConversationBridge, initApplicationBridge, initAutoUpdaterBridge, initCodexConversationBridge, initConversationBridge, initDatabaseBridge, initDialogBridge, initDocumentBridge, initFsBridge, initGitBridge, initMcpBridge, initModelBridge, initPreviewHistoryBridge, initProviderBridge, initSkillsBridge, initShellBridge, initSuperpowersBridge, initTerminalBridge, initWindowControlsBridge };
// 导出窗口控制相关工具函数
export { registerWindowMaximizeListeners } from './windowControlsBridge';
