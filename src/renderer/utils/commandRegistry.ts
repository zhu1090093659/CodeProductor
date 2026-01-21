/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type CommandSource = 'builtin' | 'superpowers' | 'custom' | 'cursor' | 'claude' | 'codex';

export interface SlashCommandItem {
  id: string;
  name: string;
  trigger: string;
  description: string;
  argumentHint?: string;
  body: string;
  source: CommandSource;
  sourcePath?: string;
  namespace?: string;
}

export interface ParsedCommandMarkdown {
  frontmatter: Record<string, string>;
  body: string;
  description: string;
  argumentHint?: string;
}

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

const normalizeLine = (value: string) => value.replace(/\r\n/g, '\n');

const parseFrontmatter = (content: string): { frontmatter: Record<string, string>; body: string } => {
  const normalized = normalizeLine(content);
  const match = normalized.match(FRONTMATTER_REGEX);
  if (!match) {
    return { frontmatter: {}, body: normalized };
  }
  const yaml = match[1];
  const frontmatter: Record<string, string> = {};
  yaml.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex === -1) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key) {
      frontmatter[key] = value;
    }
  });
  return { frontmatter, body: normalized.slice(match[0].length) };
};

const getFirstMeaningfulLine = (body: string) => {
  const lines = normalizeLine(body).split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    return trimmed.replace(/^#+\s*/, '');
  }
  return '';
};

export const parseCommandMarkdown = (content: string): ParsedCommandMarkdown => {
  const { frontmatter, body } = parseFrontmatter(content);
  const description = frontmatter.description || getFirstMeaningfulLine(body);
  const argumentHint = frontmatter['argument-hint'] || frontmatter.argumentHint;
  return { frontmatter, body: body.trim(), description: description.trim(), argumentHint };
};

export const expandCommandTemplate = (body: string, rawArgs: string) => {
  const escapedToken = '__CodeConductor_ESCAPED_DOLLAR__';
  const normalizedBody = body.replace(/\$\$/g, escapedToken);
  const args = parseCommandArgs(rawArgs);
  let expanded = normalizedBody.replace(/\$ARGUMENTS/g, rawArgs.trim());
  for (let index = 1; index <= 9; index += 1) {
    const value = args[index - 1] ?? '';
    const token = new RegExp(`\\$${index}`, 'g');
    expanded = expanded.replace(token, value);
  }
  return expanded.replace(new RegExp(escapedToken, 'g'), '$').trim();
};

export const parseCommandArgs = (rawArgs: string): string[] => {
  const args: string[] = [];
  const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match = regex.exec(rawArgs);
  while (match) {
    if (match[1] !== undefined) {
      args.push(match[1]);
    } else if (match[2] !== undefined) {
      args.push(match[2]);
    } else if (match[3] !== undefined) {
      args.push(match[3]);
    }
    match = regex.exec(rawArgs);
  }
  return args;
};

export const getCommandNameFromPath = (filePath: string) => {
  const normalized = filePath.replace(/\\/g, '/');
  const fileName = normalized.split('/').pop() || '';
  return fileName.replace(/\.md$/i, '');
};

export const getNamespaceFromPath = (rootDir: string, filePath: string) => {
  const normalizedRoot = rootDir.replace(/\\/g, '/').replace(/\/+$/, '');
  const normalizedPath = filePath.replace(/\\/g, '/');
  if (!normalizedPath.startsWith(normalizedRoot)) return '';
  const relative = normalizedPath.slice(normalizedRoot.length).replace(/^\/+/, '');
  const parts = relative.split('/');
  if (parts.length <= 1) return '';
  return parts.slice(0, -1).join('/');
};

export const dedupeCommands = (commands: SlashCommandItem[]) => {
  const seen = new Set<string>();
  return commands.filter((command) => {
    if (seen.has(command.trigger)) return false;
    seen.add(command.trigger);
    return true;
  });
};
