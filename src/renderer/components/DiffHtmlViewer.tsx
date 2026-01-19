/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { html } from 'diff2html';
import 'diff2html/bundles/css/diff2html.min.css';
import classNames from 'classnames';
import { useThemeContext } from '@/renderer/context/ThemeContext';

type DiffHtmlViewerProps = {
  diff: string;
  sideBySide?: boolean;
  className?: string;
};

const DiffHtmlViewer: React.FC<DiffHtmlViewerProps> = ({ diff, sideBySide = false, className }) => {
  const { theme } = useThemeContext();

  const diffHtmlContent = useMemo(() => {
    return html(diff, {
      outputFormat: sideBySide ? 'side-by-side' : 'line-by-line',
      drawFileList: false,
      matching: 'lines',
      matchWordsThreshold: 0,
      maxLineLengthHighlight: 20,
      matchingMaxComparisons: 3,
      diffStyle: 'word',
      renderNothingWhenEmpty: false,
    });
  }, [diff, sideBySide]);

  return <div className={classNames('w-full max-w-full overflow-x-auto', '![&_.line-num1]:hidden ![&_.line-num2]:w-30px [&_td:first-child]:w-40px ![&_td:nth-child(2)>div]:pl-45px min-w-0 max-w-full [&_div.d2f-file-wrapper]:rd-[0.3rem_0.3rem_0px_0px] [&_div.d2h-file-header]:items-center [&_div.d2h-file-header]:bg-bg-3', { 'd2h-dark-color-scheme': theme === 'dark' }, className)} style={{ WebkitOverflowScrolling: 'touch' }} dangerouslySetInnerHTML={{ __html: diffHtmlContent }} />;
};

export default DiffHtmlViewer;
