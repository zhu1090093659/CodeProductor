/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type CliProviderTarget = 'claude' | 'codex';

export type CliProviderApplyPayload =
  | {
      target: 'claude';
      env: Record<string, string | number>;
      /**
       * Keys to remove from existing ~/.claude/settings.json env before merging.
       * This is used to switch back to official browser-login mode safely.
       */
      clearEnvKeys?: string[];
    }
  | {
      target: 'codex';
      /**
       * Patch fields to merge into existing ~/.codex/auth.json.
       * NOTE: We intentionally avoid full replacement to prevent wiping OAuth tokens.
       */
      authPatch?: Record<string, unknown>;
      /**
       * Keys to remove from existing ~/.codex/auth.json.
       * Used to unset OPENAI_API_KEY when switching to official browser-login mode.
       */
      clearAuthKeys?: string[];
      configToml?: string;
      /**
       * If true, remove existing ~/.codex/config.toml instead of writing.
       * Used to revert to Codex default config for official provider.
       */
      clearConfigToml?: boolean;
    };
