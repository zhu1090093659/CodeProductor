/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Message } from '@arco-design/web-react';
import MonacoEditor from '@monaco-editor/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface HTMLPreviewProps {
  content: string;
  filePath?: string;
  hideToolbar?: boolean;
}

interface SelectedElement {
  path: string;
  html: string;
  startLine?: number;
  endLine?: number;
}

// Electron webview element type definition
interface ElectronWebView extends HTMLElement {
  src: string;
  executeJavaScript: (code: string) => Promise<unknown>;
}

/**
 * Normalize OS file path to a URL-safe file:// URL.
 * - Windows drive paths: C:\a\b -> file:///C:/a/b
 * - UNC paths: \\server\share -> file:////server/share
 */
const toFileUrl = (rawPath: string): string => {
  const normalized = rawPath.replace(/\\/g, '/');
  const withLeadingSlash = /^[A-Za-z]:\//.test(normalized) ? `/${normalized}` : normalized;
  return encodeURI(`file://${withLeadingSlash}`);
};

/**
 * Convert OS file path to directory file:// URL (always ends with a slash).
 */
const toFileDirUrl = (rawPath: string): string => {
  const normalized = rawPath.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  const dirPath = idx >= 0 ? normalized.slice(0, idx + 1) : normalized;
  const dirUrl = toFileUrl(dirPath);
  return dirUrl.endsWith('/') ? dirUrl : `${dirUrl}/`;
};

/**
 * Extract basename from OS file path (supports both / and \\).
 */
const getBasenameFromPath = (rawPath: string): string => {
  const normalized = rawPath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || '';
};

/**
 * HTML Preview Component using Electron webview
 * - Supports live preview and code editing
 * - Supports element inspector (similar to DevTools)
 * - Properly loads file:// URLs with relative resources
 */
const HTMLPreview: React.FC<HTMLPreviewProps> = ({ content, filePath, hideToolbar = false }) => {
  const { t } = useTranslation();
  const webviewRef = useRef<ElectronWebView | null>(null);
  const webviewLoadedRef = useRef(false);
  const [editMode, setEditMode] = useState(false);
  const [htmlCode, setHtmlCode] = useState(content);
  const [inspectorMode, setInspectorMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; element: SelectedElement } | null>(null);
  const [messageApi, messageContextHolder] = Message.useMessage();
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  // Monitor theme changes
  useEffect(() => {
    const updateTheme = () => {
      const theme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      setCurrentTheme(theme);
    };

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  // Determine if content has been edited
  const isContentEdited = htmlCode !== content;

  // Calculate webview src
  // When filePath exists and content not edited: load file directly via file:// URL
  // Otherwise: use data URL for dynamic/edited content
  const webviewSrc = useMemo(() => {
    // If we have a filePath AND content is not edited, load directly via file:// URL
    // This ensures relative CSS/JS/images work correctly
    if (filePath && !isContentEdited) {
      return toFileUrl(filePath);
    }

    // For edited content or no filePath, use data URL
    let html = htmlCode;

    // Inject base tag for relative resources when we have filePath
    if (filePath) {
      const baseUrl = toFileDirUrl(filePath);
      if (!html.match(/<base\s+href=/i)) {
        if (html.match(/<head>/i)) {
          html = html.replace(/<head>/i, `<head><base href="${baseUrl}">`);
        } else if (html.match(/<html>/i)) {
          html = html.replace(/<html>/i, `<html><head><base href="${baseUrl}"></head>`);
        } else {
          html = `<head><base href="${baseUrl}"></head>${html}`;
        }
      }
    }

    return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  }, [htmlCode, filePath, isContentEdited]);

  // Reset load state when src changes
  useEffect(() => {
    webviewLoadedRef.current = false;
  }, [webviewSrc]);

  // Inspector script to inject into webview
  const inspectorScript = useMemo(
    () => `
    (function() {
      if (window.__inspectorInitialized) return;
      window.__inspectorInitialized = true;
      
      let hoveredElement = null;
      let overlay = null;

      function createOverlay() {
        overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.border = '2px solid #2196F3';
        overlay.style.backgroundColor = 'rgba(33, 150, 243, 0.1)';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '999999';
        overlay.style.boxSizing = 'border-box';
        document.body.appendChild(overlay);
      }

      function updateOverlay(element) {
        if (!overlay) createOverlay();
        const rect = element.getBoundingClientRect();
        overlay.style.top = rect.top + window.scrollY + 'px';
        overlay.style.left = rect.left + window.scrollX + 'px';
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
        overlay.style.display = 'block';
      }

      function hideOverlay() {
        if (overlay) {
          overlay.style.display = 'none';
        }
      }

      function getElementPath(element) {
        const path = [];
        while (element && element.nodeType === Node.ELEMENT_NODE) {
          let selector = element.nodeName.toLowerCase();
          if (element.id) {
            selector += '#' + element.id;
            path.unshift(selector);
            break;
          } else {
            let sibling = element;
            let nth = 1;
            while (sibling.previousElementSibling) {
              sibling = sibling.previousElementSibling;
              if (sibling.nodeName.toLowerCase() === selector) {
                nth++;
              }
            }
            if (nth > 1) {
              selector += ':nth-child(' + nth + ')';
            }
          }
          path.unshift(selector);
          element = element.parentElement;
        }
        return path.join(' > ');
      }

      document.addEventListener('mousemove', function(e) {
        hoveredElement = e.target;
        if (hoveredElement && hoveredElement !== document.body && hoveredElement !== document.documentElement) {
          updateOverlay(hoveredElement);
        } else {
          hideOverlay();
        }
      });

      document.addEventListener('mouseleave', function() {
        hideOverlay();
      });

      document.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        if (hoveredElement && hoveredElement !== document.body && hoveredElement !== document.documentElement) {
          const elementInfo = {
            path: getElementPath(hoveredElement),
            html: hoveredElement.outerHTML,
          };
          console.log('__ELEMENT_SELECTED__' + JSON.stringify(elementInfo));
        }
      });

      document.addEventListener('contextmenu', function(e) {
        e.preventDefault();

        if (hoveredElement && hoveredElement !== document.body && hoveredElement !== document.documentElement) {
          const elementInfo = {
            path: getElementPath(hoveredElement),
            html: hoveredElement.outerHTML,
          };
          console.log('__ELEMENT_CONTEXTMENU__' + JSON.stringify({ element: elementInfo, x: e.clientX, y: e.clientY }));
        }
      });
    })();
  `,
    []
  );

  // Inject inspector script when webview loads
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleDidFinishLoad = () => {
      webviewLoadedRef.current = true;
      if (inspectorMode) {
        void webview.executeJavaScript(inspectorScript).catch(() => {});
      }
    };

    webview.addEventListener('did-finish-load', handleDidFinishLoad);

    return () => {
      webview.removeEventListener('did-finish-load', handleDidFinishLoad);
    };
  }, [webviewSrc, inspectorScript, inspectorMode]);

  // Re-inject inspector script when inspector mode changes
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || !webviewLoadedRef.current) return;

    if (inspectorMode) {
      void webview.executeJavaScript(inspectorScript).catch(() => {});
    } else {
      // Remove inspector overlay when disabled
      void webview
        .executeJavaScript(
          `
        (function() {
          const overlay = document.querySelector('[style*="z-index: 999999"]');
          if (overlay) overlay.remove();
          window.__inspectorInitialized = false;
        })();
      `
        )
        .catch(() => {});
    }
  }, [inspectorMode, inspectorScript]);

  // Listen for webview console messages (for element selection)
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleConsoleMessage = (event: Event) => {
      const consoleEvent = event as Event & { message?: string };
      const message = consoleEvent.message;

      if (typeof message === 'string') {
        if (message.startsWith('__ELEMENT_SELECTED__')) {
          try {
            const jsonStr = message.slice('__ELEMENT_SELECTED__'.length);
            const elementInfo = JSON.parse(jsonStr) as SelectedElement;
            setSelectedElement(elementInfo);
            messageApi.info(t('preview.html.elementSelected', { path: elementInfo.path }));
          } catch {
            // Ignore parse errors
          }
        } else if (message.startsWith('__ELEMENT_CONTEXTMENU__')) {
          try {
            const jsonStr = message.slice('__ELEMENT_CONTEXTMENU__'.length);
            const data = JSON.parse(jsonStr) as { element: SelectedElement; x: number; y: number };
            const webviewRect = webview.getBoundingClientRect();
            setContextMenu({
              x: webviewRect.left + data.x,
              y: webviewRect.top + data.y,
              element: data.element,
            });
          } catch {
            // Ignore parse errors
          }
        }
      }
    };

    webview.addEventListener('console-message', handleConsoleMessage);

    return () => {
      webview.removeEventListener('console-message', handleConsoleMessage);
    };
  }, [messageApi, t]);

  // Close context menu on click
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const handleCopyHTML = useCallback(
    (html: string) => {
      void navigator.clipboard.writeText(html);
      messageApi.success(t('preview.html.copySuccess'));
      setContextMenu(null);
    },
    [messageApi, t]
  );

  const handleDownload = () => {
    const blob = new Blob([htmlCode], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(filePath ? getBasenameFromPath(filePath) : '') || 'document'}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleToggleEdit = () => {
    if (editMode) {
      setHtmlCode(htmlCode);
    }
    setEditMode(!editMode);
  };

  const handleToggleInspector = () => {
    setInspectorMode(!inspectorMode);
    if (!inspectorMode) {
      messageApi.info(t('preview.html.inspectorEnabled'));
    }
  };

  return (
    <div className='h-full w-full flex flex-col bg-bg-1'>
      {messageContextHolder}

      {/* Toolbar */}
      {!hideToolbar && (
        <div className='flex items-center justify-between h-40px px-12px bg-bg-2 border-b border-border-base flex-shrink-0'>
          <div className='flex items-center gap-8px'>
            <button onClick={handleToggleEdit} className={`px-12px py-4px rd-4px text-12px transition-colors ${editMode ? 'bg-primary text-white' : 'bg-bg-3 text-t-primary hover:bg-bg-4'}`}>
              {editMode ? `💾 ${t('common.save')}` : `✏️ ${t('common.edit')}`}
            </button>

            <button onClick={handleToggleInspector} className={`px-12px py-4px rd-4px text-12px transition-colors ${inspectorMode ? 'bg-primary text-white' : 'bg-bg-3 text-t-primary hover:bg-bg-4'}`} title={t('preview.html.inspectorTooltip')}>
              🔍 {inspectorMode ? t('preview.html.inspecting') : t('preview.html.inspectorButton')}
            </button>

            {selectedElement && (
              <div className='text-12px text-t-secondary ml-8px'>
                {t('preview.html.selectedLabel')} <code className='bg-bg-3 px-4px rd-2px'>{selectedElement.path}</code>
              </div>
            )}
          </div>

          <div className='flex items-center gap-8px'>
            <button onClick={handleDownload} className='flex items-center gap-4px px-8px py-4px rd-4px cursor-pointer hover:bg-bg-3 transition-colors' title={t('preview.html.downloadHtml')}>
              <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' className='text-t-secondary'>
                <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
                <polyline points='7 10 12 15 17 10' />
                <line x1='12' y1='15' x2='12' y2='3' />
              </svg>
              <span className='text-12px text-t-secondary'>{t('common.download')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Content area */}
      <div className='flex-1 flex overflow-hidden'>
        {/* Editor (shown in edit mode) */}
        {editMode && (
          <div className='flex-1 overflow-hidden border-r border-border-base'>
            <MonacoEditor
              height='100%'
              language='html'
              theme={currentTheme === 'dark' ? 'vs-dark' : 'vs'}
              value={htmlCode}
              onChange={(value) => setHtmlCode(value || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                formatOnPaste: true,
                formatOnType: true,
              }}
            />
          </div>
        )}

        {/* HTML Preview using webview */}
        <div className={`${editMode ? 'flex-1' : 'w-full'} overflow-hidden ${currentTheme === 'dark' ? 'bg-bg-1' : 'bg-white'}`}>
          <webview key={webviewSrc} ref={webviewRef} src={webviewSrc} className='w-full h-full border-0' style={{ display: 'inline-flex' }} webpreferences='allowRunningInsecureContent, javascript=yes' />
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className='fixed bg-bg-1 border border-border-base rd-6px shadow-lg py-4px z-9999'
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className='px-12px py-6px text-13px text-t-primary hover:bg-bg-2 cursor-pointer transition-colors' onClick={() => handleCopyHTML(contextMenu.element.html)}>
            📋 {t('preview.html.copyElementHtml')}
          </div>
          <div
            className='px-12px py-6px text-13px text-t-primary hover:bg-bg-2 cursor-pointer transition-colors'
            onClick={() => {
              console.log('[HTMLPreview] Element info:', contextMenu.element);
              messageApi.info(t('preview.html.printedToConsole'));
              setContextMenu(null);
            }}
          >
            🔍 {t('preview.html.viewElementInfo')}
          </div>
        </div>
      )}
    </div>
  );
};

export default HTMLPreview;
