/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import type { SkillRepoConfig } from '@/common/storage';
import { getSkillsDir } from '../initStorage';

const execAsync = promisify(exec);

const ensureDir = async (dirPath: string) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const getRepoRoot = (repoId: string) => {
  return path.join(getSkillsDir(), 'remote', repoId);
};

export async function syncSkillRepos(repos: SkillRepoConfig[]): Promise<{ repos: SkillRepoConfig[]; errors: Array<{ id: string; error: string }> }> {
  const errors: Array<{ id: string; error: string }> = [];
  const nextRepos = [...repos];

  await ensureDir(path.join(getSkillsDir(), 'remote'));

  for (const repo of nextRepos) {
    const repoRoot = getRepoRoot(repo.id);
    const branch = repo.branch || 'main';
    const cloneArgs = `--depth 1 --branch ${branch}`;

    try {
      await fs.access(repoRoot);
      await execAsync(`git -C "${repoRoot}" pull`, { timeout: 15000 });
      if (repo.subdir) {
        await fs.access(path.join(repoRoot, repo.subdir));
      }
      repo.lastSync = Date.now();
      continue;
    } catch {
      // continue to clone
    }

    try {
      await execAsync(`git clone ${cloneArgs} "${repo.url}" "${repoRoot}"`, { timeout: 30000 });
      if (repo.subdir) {
        await fs.access(path.join(repoRoot, repo.subdir));
      }
      repo.lastSync = Date.now();
    } catch (error) {
      errors.push({ id: repo.id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { repos: nextRepos, errors };
}
