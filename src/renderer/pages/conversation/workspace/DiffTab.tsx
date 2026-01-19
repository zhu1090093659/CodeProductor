/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import DiffHtmlViewer from '@/renderer/components/DiffHtmlViewer';
import { addEventListener } from '@/renderer/utils/emitter';
import { Button, Checkbox, Empty, Message, Spin, Tooltip } from '@arco-design/web-react';
import { Check, Left, Right, Undo } from '@icon-park/react';
import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { parseFilePathFromDiff } from '@/renderer/utils/diffUtils';

type FileDiffItem = {
  filePath: string;
  diff: string;
  signature: string;
  updatedAt: number;
};

type DiffState = {
  items: FileDiffItem[];
  activeIndex: number;
};

type DiffAction = { type: 'setItems'; items: FileDiffItem[]; preferredPath?: string | null } | { type: 'upsertAndActivate'; item: FileDiffItem } | { type: 'prev' } | { type: 'next' } | { type: 'removeActive' } | { type: 'reset' };

const clampIndex = (index: number, length: number) => {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
};

const diffReducer = (state: DiffState, action: DiffAction): DiffState => {
  switch (action.type) {
    case 'reset':
      return { items: [], activeIndex: 0 };
    case 'setItems': {
      const preferredPath = action.preferredPath ?? null;
      let nextIndex = 0;
      if (preferredPath) {
        const found = action.items.findIndex((item) => item.filePath === preferredPath);
        if (found >= 0) nextIndex = found;
      }
      nextIndex = clampIndex(nextIndex, action.items.length);
      return { items: action.items, activeIndex: nextIndex };
    }
    case 'upsertAndActivate': {
      const filtered = state.items.filter((item) => item.filePath !== action.item.filePath);
      const nextItems = [...filtered, action.item];
      return { items: nextItems, activeIndex: Math.max(0, nextItems.length - 1) };
    }
    case 'prev':
      return { ...state, activeIndex: clampIndex(state.activeIndex - 1, state.items.length) };
    case 'next':
      return { ...state, activeIndex: clampIndex(state.activeIndex + 1, state.items.length) };
    case 'removeActive': {
      if (state.items.length === 0) return state;
      const nextItems = state.items.filter((_, idx) => idx !== state.activeIndex);
      const nextIndex = clampIndex(state.activeIndex, nextItems.length);
      return { items: nextItems, activeIndex: nextIndex };
    }
    default:
      return state;
  }
};

const hashString = (input: string) => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

const normalizeFilePath = (filePath: string, workspace: string) => {
  const normalizedPath = (filePath || '').trim().replace(/\\/g, '/');
  const normalizedWorkspace = (workspace || '').trim().replace(/\\/g, '/').replace(/\/+$/, '');

  if (normalizedPath && normalizedWorkspace) {
    const p = normalizedPath.toLowerCase();
    const w = normalizedWorkspace.toLowerCase();
    if (p === w) return '';
    if (p.startsWith(w + '/')) return normalizedPath.slice(normalizedWorkspace.length + 1).replace(/^\/+/, '');
  }

  return normalizedPath.replace(/^\/+/, '');
};

const splitUnifiedDiffByFile = (diffContent: string): Array<{ filePath: string; diff: string }> => {
  const lines = diffContent.split('\n');
  const startIndexes: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('diff --git ')) startIndexes.push(i);
  }

  if (startIndexes.length === 0) {
    const singlePath = parseFilePathFromDiff(diffContent) ?? 'diff';
    return diffContent.trim() ? [{ filePath: singlePath, diff: diffContent }] : [];
  }

  const chunks: Array<{ filePath: string; diff: string }> = [];
  for (let i = 0; i < startIndexes.length; i++) {
    const start = startIndexes[i];
    const end = i + 1 < startIndexes.length ? startIndexes[i + 1] : lines.length;
    const header = lines[start];
    const match = header.match(/^diff --git a\/(.+?) b\/(.+)$/);
    const filePath = match?.[2] ?? parseFilePathFromDiff(lines.slice(start, end).join('\n')) ?? 'diff';
    chunks.push({ filePath, diff: lines.slice(start, end).join('\n') });
  }
  return chunks;
};

const DiffTab: React.FC<{ workspace: string; active: boolean }> = ({ workspace, active }) => {
  const [loading, setLoading] = useState(false);
  const [sideBySide, setSideBySide] = useState(false);
  const [state, dispatch] = useReducer(diffReducer, { items: [], activeIndex: 0 });
  const confirmedSignatureByPathRef = useRef<Map<string, string>>(new Map());

  const current = state.items[state.activeIndex] ?? null;
  const currentPath = current?.filePath ?? '';
  const currentIndexDisplay = state.items.length > 0 ? `${state.activeIndex + 1}/${state.items.length}` : '0/0';
  const currentPathRef = useRef('');

  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  const shouldIgnoreDiff = useCallback((filePath: string, signature: string) => {
    const confirmed = confirmedSignatureByPathRef.current.get(filePath);
    return !!confirmed && confirmed === signature;
  }, []);

  const upsertDiff = useCallback(
    (filePath: string, diff: string) => {
      const signature = hashString(diff);
      if (shouldIgnoreDiff(filePath, signature)) return;

      // If the file changes after being "confirmed", start tracking again.
      if (confirmedSignatureByPathRef.current.has(filePath)) {
        const confirmedSig = confirmedSignatureByPathRef.current.get(filePath);
        if (confirmedSig && confirmedSig !== signature) confirmedSignatureByPathRef.current.delete(filePath);
      }

      dispatch({
        type: 'upsertAndActivate',
        item: { filePath, diff, signature, updatedAt: Date.now() },
      });
    },
    [shouldIgnoreDiff]
  );

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    void ipcBridge.git.diff
      .invoke({ cwd: workspace })
      .then((res) => {
        if (!res?.success) {
          dispatch({ type: 'setItems', items: [], preferredPath: null });
          return;
        }

        const raw = res.data?.diff || '';
        const chunks = splitUnifiedDiffByFile(raw)
          .map((chunk) => {
            const signature = hashString(chunk.diff);
            if (shouldIgnoreDiff(chunk.filePath, signature)) return null;

            // If the file changes after being "confirmed", start tracking again.
            const confirmedSig = confirmedSignatureByPathRef.current.get(chunk.filePath);
            if (confirmedSig && confirmedSig !== signature) confirmedSignatureByPathRef.current.delete(chunk.filePath);

            return {
              filePath: chunk.filePath,
              diff: chunk.diff,
              signature,
              updatedAt: Date.now(),
            } satisfies FileDiffItem;
          })
          .filter(Boolean) as FileDiffItem[];

        dispatch({ type: 'setItems', items: chunks, preferredPath: currentPathRef.current || null });
      })
      .finally(() => setLoading(false));
  }, [workspace, active, shouldIgnoreDiff]);

  useEffect(() => {
    dispatch({ type: 'reset' });
    confirmedSignatureByPathRef.current.clear();
  }, [workspace]);

  useEffect(() => {
    return addEventListener('workspace.diff.fileChanged', ({ workspace: eventWorkspace, filePath, diff }) => {
      if (eventWorkspace !== workspace) return;
      const resolvedPath = (filePath && filePath.trim()) || parseFilePathFromDiff(diff) || 'diff';
      upsertDiff(normalizeFilePath(resolvedPath, workspace) || resolvedPath, diff);
    });
  }, [upsertDiff, workspace]);

  const canPrev = state.items.length > 0 && state.activeIndex > 0;
  const canNext = state.items.length > 0 && state.activeIndex < state.items.length - 1;

  const handleConfirm = useCallback(() => {
    if (!current) return;
    confirmedSignatureByPathRef.current.set(current.filePath, current.signature);
    dispatch({ type: 'removeActive' });
  }, [current]);

  const [undoLoading, setUndoLoading] = useState(false);
  const handleUndo = useCallback(async () => {
    if (!current || undoLoading) return;
    setUndoLoading(true);
    try {
      const res = await ipcBridge.git.restoreFile.invoke({ cwd: workspace, filePath: current.filePath });
      if (!res?.success) {
        Message.error(res?.msg || 'Failed to undo changes');
        return;
      }
      confirmedSignatureByPathRef.current.delete(current.filePath);
      dispatch({ type: 'removeActive' });
    } finally {
      setUndoLoading(false);
    }
  }, [current, undoLoading, workspace]);

  if (loading) {
    return (
      <div className='flex items-center justify-center h-full'>
        <Spin loading />
      </div>
    );
  }

  if (!current) {
    return (
      <div className='flex items-center justify-center h-full'>
        <Empty description='No tracked changes' />
      </div>
    );
  }

  const parts = current.filePath.split(/[\\/]/);
  const fileName = parts[parts.length - 1] || current.filePath;

  return (
    <div className='h-full w-full overflow-hidden flex flex-col min-h-0'>
      <div className='h-32px px-12px flex items-center justify-between bg-bg-2 text-12px text-t-secondary border-b border-b-base flex-shrink-0 gap-8px'>
        <div className='flex items-center gap-6px min-w-0'>
          <Tooltip content='Previous changed file'>
            <Button size='mini' type='text' disabled={!canPrev} icon={<Left theme='outline' size='14' fill='currentColor' />} onClick={() => dispatch({ type: 'prev' })} />
          </Tooltip>
          <Tooltip content='Next changed file'>
            <Button size='mini' type='text' disabled={!canNext} icon={<Right theme='outline' size='14' fill='currentColor' />} onClick={() => dispatch({ type: 'next' })} />
          </Tooltip>
          <span className='text-12px text-t-secondary flex-shrink-0'>{currentIndexDisplay}</span>
          <span className='text-12px text-t-primary truncate' title={current.filePath}>
            {fileName}
          </span>
          <Checkbox className='ml-6px whitespace-nowrap' checked={sideBySide} onChange={(value) => setSideBySide(value)}>
            <span className='whitespace-nowrap'>side-by-side</span>
          </Checkbox>
        </div>

        <div className='flex items-center gap-4px flex-shrink-0'>
          <Button size='mini' type='text' loading={undoLoading} icon={<Undo theme='outline' size='14' fill='currentColor' />} onClick={handleUndo}>
            Undo
          </Button>
          <Button size='mini' type='primary' icon={<Check theme='outline' size='14' fill='currentColor' />} onClick={handleConfirm}>
            Confirm
          </Button>
        </div>
      </div>

      <div className='flex-1 min-h-0 overflow-auto p-12px'>
        <DiffHtmlViewer diff={current.diff} sideBySide={sideBySide} className='border border-base rd-8px' />
      </div>
    </div>
  );
};

export default DiffTab;
