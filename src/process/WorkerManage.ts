/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/storage';
import path from 'path';
import AcpAgentManager from './task/AcpAgentManager';
import { CodexAgentManager } from '@/agent/codex';
// import type { AcpAgentTask } from './task/AcpAgentTask';
import { ProcessChat } from './initStorage';
import type AgentBaseTask from './task/BaseAgentManager';
import { getDatabase } from './database/export';

const taskList: {
  id: string;
  task: AgentBaseTask<unknown>;
}[] = [];

const normalizeWorkspacePath = (value: string): string => {
  const resolved = path.resolve(value).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
};

const getTaskById = (id: string) => {
  return taskList.find((item) => item.id === id)?.task;
};

const buildConversation = (conversation: TChatConversation) => {
  const task = getTaskById(conversation.id);

  if (task) {
    return task;
  }

  switch (conversation.type) {
    case 'acp': {
      const task = new AcpAgentManager({ ...conversation.extra, conversation_id: conversation.id });
      taskList.push({ id: conversation.id, task });
      return task;
    }
    case 'codex': {
      const task = new CodexAgentManager({ ...conversation.extra, conversation_id: conversation.id });
      taskList.push({ id: conversation.id, task });
      return task;
    }
    default: {
      return null;
    }
  }
};

const getTaskByIdRollbackBuild = async (id: string): Promise<AgentBaseTask<unknown>> => {
  const task = taskList.find((item) => item.id === id)?.task;
  if (task) return Promise.resolve(task);
  // Try to load from database first
  const db = getDatabase();
  const dbResult = db.getConversation(id);

  if (dbResult.success && dbResult.data) {
    return buildConversation(dbResult.data);
  }

  // Fallback to file storage
  const list = (await ProcessChat.get('chat.history')) as TChatConversation[] | undefined;
  const conversation = list?.find((item) => item.id === id);
  if (conversation) {
    return buildConversation(conversation);
  }

  console.error('[WorkerManage] Conversation not found in database or file storage:', id);
  return Promise.reject(new Error('Conversation not found'));
};

const kill = (id: string) => {
  const index = taskList.findIndex((item) => item.id === id);
  if (index === -1) return;
  const task = taskList[index];
  if (task) {
    task.task.kill();
  }
  taskList.splice(index, 1);
};

const clear = () => {
  taskList.forEach((item) => {
    item.task.kill();
  });
  taskList.length = 0;
};

/**
 * Gracefully clear all tasks with proper cleanup
 * 优雅地清理所有任务，确保 CLI 进程释放目录锁
 * This is called on application quit to avoid EBUSY errors on Windows
 */
const clearAsync = async (timeoutMs = 3000) => {
  if (taskList.length === 0) return;

  // Step 1: Send stop to all tasks to gracefully disconnect CLI child processes
  // 发送停止消息以优雅地断开 CLI 子进程连接
  const stopPromises = taskList.map(async (item) => {
    try {
      const task = item.task as { stop?: () => Promise<void> };
      await Promise.race([task.stop?.(), new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
    } catch (error) {
      console.warn('[WorkerManage] Failed to stop task gracefully:', error);
    }
  });

  await Promise.all(stopPromises);

  // Step 2: Wait for CLI processes to fully exit
  // Windows needs extra time to release file handles after process termination
  // Windows 需要额外时间释放文件句柄
  if (process.platform === 'win32') {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Step 3: Kill all worker processes
  clear();
};

const killByWorkspace = async (workspace: string) => {
  if (!workspace) return 0;
  const normalizedTarget = normalizeWorkspacePath(workspace);

  // Find all tasks matching the workspace
  const tasksToKill: AgentBaseTask<unknown>[] = [];
  for (let i = taskList.length - 1; i >= 0; i -= 1) {
    const task = taskList[i]?.task as { workspace?: string } | undefined;
    if (!task?.workspace) continue;
    const normalizedWorkspace = normalizeWorkspacePath(task.workspace);
    if (normalizedWorkspace === normalizedTarget || normalizedWorkspace.startsWith(normalizedTarget + path.sep)) {
      tasksToKill.push(taskList[i].task);
    }
  }

  if (tasksToKill.length === 0) return 0;

  // Step 1: Send stop message to all tasks to gracefully disconnect CLI child processes
  // This is crucial because the CLI process (claude, codex, etc.) has its cwd set to workspace
  const stopPromises = tasksToKill.map(async (task) => {
    try {
      // stop() sends 'stop.stream' message to worker, which calls agent.stop() -> connection.disconnect()
      // This kills the CLI child process that is holding the workspace directory lock
      await Promise.race([
        (task as { stop?: () => Promise<void> }).stop?.(),
        new Promise((resolve) => setTimeout(resolve, 2000)), // Timeout after 2s
      ]);
    } catch (error) {
      console.warn('[WorkerManage] Failed to stop task gracefully:', error);
    }
  });

  await Promise.all(stopPromises);

  // Step 2: Wait for CLI processes to fully exit and release directory handles
  // Windows needs extra time to release file handles after process termination
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Step 3: Kill the worker processes and remove from task list
  for (const task of tasksToKill) {
    task.kill();
    // Find current index (may have shifted due to splicing)
    const currentIndex = taskList.findIndex((t) => t.task === task);
    if (currentIndex !== -1) {
      taskList.splice(currentIndex, 1);
    }
  }

  return tasksToKill.length;
};

const addTask = (id: string, task: AgentBaseTask<unknown>) => {
  const existing = taskList.find((item) => item.id === id);
  if (existing) {
    existing.task = task;
  } else {
    taskList.push({ id, task });
  }
};

const listTasks = () => {
  return taskList.map((t) => ({ id: t.id, type: t.task.type }));
};

const WorkerManage = {
  buildConversation,
  getTaskById,
  getTaskByIdRollbackBuild,
  addTask,
  listTasks,
  kill,
  killByWorkspace,
  clear,
  clearAsync,
};

export default WorkerManage;
