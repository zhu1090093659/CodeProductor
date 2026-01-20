/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { CliProviderApplyPayload } from '@/common/types/provider';

const ensureDir = async (filePath: string) => {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
};

const readJson = async (filePath: string): Promise<Record<string, unknown>> => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const writeJson = async (filePath: string, data: Record<string, unknown>) => {
  await ensureDir(filePath);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

const getCliPaths = () => {
  const home = os.homedir();
  return {
    claudeSettings: path.join(home, '.claude', 'settings.json'),
    codexAuth: path.join(home, '.codex', 'auth.json'),
    codexConfig: path.join(home, '.codex', 'config.toml'),
  };
};

export async function applyCliProvider(payload: CliProviderApplyPayload): Promise<void> {
  const paths = getCliPaths();

  if (payload.target === 'claude') {
    const current = await readJson(paths.claudeSettings);
    const existingEnv = { ...(current.env as Record<string, string> | undefined) };
    if (Array.isArray(payload.clearEnvKeys) && payload.clearEnvKeys.length > 0) {
      for (const key of payload.clearEnvKeys) {
        delete existingEnv[key];
      }
    }
    const env = { ...existingEnv, ...payload.env };
    const settingsPatch = payload.settingsPatch && typeof payload.settingsPatch === 'object' ? payload.settingsPatch : {};
    const usesNonBrowserLogin = typeof payload.env?.['ANTHROPIC_AUTH_TOKEN'] === 'string' || typeof payload.env?.['ANTHROPIC_API_KEY'] === 'string';
    const nextCurrent = { ...current };
    if (usesNonBrowserLogin && 'model' in nextCurrent) {
      delete nextCurrent.model;
    }
    // Merge root-level settings patch but keep env as the final merged env.
    await writeJson(paths.claudeSettings, { ...nextCurrent, ...settingsPatch, env });
    return;
  }

  if (payload.target === 'codex') {
    const shouldPatchAuth = (payload.authPatch && Object.keys(payload.authPatch).length > 0) || (Array.isArray(payload.clearAuthKeys) && payload.clearAuthKeys.length > 0);

    if (shouldPatchAuth) {
      const currentAuth = await readJson(paths.codexAuth);
      const nextAuth = { ...currentAuth };

      if (Array.isArray(payload.clearAuthKeys) && payload.clearAuthKeys.length > 0) {
        for (const key of payload.clearAuthKeys) {
          delete nextAuth[key];
        }
      }
      if (payload.authPatch) {
        Object.assign(nextAuth, payload.authPatch);
      }

      await writeJson(paths.codexAuth, nextAuth as Record<string, unknown>);
    }

    if (payload.clearConfigToml) {
      try {
        await fs.unlink(paths.codexConfig);
      } catch {
        // ignore
      }
      return;
    }

    if (payload.configToml && payload.configToml.trim()) {
      await ensureDir(paths.codexConfig);
      await fs.writeFile(paths.codexConfig, payload.configToml, 'utf-8');
      return;
    }
    return;
  }

  return;
}
