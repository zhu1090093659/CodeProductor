/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type CliProviderTarget = 'claude' | 'codex' | 'gemini';

export type CliProviderApplyPayload =
  | {
      target: 'claude';
      env: Record<string, string | number>;
    }
  | {
      target: 'codex';
      auth: Record<string, unknown>;
      configToml?: string;
    }
  | {
      target: 'gemini';
      env: Record<string, string>;
      settings?: Record<string, unknown>;
    };
