/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConfigStorage, type SuperpowersWorkflowMode } from '@/common/storage';
import type { AcpBackend } from '@/types/acpTypes';

const GUIDED_CONTEXT = `# Superpowers Workflow (Guided Mode)

You are equipped with structured development skills from the superpowers framework.

When starting new features or complex tasks, consider following these phases:
1. Design: use /superpowers:brainstorm to clarify requirements
2. Plan: use /superpowers:plan to break down tasks
3. Execute: prefer test-driven development and incremental validation
4. Review: verify implementation quality and risks

These are recommendations, not strict requirements. Adapt based on context.`;

const ENFORCED_CONTEXT = `# Superpowers Workflow (Enforced Mode)

You MUST follow the superpowers structured workflow for non-trivial tasks.

Workflow phases:
1. Design: clarify requirements with /superpowers:brainstorm
2. Plan: create an implementation plan with /superpowers:plan
3. Execute: implement step by step with tests where appropriate
4. Review: check correctness, risks, and verify the results

Do not skip phases unless the user explicitly requests otherwise.`;

export class SuperpowersService {
  static generateWorkflowContext(mode: SuperpowersWorkflowMode): string {
    if (mode === 'passive') return '';
    return mode === 'guided' ? GUIDED_CONTEXT : ENFORCED_CONTEXT;
  }

  static async isEnabledForAgent(backend: AcpBackend): Promise<boolean> {
    const config = await ConfigStorage.get('superpowers.config').catch(() => undefined);
    return config?.enabledForAgents?.[backend]?.enabled ?? false;
  }
}
