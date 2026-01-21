/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { app } from 'electron';
import path from 'path';
import { ipcBridge } from '../../common';
import { getSystemDir, getHomeDir, getSkillsDir, ProcessEnv } from '../initStorage';
import { copyDirectoryRecursively } from '../utils';
import WorkerManage from '../WorkerManage';
import { getZoomFactor, setZoomFactor } from '../utils/zoom';

export function initApplicationBridge(): void {
  ipcBridge.application.restart.provider(() => {
    // 清理所有工作进程
    WorkerManage.clear();
    // 重启应用 - 使用标准的 Electron 重启方式
    app.relaunch();
    app.exit(0);
    return Promise.resolve();
  });

  ipcBridge.application.updateSystemInfo.provider(async ({ cacheDir, workDir }) => {
    try {
      const oldDir = getSystemDir();
      if (oldDir.cacheDir !== cacheDir) {
        await copyDirectoryRecursively(oldDir.cacheDir, cacheDir);
      }
      await ProcessEnv.set('CodeConductor.dir', { cacheDir, workDir });
      return { success: true };
    } catch (e) {
      return { success: false, msg: e.message || e.toString() };
    }
  });

  ipcBridge.application.systemInfo.provider(() => {
    return Promise.resolve(getSystemDir());
  });

  ipcBridge.application.homeDir.provider(() => {
    return Promise.resolve({ homeDir: getHomeDir() });
  });

  ipcBridge.application.commandDirs.provider(() => {
    const home = getHomeDir();
    return Promise.resolve({
      cursor: path.join(home, '.cursor', 'commands'),
      claude: path.join(home, '.claude', 'commands'),
      codex: path.join(home, '.codex', 'prompts'),
    });
  });

  ipcBridge.application.superpowersCommandDir.provider(({ repoId, subdir }) => {
    const repoRoot = subdir ? path.join(getSkillsDir(), 'remote', repoId, subdir) : path.join(getSkillsDir(), 'remote', repoId);
    return Promise.resolve({ dir: path.join(repoRoot, 'commands') });
  });

  ipcBridge.application.openDevTools.provider(() => {
    // This will be handled by the main window when needed
    return Promise.resolve();
  });

  ipcBridge.application.getZoomFactor.provider(() => Promise.resolve(getZoomFactor()));

  ipcBridge.application.setZoomFactor.provider(({ factor }) => {
    return Promise.resolve(setZoomFactor(factor));
  });
}
