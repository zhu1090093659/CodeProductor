/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { app, BrowserWindow } from 'electron';
import type { ProgressInfo, UpdateDownloadedEvent, UpdateInfo } from 'electron-updater';
import { ipcBridge } from '../../common';
import { autoUpdater, checkForUpdates, downloadUpdate, getUpdateStatus, quitAndInstall } from '../autoUpdater';

/**
 * IPC Bridge for auto-updater functionality
 * 自动更新器的 IPC 桥接
 */

/**
 * Initialize auto-updater IPC bridge
 * 初始化自动更新器 IPC 桥接
 */
export function initAutoUpdaterBridge(): void {
  if (!app.isPackaged) {
    console.log('[AutoUpdaterBridge] Skipped: not in packaged mode');
    return;
  }

  // Provider: Check for updates
  ipcBridge.updater.checkForUpdates.provider(async () => {
    await checkForUpdates();
  });

  // Provider: Download update
  ipcBridge.updater.downloadUpdate.provider(async () => {
    await downloadUpdate();
  });

  // Provider: Quit and install
  ipcBridge.updater.quitAndInstall.provider(() => {
    quitAndInstall();
    return Promise.resolve();
  });

  // Provider: Get update status
  ipcBridge.updater.getUpdateStatus.provider(() => {
    return Promise.resolve(getUpdateStatus());
  });

  // Event listeners: Forward electron-updater events to renderer
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    ipcBridge.updater.onUpdateAvailable.emit({
      version: info.version,
      releaseDate: info.releaseDate || '',
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : '',
    });
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    ipcBridge.updater.onUpdateNotAvailable.emit({
      version: info.version,
    });
  });

  autoUpdater.on('download-progress', (progressObj: ProgressInfo) => {
    ipcBridge.updater.onDownloadProgress.emit({
      percent: progressObj.percent,
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total,
    });
  });

  autoUpdater.on('update-downloaded', (info: UpdateDownloadedEvent) => {
    ipcBridge.updater.onUpdateDownloaded.emit({
      version: info.version,
      releaseDate: info.releaseDate || '',
    });
  });

  autoUpdater.on('error', (error: Error) => {
    ipcBridge.updater.onError.emit({
      message: error.message,
      stack: error.stack,
    });
  });

  console.log('[AutoUpdaterBridge] Initialized successfully');
}
