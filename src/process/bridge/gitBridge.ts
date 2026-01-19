/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { exec, execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const normalizeGitPath = (value: string) => value.replace(/\\/g, '/');

const resolveRepoRoot = async (cwd: string) => {
  const rootResult = await execFileAsync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], { timeout: 5000 });
  const repoRoot = rootResult.stdout.trim();
  if (!repoRoot) throw new Error('Not a git repository');
  return repoRoot;
};

const toRepoRelativePath = (repoRoot: string, cwd: string, filePath: string) => {
  const candidateAbs = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
  const relative = path.relative(repoRoot, candidateAbs);
  // If the filePath is already repo-relative (e.g. "src/a.ts"), path.relative may produce "..\\..\\src\\a.ts" when cwd is different.
  // In that case, fall back to the original input.
  const safe = relative.startsWith('..') ? filePath : relative;
  return normalizeGitPath(safe);
};

export function initGitBridge(): void {
  ipcBridge.git.diff.provider(async ({ cwd }) => {
    try {
      const repoRoot = await resolveRepoRoot(cwd);
      const diffResult = await execAsync(`git -C "${repoRoot}" diff`, { maxBuffer: 10 * 1024 * 1024 });
      return { success: true, data: { diff: diffResult.stdout || '' } };
    } catch (error) {
      return { success: false, msg: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcBridge.git.restoreFile.provider(async ({ cwd, filePath }) => {
    try {
      const repoRoot = await resolveRepoRoot(cwd);
      const repoRelPath = toRepoRelativePath(repoRoot, cwd, filePath);
      const candidateAbs = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);

      // Check if it's a tracked file
      let tracked = true;
      try {
        await execFileAsync('git', ['-C', repoRoot, 'ls-files', '--error-unmatch', '--', repoRelPath], { timeout: 5000 });
      } catch {
        tracked = false;
      }

      if (tracked) {
        await execFileAsync('git', ['-C', repoRoot, 'restore', '--staged', '--worktree', '--source=HEAD', '--', repoRelPath], { timeout: 15000 });
      } else {
        const absPath = !path.isAbsolute(filePath) && !repoRelPath.startsWith('..') ? path.resolve(repoRoot, repoRelPath) : candidateAbs;
        try {
          await fs.unlink(absPath);
        } catch (error) {
          // If already deleted, treat as success
          if ((error as any)?.code !== 'ENOENT') throw error;
        }
      }

      return { success: true };
    } catch (error) {
      return { success: false, msg: error instanceof Error ? error.message : String(error) };
    }
  });
}
