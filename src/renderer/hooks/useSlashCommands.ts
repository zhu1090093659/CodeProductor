/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { ConfigStorage, type CustomCommandConfig, type SkillRepoConfig, type SuperpowersConfig } from '@/common/storage';
import { dedupeCommands, getCommandNameFromPath, getNamespaceFromPath, parseCommandMarkdown, type CommandSource, type SlashCommandItem } from '@/renderer/utils/commandRegistry';
import { useCallback, useEffect, useState } from 'react';

const BUILTIN_COMMANDS: SlashCommandItem[] = [
  {
    id: 'builtin:/run',
    name: 'run',
    trigger: 'run',
    description: 'Run a terminal command',
    body: '',
    source: 'builtin',
  },
  {
    id: 'builtin:/plan',
    name: 'plan',
    trigger: 'plan',
    description: 'Generate a project plan file',
    body: '',
    source: 'builtin',
  },
  {
    id: 'builtin:/pm',
    name: 'pm',
    trigger: 'pm',
    description: 'Project management utilities',
    body: '',
    source: 'builtin',
  },
  {
    id: 'builtin:/browser',
    name: 'browser',
    trigger: 'browser',
    description: 'Run agent-browser commands',
    body: '',
    source: 'builtin',
  },
];

const SOURCE_PRIORITY: CommandSource[] = ['builtin', 'superpowers', 'custom', 'cursor', 'claude', 'codex'];

const SUPERPOWERS_REPO_FALLBACK_ID = 'superpowers-official';

const listMarkdownFiles = async (dir: string, maxDepth = 6): Promise<string[]> => {
  try {
    return await ipcBridge.fs.listMarkdownFiles.invoke({ dir, maxDepth });
  } catch {
    return [];
  }
};

const buildExternalCommands = async (source: CommandSource, dir: string, triggerPrefix?: string): Promise<SlashCommandItem[]> => {
  const files = await listMarkdownFiles(dir);
  if (files.length === 0) return [];
  const commands = await Promise.all(
    files.map(async (filePath) => {
      try {
        const content = await ipcBridge.fs.readFile.invoke({ path: filePath });
        const parsed = parseCommandMarkdown(content);
        const name = getCommandNameFromPath(filePath);
        const namespace = getNamespaceFromPath(dir, filePath);
        const trigger = triggerPrefix ? `${triggerPrefix}${name}` : name;
        return {
          id: `${source}:${filePath}`,
          name,
          trigger,
          description: parsed.description || name,
          argumentHint: parsed.argumentHint,
          body: parsed.body,
          source,
          sourcePath: filePath,
          namespace: namespace || undefined,
        } as SlashCommandItem;
      } catch {
        return null;
      }
    })
  );
  return commands.filter(Boolean) as SlashCommandItem[];
};

const buildCustomCommands = (items: CustomCommandConfig[]): SlashCommandItem[] => {
  return items.map((item) => {
    const parsed = parseCommandMarkdown(item.content || '');
    return {
      id: `custom:${item.id}`,
      name: item.name,
      trigger: item.name,
      description: parsed.description || item.name,
      argumentHint: parsed.argumentHint,
      body: parsed.body,
      source: 'custom',
    };
  });
};

const resolveSuperpowersRepo = (repos: SkillRepoConfig[], config?: SuperpowersConfig | null) => {
  const repoId = config?.repoId || SUPERPOWERS_REPO_FALLBACK_ID;
  return repos.find((repo) => repo.id === repoId) || repos.find((repo) => repo.id === SUPERPOWERS_REPO_FALLBACK_ID);
};

const buildSuperpowersCommands = async (repo?: SkillRepoConfig | null): Promise<{ commands: SlashCommandItem[]; dir: string }> => {
  if (!repo) return { commands: [], dir: '' };
  try {
    const result = await ipcBridge.application.superpowersCommandDir.invoke({ repoId: repo.id, subdir: repo.subdir });
    const dir = result?.dir || '';
    if (!dir) return { commands: [], dir: '' };
    const commands = await buildExternalCommands('superpowers', dir, 'superpowers:');
    return { commands, dir };
  } catch {
    return { commands: [], dir: '' };
  }
};

const mergeCommands = (groups: Record<CommandSource, SlashCommandItem[]>): SlashCommandItem[] => {
  const ordered: SlashCommandItem[] = [];
  SOURCE_PRIORITY.forEach((source) => {
    ordered.push(...(groups[source] || []));
  });
  return dedupeCommands(ordered);
};

export const useSlashCommands = () => {
  const [commands, setCommands] = useState<SlashCommandItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [externalStats, setExternalStats] = useState<Record<CommandSource, { dir: string; count: number }>>({
    cursor: { dir: '', count: 0 },
    claude: { dir: '', count: 0 },
    codex: { dir: '', count: 0 },
    superpowers: { dir: '', count: 0 },
    builtin: { dir: '', count: BUILTIN_COMMANDS.length },
    custom: { dir: '', count: 0 },
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [dirs, customConfigs, repos, superpowersConfig] = await Promise.all([ipcBridge.application.commandDirs.invoke(), ConfigStorage.get('commands.custom'), ConfigStorage.get('skills.repos'), ConfigStorage.get('superpowers.config')]);
      if (!dirs) {
        console.error('[useSlashCommands] commandDirs returned null');
        return;
      }

      const customCommands = buildCustomCommands((customConfigs || []) as CustomCommandConfig[]);
      const superpowersRepo = resolveSuperpowersRepo((repos || []) as SkillRepoConfig[], superpowersConfig as SuperpowersConfig | null);
      const [cursorCmds, claudeCmds, codexCmds, superpowersResult] = await Promise.all([buildExternalCommands('cursor', dirs.cursor), buildExternalCommands('claude', dirs.claude), buildExternalCommands('codex', dirs.codex, 'prompts:'), buildSuperpowersCommands(superpowersRepo)]);
      const nextStats: Record<CommandSource, { dir: string; count: number }> = {
        builtin: { dir: '', count: BUILTIN_COMMANDS.length },
        custom: { dir: '', count: customCommands.length },
        cursor: { dir: dirs.cursor, count: cursorCmds.length },
        claude: { dir: dirs.claude, count: claudeCmds.length },
        codex: { dir: dirs.codex, count: codexCmds.length },
        superpowers: { dir: superpowersResult.dir, count: superpowersResult.commands.length },
      };
      const groups: Record<CommandSource, SlashCommandItem[]> = {
        builtin: BUILTIN_COMMANDS,
        custom: customCommands,
        cursor: cursorCmds,
        claude: claudeCmds,
        codex: codexCmds,
        superpowers: superpowersResult.commands,
      };
      setCommands(mergeCommands(groups));
      setExternalStats(nextStats);
    } catch (err) {
      console.error('[useSlashCommands] Failed to reload commands:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    commands,
    loading,
    reload,
    externalStats,
  };
};
