/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { copyDirectoryRecursively } from '../utils';
import { getSkillsDir } from '../initStorage';
import { scanSkills } from './skillFileService';

type SkillAgent = 'claude' | 'codex' | 'ai';

export type CopySkillEntry = {
  agent: SkillAgent;
  skill: string;
  targetDir: string;
};

export type CopySkillsToProjectResult = {
  copied: CopySkillEntry[];
  skipped: CopySkillEntry[];
  errors: Array<{ agent: SkillAgent; skill: string; error: string }>;
};

type EnabledSkillsByAgent = Record<string, string[] | undefined>;

const PROJECT_AGENT_SKILL_DIR: Record<'claude' | 'codex', string> = {
  claude: path.join('.claude', 'skills'),
  codex: path.join('.codex', 'skills'),
};

const sanitizeDirName = (name: string) => {
  // Replace characters invalid on Windows to avoid fs errors
  return name.replace(/[<>:"/\\|?*]/g, '_');
};

const normalizeSkillNames = (skills: string[] | undefined): string[] => {
  if (!Array.isArray(skills) || skills.length === 0) return [];
  return Array.from(new Set(skills.filter((name) => !!name && name.trim()).map((name) => name.trim())));
};

const pathExists = async (targetPath: string) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const copySkillNamesToTargetRoot = async (agent: SkillAgent, targetRoot: string, skillNames: string[], skillMap: Awaited<ReturnType<typeof scanSkills>>, result: CopySkillsToProjectResult) => {
  if (skillNames.length === 0) return;

  await fs.mkdir(targetRoot, { recursive: true });

  for (const skillName of skillNames) {
    const record = skillMap.get(skillName);
    const targetDir = path.join(targetRoot, sanitizeDirName(skillName));
    const entry = { agent, skill: skillName, targetDir };

    if (!record) {
      console.warn(`[SkillProject] Skill not found: ${skillName}`);
      result.skipped.push(entry);
      continue;
    }

    if (await pathExists(targetDir)) {
      result.skipped.push(entry);
      continue;
    }

    try {
      await copyDirectoryRecursively(record.dirPath, targetDir, { overwrite: false });
      result.copied.push(entry);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push({ agent, skill: skillName, error: message });
    }
  }
};

export const copySkillsToAiWorkspace = async (workspace: string, enabledSkills?: string[]): Promise<CopySkillsToProjectResult> => {
  const result: CopySkillsToProjectResult = { copied: [], skipped: [], errors: [] };
  if (!workspace || !workspace.trim()) {
    return result;
  }
  const skillNames = normalizeSkillNames(enabledSkills);
  if (skillNames.length === 0) {
    return result;
  }

  const targetWorkspace = path.resolve(workspace);
  const skillsDir = getSkillsDir();
  const skillMap = await scanSkills(skillsDir);
  const targetRoot = path.join(targetWorkspace, '.ai', 'skills');

  await copySkillNamesToTargetRoot('ai', targetRoot, skillNames, skillMap, result);
  return result;
};

export const copySkillsToProject = async (workspace: string, enabledByAgent?: EnabledSkillsByAgent): Promise<CopySkillsToProjectResult> => {
  const result: CopySkillsToProjectResult = { copied: [], skipped: [], errors: [] };
  if (!workspace || !workspace.trim()) {
    return result;
  }

  const claudeSkills = normalizeSkillNames(enabledByAgent?.claude);
  const codexSkills = normalizeSkillNames(enabledByAgent?.codex);
  const targetWorkspace = path.resolve(workspace);

  // Also sync union of selected skills to workspace/.ai/skills for workspace bridge usage
  const aiSkills = normalizeSkillNames(Object.values(enabledByAgent || {}).flat());
  if (claudeSkills.length === 0 && codexSkills.length === 0 && aiSkills.length === 0) {
    return result;
  }

  const skillsDir = getSkillsDir();
  const skillMap = await scanSkills(skillsDir);

  await copySkillNamesToTargetRoot('claude', path.join(targetWorkspace, PROJECT_AGENT_SKILL_DIR.claude), claudeSkills, skillMap, result);
  await copySkillNamesToTargetRoot('codex', path.join(targetWorkspace, PROJECT_AGENT_SKILL_DIR.codex), codexSkills, skillMap, result);
  await copySkillNamesToTargetRoot('ai', path.join(targetWorkspace, '.ai', 'skills'), aiSkills, skillMap, result);

  return result;
};
