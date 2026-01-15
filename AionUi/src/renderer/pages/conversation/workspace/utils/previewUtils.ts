/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IDirOrFile } from '@/common/ipcBridge';
import type { PreviewContentType } from '@/common/types/preview';
import type { PreviewMetadata } from '@/renderer/pages/conversation/preview/context/PreviewContext';

export interface PreviewLoadResult {
  content: string;
  contentType: PreviewContentType;
  metadata?: PreviewMetadata;
}

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tif', 'tiff', 'avif'];
const OFFICE_EXTS = {
  pdf: ['pdf'],
  ppt: ['ppt', 'pptx', 'odp'],
  word: ['doc', 'docx', 'odt'],
  excel: ['xls', 'xlsx', 'ods', 'csv'],
};
const CODE_EXTS = [
  'js',
  'ts',
  'tsx',
  'jsx',
  'py',
  'java',
  'go',
  'rs',
  'c',
  'cpp',
  'h',
  'hpp',
  'css',
  'scss',
  'json',
  'xml',
  'yaml',
  'yml',
  'txt',
  'log',
  'sh',
  'bash',
  'zsh',
  'fish',
  'sql',
  'rb',
  'php',
  'swift',
  'kt',
  'scala',
  'r',
  'lua',
  'vim',
  'toml',
  'ini',
  'cfg',
  'conf',
  'env',
  'gitignore',
  'dockerignore',
  'editorconfig',
];

export const getPreviewContentType = (fileName: string): PreviewContentType => {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (ext === 'diff' || ext === 'patch') return 'diff';
  if (OFFICE_EXTS.pdf.includes(ext)) return 'pdf';
  if (OFFICE_EXTS.ppt.includes(ext)) return 'ppt';
  if (OFFICE_EXTS.word.includes(ext)) return 'word';
  if (OFFICE_EXTS.excel.includes(ext)) return 'excel';
  if (['html', 'htm'].includes(ext)) return 'html';
  if (IMAGE_EXTS.includes(ext)) return 'image';
  if (CODE_EXTS.includes(ext)) return 'code';
  return 'code';
};

export const loadPreviewForFile = async (nodeData: IDirOrFile, workspace: string): Promise<PreviewLoadResult | null> => {
  if (!nodeData?.isFile || !nodeData.fullPath) return null;

  const contentType = getPreviewContentType(nodeData.name);
  const ext = nodeData.name.toLowerCase().split('.').pop() || '';
  let content = '';

  if (contentType === 'image') {
    content = await ipcBridge.fs.getImageBase64.invoke({ path: nodeData.fullPath });
  } else if (!['pdf', 'word', 'excel', 'ppt'].includes(contentType)) {
    content = await ipcBridge.fs.readFile.invoke({ path: nodeData.fullPath });
  }

  const metadata: PreviewMetadata = {
    title: nodeData.name,
    fileName: nodeData.name,
    filePath: nodeData.fullPath,
    workspace,
    language: ext,
    editable: contentType === 'markdown' || contentType === 'image' ? false : undefined,
  };

  return { content, contentType, metadata };
};
