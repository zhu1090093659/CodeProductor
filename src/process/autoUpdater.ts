/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { app } from 'electron';
import { autoUpdater, type UpdateDownloadedEvent, type UpdateInfo } from 'electron-updater';
import * as path from 'path';

/**
 * Auto-updater configuration and utilities
 * 自动更新配置和工具函数
 */

// Update check interval: 4 hours
const UPDATE_CHECK_INTERVAL = 4 * 60 * 60 * 1000;

let updateCheckTimer: NodeJS.Timeout | null = null;
let isUpdateAvailable = false;
let downloadedVersion: string | null = null;

/**
 * Configure auto-updater settings
 * 配置自动更新器
 */
function configureAutoUpdater(): void {
  // Only enable auto-updater in packaged builds
  if (!app.isPackaged) {
    console.log('[AutoUpdater] Skipped: running in development mode');
    return;
  }

  // Configure update logging
  autoUpdater.logger = {
    info: (message) => console.log(`[AutoUpdater] ${message}`),
    warn: (message) => console.warn(`[AutoUpdater] ${message}`),
    error: (message) => console.error(`[AutoUpdater] ${message}`),
    debug: (message) => console.debug(`[AutoUpdater] ${message}`),
  };

  // Set auto-download to false, we'll manually trigger downloads after user confirmation
  autoUpdater.autoDownload = false;

  // Set auto-install-on-app-quit to true for seamless updates
  autoUpdater.autoInstallOnAppQuit = true;

  // Disable automatic update checks (we'll handle them manually)
  autoUpdater.autoRunAppAfterInstall = true;

  // Configure update feed URL (GitHub Releases)
  // electron-updater automatically uses package.json repository field
  console.log('[AutoUpdater] Configured for GitHub Releases');
}

/**
 * Setup event listeners for auto-updater
 * 设置自动更新器事件监听
 */
function setupEventListeners(): void {
  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for updates...');
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    console.log('[AutoUpdater] Update available:', info.version);
    isUpdateAvailable = true;

    // Emit event to renderer process via IPC bridge
    // This will be handled by autoUpdaterBridge.ts
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    console.log('[AutoUpdater] Already up to date:', info.version);
    isUpdateAvailable = false;
  });

  autoUpdater.on('error', (error) => {
    console.error('[AutoUpdater] Error:', error);
    isUpdateAvailable = false;
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const message = `Downloaded ${progressObj.percent.toFixed(2)}% (${(progressObj.bytesPerSecond / 1024 / 1024).toFixed(2)} MB/s)`;
    console.log('[AutoUpdater]', message);
  });

  autoUpdater.on('update-downloaded', (info: UpdateDownloadedEvent) => {
    console.log('[AutoUpdater] Update downloaded:', info.version);
    downloadedVersion = info.version;

    // Notify user that update is ready to install
    // User will be prompted to restart the app
  });
}

/**
 * Check for updates
 * 检查更新
 */
export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) {
    console.log('[AutoUpdater] Skipped: not in packaged mode');
    return;
  }

  try {
    console.log('[AutoUpdater] Manually checking for updates...');
    await autoUpdater.checkForUpdates();
  } catch (error) {
    console.error('[AutoUpdater] Failed to check for updates:', error);
  }
}

/**
 * Download the available update
 * 下载可用更新
 */
export async function downloadUpdate(): Promise<void> {
  if (!isUpdateAvailable) {
    console.log('[AutoUpdater] No update available to download');
    return;
  }

  try {
    console.log('[AutoUpdater] Starting update download...');
    await autoUpdater.downloadUpdate();
  } catch (error) {
    console.error('[AutoUpdater] Failed to download update:', error);
  }
}

/**
 * Quit and install the downloaded update
 * 退出并安装已下载的更新
 */
export function quitAndInstall(): void {
  if (!downloadedVersion) {
    console.log('[AutoUpdater] No update downloaded yet');
    return;
  }

  console.log('[AutoUpdater] Quitting and installing update...');
  // setImmediate ensures that the app quits after the current event loop
  setImmediate(() => {
    app.removeAllListeners('window-all-closed');
    autoUpdater.quitAndInstall(false, true);
  });
}

/**
 * Start periodic update checks
 * 启动定期更新检查
 */
function startPeriodicChecks(): void {
  // Initial check on startup (after 10 seconds to allow app to fully load)
  setTimeout(() => {
    void checkForUpdates();
  }, 10000);

  // Periodic checks every 4 hours
  updateCheckTimer = setInterval(() => {
    void checkForUpdates();
  }, UPDATE_CHECK_INTERVAL);

  console.log('[AutoUpdater] Periodic update checks enabled (every 4 hours)');
}

/**
 * Stop periodic update checks
 * 停止定期更新检查
 */
function stopPeriodicChecks(): void {
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer);
    updateCheckTimer = null;
    console.log('[AutoUpdater] Periodic update checks disabled');
  }
}

/**
 * Initialize auto-updater
 * 初始化自动更新器
 */
export function initAutoUpdater(): void {
  if (!app.isPackaged) {
    console.log('[AutoUpdater] Initialization skipped: not in packaged mode');
    return;
  }

  console.log('[AutoUpdater] Initializing...');

  configureAutoUpdater();
  setupEventListeners();
  startPeriodicChecks();

  // Clean up on app quit
  app.on('before-quit', () => {
    stopPeriodicChecks();
  });

  console.log('[AutoUpdater] Initialized successfully');
}

/**
 * Get current update status
 * 获取当前更新状态
 */
export function getUpdateStatus(): {
  isUpdateAvailable: boolean;
  downloadedVersion: string | null;
} {
  return {
    isUpdateAvailable,
    downloadedVersion,
  };
}

// Export autoUpdater instance for use in bridge
export { autoUpdater };
