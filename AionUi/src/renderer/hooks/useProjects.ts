/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProjectInfo } from '@/common/storage';
import { addEventListener } from '@/renderer/utils/emitter';
import { getActiveProjectId, getProjectsOrdered } from '@/renderer/utils/projectService';
import { useCallback, useEffect, useMemo, useState } from 'react';

export const useProjects = () => {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);

  const refreshProjects = useCallback(async () => {
    const [ordered, activeId] = await Promise.all([getProjectsOrdered(), getActiveProjectId()]);
    setProjects(ordered);
    setActiveProjectIdState(activeId);
  }, []);

  useEffect(() => {
    void refreshProjects();
    return addEventListener('project.updated', () => {
      void refreshProjects();
    });
  }, [refreshProjects]);

  const activeProject = useMemo(() => projects.find((project) => project.id === activeProjectId) || null, [projects, activeProjectId]);

  return { projects, activeProjectId, activeProject, refreshProjects };
};
