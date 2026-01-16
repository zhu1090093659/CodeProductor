/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMessageToolCall } from '@/common/chatLib';
import { Alert, Checkbox, Tag } from '@arco-design/web-react';
import { Down, MessageSearch, Up } from '@icon-park/react';
import { createTwoFilesPatch } from 'diff';
import { html } from 'diff2html';
import 'diff2html/bundles/css/diff2html.min.css';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MarkdownView from '../components/Markdown';
import { iconColors } from '@/renderer/theme/colors';

const Diff2Html = ({ message }: { message: IMessageToolCall }) => {
  const [sideBySide, setSideBySide] = useState(false);
  const diffHtmlContent = useMemo(() => {
    const file = message.content.args.file_path;
    const diffText = createTwoFilesPatch(file, file, message.content.args.old_string ?? '', message.content.args.new_string ?? '', '', '', { context: 3 });
    return html(diffText, {
      outputFormat: sideBySide ? 'side-by-side' : 'line-by-line',
      drawFileList: false,
      matching: 'lines',
      matchWordsThreshold: 0,
      maxLineLengthHighlight: 20,
      matchingMaxComparisons: 3,
      diffStyle: 'word',
      renderNothingWhenEmpty: false,
    });
  }, [message.content.args, sideBySide]);
  return (
    <div className='relative'>
      <div
        dangerouslySetInnerHTML={{
          __html: diffHtmlContent,
        }}
      ></div>
      <div className='absolute top-12px right-10px flex items-center justify-center'>
        <Checkbox className={'!flex items-center justify-center'} checked={sideBySide} onChange={(value) => setSideBySide(value)}>
          <span className='whitespace-nowrap text-t-primary'>side-by-side</span>
        </Checkbox>
      </div>
    </div>
  );
};
const MessageToolCall: React.FC<{ message: IMessageToolCall }> = ({ message }) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(true);

  const toolName = message.content.name;

  const summary = useMemo(() => {
    const args = message.content.args || {};
    if (['list_directory', 'read_file', 'write_file'].includes(toolName)) {
      const { absolute_path, path, file_path = absolute_path || path } = args;
      return file_path ? String(file_path) : '';
    }
    if (toolName === 'google_web_search') {
      return args.query ? String(args.query) : '';
    }
    if (toolName === 'run_shell_command') {
      return args.command ? String(args.command) : '';
    }
    if (toolName === 'replace') {
      return args.file_path ? String(args.file_path) : '';
    }
    return '';
  }, [message.content.args, toolName]);

  const body = useMemo(() => {
    if (['list_directory', 'read_file', 'write_file'].includes(toolName)) {
      const { absolute_path, path, file_path = absolute_path || path, status } = message.content.args;
      const opName = toolName === 'read_file' ? 'ReadFile' : 'WriteFile';
      return <Alert content={opName + ':' + file_path} type={status === 'error' ? 'error' : status === 'success' ? 'success' : 'info'}></Alert>;
    }
    if (toolName === 'google_web_search') {
      return <Alert icon={<MessageSearch theme='outline' fill={iconColors.primary} className='lh-[1]' />} content={message.content.args.query}></Alert>;
    }
    if (toolName === 'run_shell_command') {
      const cmd = message.content.args.command ?? '';
      const desc = message.content.args.description ?? '';
      const shellSnippet = `\`\`\`shell\n${cmd}\n${desc ? `# ${desc}\n` : ''}\`\`\``;
      return <MarkdownView>{shellSnippet}</MarkdownView>;
    }
    if (toolName === 'replace') {
      return <Diff2Html message={message}></Diff2Html>;
    }
    return <div className='text-t-primary'>{toolName}</div>;
  }, [message, toolName]);

  return (
    <div className='w-full min-w-0 border border-[var(--bg-3)] rounded-10px bg-1'>
      <div className='flex items-center justify-between gap-12px px-10px py-8px border-b border-[var(--bg-3)]'>
        <div className='flex items-center gap-8px min-w-0'>
          <Tag>{toolName}</Tag>
          {summary && <span className='text-xs text-t-secondary truncate'>{summary}</span>}
        </div>
        <button type='button' className='flex items-center gap-4px text-xs text-t-secondary hover:text-t-primary transition-colors border-none bg-transparent cursor-pointer shrink-0' onClick={() => setIsCollapsed((prev) => !prev)}>
          <span>{isCollapsed ? t('common.expandMore') : t('common.collapse')}</span>
          {isCollapsed ? <Down theme='outline' size={14} fill='currentColor' /> : <Up theme='outline' size={14} fill='currentColor' />}
        </button>
      </div>
      {!isCollapsed && <div className='px-10px py-10px'>{body}</div>}
    </div>
  );
};

export default MessageToolCall;
