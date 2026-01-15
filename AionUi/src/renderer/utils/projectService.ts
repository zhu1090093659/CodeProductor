/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { ProjectInfo, TChatConversation } from '@/common/storage';
import { ConfigStorage } from '@/common/storage';
import { uuid } from '@/common/utils';
import { emitter } from '@/renderer/utils/emitter';
import { getWorkspaceDisplayName } from '@/renderer/utils/workspace';
import { removeWorkspaceEntry } from '@/renderer/utils/workspaceFs';

const RECENT_LIMIT = 8;

const normalizeWorkspace = (workspace: string) => workspace.trim();

const loadProjects = async (): Promise<ProjectInfo[]> => {
  const stored = await ConfigStorage.get('project.list');
  return Array.isArray(stored) ? stored : [];
};

const saveProjects = async (projects: ProjectInfo[]) => {
  await ConfigStorage.set('project.list', projects);
};

const loadRecentIds = async (): Promise<string[]> => {
  const stored = await ConfigStorage.get('project.recentIds');
  return Array.isArray(stored) ? stored : [];
};

const saveRecentIds = async (ids: string[]) => {
  await ConfigStorage.set('project.recentIds', ids);
};

const touchRecent = async (projectId: string) => {
  const recentIds = await loadRecentIds();
  const next = [projectId, ...recentIds.filter((id) => id !== projectId)].slice(0, RECENT_LIMIT);
  await saveRecentIds(next);
};

export const getActiveProjectId = async (): Promise<string | null> => {
  const stored = await ConfigStorage.get('project.activeId');
  return stored || null;
};

export const setActiveProjectId = async (projectId: string | null) => {
  if (!projectId) {
    await ConfigStorage.set('project.activeId', '');
    emitter.emit('project.updated');
    return;
  }
  await ConfigStorage.set('project.activeId', projectId);
  await touchRecent(projectId);
  emitter.emit('project.updated');
};

export const getProjectsOrdered = async (): Promise<ProjectInfo[]> => {
  const [projects, recentIds] = await Promise.all([loadProjects(), loadRecentIds()]);
  if (recentIds.length === 0) {
    return [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
  }
  const byId = new Map(projects.map((project) => [project.id, project]));
  const ordered: ProjectInfo[] = [];
  recentIds.forEach((id) => {
    const project = byId.get(id);
    if (project) {
      ordered.push(project);
      byId.delete(id);
    }
  });
  const rest = Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  return [...ordered, ...rest];
};

export const getProjectByWorkspace = async (workspace: string): Promise<ProjectInfo | null> => {
  const normalized = normalizeWorkspace(workspace);
  const projects = await loadProjects();
  return projects.find((project) => normalizeWorkspace(project.workspace) === normalized) || null;
};

export const createProject = async (workspace: string, name?: string): Promise<ProjectInfo> => {
  const now = Date.now();
  const project: ProjectInfo = {
    id: uuid(),
    name: name?.trim() || getWorkspaceDisplayName(workspace),
    workspace: normalizeWorkspace(workspace),
    createdAt: now,
    updatedAt: now,
  };
  const projects = await loadProjects();
  const next = [project, ...projects];
  await saveProjects(next);
  await setActiveProjectId(project.id);
  return project;
};

export const ensureProjectForWorkspace = async (workspace: string, name?: string): Promise<ProjectInfo> => {
  const normalized = normalizeWorkspace(workspace);
  const existing = await getProjectByWorkspace(normalized);
  if (existing) {
    await setActiveProjectId(existing.id);
    return existing;
  }
  return createProject(normalized, name);
};

export const renameProject = async (projectId: string, nextName: string): Promise<boolean> => {
  const name = nextName.trim();
  if (!name) return false;
  const projects = await loadProjects();
  const next = projects.map((project) => {
    if (project.id !== projectId) return project;
    return { ...project, name, updatedAt: Date.now() };
  });
  await saveProjects(next);
  emitter.emit('project.updated');
  return true;
};

export const deleteProject = async (projectId: string): Promise<boolean> => {
  const [projects, activeId, recentIds] = await Promise.all([loadProjects(), getActiveProjectId(), loadRecentIds()]);
  const targetProject = projects.find((project) => project.id === projectId);
  if (!targetProject) return false;

  const normalizedWorkspace = normalizeWorkspace(targetProject.workspace);
  try {
    const conversations = await ipcBridge.database.getUserConversations.invoke({ page: 0, pageSize: 10000 });
    const relatedConversations = (conversations || []).filter((conv) => {
      const convProjectId = conv.extra?.projectId;
      if (convProjectId && convProjectId === projectId) return true;
      const workspace = conv.extra?.workspace;
      if (!workspace) return false;
      return normalizeWorkspace(workspace) === normalizedWorkspace;
    });

    for (const conv of relatedConversations) {
      const ok = await ipcBridge.conversation.remove.invoke({ id: conv.id });
      if (!ok) {
        console.error('[ProjectService] Failed to remove conversation:', conv.id);
        return false;
      }
      emitter.emit('conversation.deleted', conv.id);
    }
    if (relatedConversations.length > 0) {
      emitter.emit('chat.history.refresh');
    }
  } catch (error) {
    console.error('[ProjectService] Failed to remove conversations:', error);
    return false;
  }

  if (targetProject.workspace) {
    const res = await removeWorkspaceEntry(targetProject.workspace);
    if (!res?.success) {
      console.error('[ProjectService] Failed to remove workspace:', res?.msg || targetProject.workspace);
      return false;
    }
  }

  const nextProjects = projects.filter((project) => project.id !== projectId);
  await saveProjects(nextProjects);
  const nextRecent = recentIds.filter((id) => id !== projectId);
  await saveRecentIds(nextRecent);
  if (activeId === projectId) {
    const fallback = nextRecent[0] || nextProjects[0]?.id || null;
    await setActiveProjectId(fallback);
  } else {
    emitter.emit('project.updated');
  }
  return true;
};

export const getActiveProject = async (): Promise<ProjectInfo | null> => {
  const [projects, activeId] = await Promise.all([loadProjects(), getActiveProjectId()]);
  if (!activeId) return null;
  return projects.find((project) => project.id === activeId) || null;
};

export const resolveProjectIdForConversation = (conversation: TChatConversation, projects: ProjectInfo[]): string | null => {
  const directId = conversation.extra?.projectId;
  if (directId) return directId;
  const workspace = conversation.extra?.workspace;
  if (!workspace) return null;
  const normalized = normalizeWorkspace(workspace);
  return projects.find((project) => normalizeWorkspace(project.workspace) === normalized)?.id || null;
};
