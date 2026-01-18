/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChildProcess } from 'child_process';
import { execSync } from 'child_process';

/**
 * Kill a child process and its entire process tree
 * 终止子进程及其整个进程树
 *
 * On Windows, `child.kill()` only kills the parent process, not child processes.
 * This function uses `taskkill /T /F /PID` to kill the entire process tree.
 *
 * @param child - The child process to kill
 */
export function killProcessTree(child: ChildProcess | null): void {
  if (!child || child.pid === undefined) return;

  const pid = child.pid;

  if (process.platform === 'win32') {
    try {
      // Use taskkill to kill the entire process tree on Windows
      // /T = Kill the process tree (all child processes)
      // /F = Force kill
      // /PID = Process ID
      execSync(`taskkill /T /F /PID ${pid}`, { stdio: 'ignore' });
    } catch {
      // Process may have already exited, try normal kill as fallback
      try {
        child.kill('SIGKILL');
      } catch {
        // Ignore - process already terminated
      }
    }
  } else {
    // On Unix-like systems, kill process group
    try {
      // Negative PID kills the entire process group
      process.kill(-pid, 'SIGKILL');
    } catch {
      // Fallback to normal kill
      try {
        child.kill('SIGKILL');
      } catch {
        // Ignore - process already terminated
      }
    }
  }
}
