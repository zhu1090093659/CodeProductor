/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
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

const readEnvFile = async (filePath: string): Promise<Record<string, string>> => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const env: Record<string, string> = {};
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx === -1) return;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      env[key] = value;
    });
    return env;
  } catch {
    return {};
  }
};

const writeEnvFile = async (filePath: string, env: Record<string, string>) => {
  await ensureDir(filePath);
  const lines = Object.entries(env).map(([key, value]) => `${key}=${value}`);
  await fs.writeFile(filePath, lines.join('\n') + '\n', 'utf-8');
};

const getCliPaths = () => {
  const home = os.homedir();
  return {
    claudeSettings: path.join(home, '.claude', 'settings.json'),
    codexAuth: path.join(home, '.codex', 'auth.json'),
    codexConfig: path.join(home, '.codex', 'config.toml'),
    geminiEnv: path.join(home, '.gemini', '.env'),
    geminiSettings: path.join(home, '.gemini', 'settings.json'),
  };
};

export async function applyCliProvider(payload: CliProviderApplyPayload): Promise<void> {
  const paths = getCliPaths();

  if (payload.target === 'claude') {
    const current = await readJson(paths.claudeSettings);
    const env = { ...(current.env as Record<string, string> | undefined), ...payload.env };
    await writeJson(paths.claudeSettings, { ...current, env });
    return;
  }

  if (payload.target === 'codex') {
    const auth = payload.auth || {};
    await writeJson(paths.codexAuth, auth as Record<string, unknown>);
    if (payload.configToml && payload.configToml.trim()) {
      await ensureDir(paths.codexConfig);
      await fs.writeFile(paths.codexConfig, payload.configToml, 'utf-8');
    }
    return;
  }

  if (payload.target === 'gemini') {
    const existingEnv = await readEnvFile(paths.geminiEnv);
    const mergedEnv = { ...existingEnv, ...payload.env };
    await writeEnvFile(paths.geminiEnv, mergedEnv);
    if (payload.settings) {
      const existingSettings = await readJson(paths.geminiSettings);
      await writeJson(paths.geminiSettings, { ...existingSettings, ...payload.settings });
    }
  }
}
