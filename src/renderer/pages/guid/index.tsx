/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { ASSISTANT_PRESETS } from '@/common/presets/assistantPresets';
import type { CliProviderTarget, IProvider, ProjectInfo, TProviderWithModel } from '@/common/storage';
import { ConfigStorage } from '@/common/storage';
import { resolveLocaleKey } from '@/common/utils';
import { useProjects } from '@/renderer/hooks/useProjects';
import { useConversationTabs } from '@/renderer/pages/conversation/context/ConversationTabsContext';
import { ensureProjectForWorkspace } from '@/renderer/utils/projectService';
import { updateWorkspaceTime } from '@/renderer/utils/workspaceHistory';
import ClaudeLogo from '@/renderer/assets/logos/claude.svg';
import CodexLogo from '@/renderer/assets/logos/codex.svg';
import coworkSvg from '@/renderer/assets/cowork.svg';
import FilePreview from '@/renderer/components/FilePreview';
import { useLayoutContext } from '@/renderer/context/LayoutContext';
import { useInputFocusRing } from '@/renderer/hooks/useInputFocusRing';
import { useCompositionInput } from '@/renderer/hooks/useCompositionInput';
import { useDragUpload } from '@/renderer/hooks/useDragUpload';
import { usePasteService } from '@/renderer/hooks/usePasteService';
import { useSlashCommands } from '@/renderer/hooks/useSlashCommands';
import { useCliModelList, getAvailableModels } from '@/renderer/hooks/useCliModelList';
import { CLAUDE_PROVIDER_PRESETS } from '@/renderer/config/cliProviders/claudePresets';
import { CODEX_PROVIDER_PRESETS } from '@/renderer/config/cliProviders/codexPresets';
import { allSupportedExts, type FileMetadata, getCleanFileNames } from '@/renderer/services/FileService';
import { iconColors } from '@/renderer/theme/colors';
import { emitter } from '@/renderer/utils/emitter';
import { applyCliModelOnSelect } from '@/renderer/utils/cliModelService';
import { INTERACTIVE_MODE_CONFIG_KEY } from '@/common/interactivePrompt';
import type { AcpBackend, AcpBackendConfig } from '@/types/acpTypes';
import { Button, ConfigProvider, Dropdown, Input, Menu, Tooltip } from '@arco-design/web-react';
import { IconClose } from '@arco-design/web-react/icon';
import { ArrowUp, Down, FolderOpen, Plus, Robot, UploadOne } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import useSWR, { mutate } from 'swr';
import styles from './index.module.css';

// Define CollabRole type for initial role selection
type CollabRole = 'pm' | 'analyst' | 'engineer';

/**
 * Map assistant customAgentId to CollabRole
 * Returns the role if the assistant is a builtin collab assistant, otherwise returns 'pm' as default
 */
const getCollabRoleFromAgentId = (customAgentId?: string): CollabRole => {
  if (!customAgentId) return 'pm';
  if (customAgentId === 'builtin-pm') return 'pm';
  if (customAgentId === 'builtin-analyst') return 'analyst';
  if (customAgentId === 'builtin-engineer') return 'engineer';
  return 'pm'; // default fallback
};

/**
 * 获取代理的唯一选择键
 * 对于自定义代理返回 "custom:uuid"，其他代理返回 backend 类型
 * Helper to get agent key for selection
 * Returns "custom:uuid" for custom agents, backend type for others
 */
const getAgentKey = (agent: { backend: AcpBackend; customAgentId?: string }) => {
  return agent.backend === 'custom' && agent.customAgentId ? `custom:${agent.customAgentId}` : agent.backend;
};

// Agent Logo 映射 (custom uses Robot icon from @icon-park/react)
const AGENT_LOGO_MAP: Partial<Record<AcpBackend, string>> = {
  claude: ClaudeLogo,
  codex: CodexLogo,
};
const CUSTOM_AVATAR_IMAGE_MAP: Record<string, string> = {
  'cowork.svg': coworkSvg,
  '🛠️': coworkSvg,
};

const Guid: React.FC = () => {
  const { t, i18n } = useTranslation();
  const guidContainerRef = useRef<HTMLDivElement>(null);
  const { closeAllTabs, openTab } = useConversationTabs();
  const { activeBorderColor, inactiveBorderColor, activeShadow } = useInputFocusRing();
  const localeKey = resolveLocaleKey(i18n.language);

  // 打开外部链接 / Open external link
  const openLink = useCallback(async (url: string) => {
    try {
      await ipcBridge.shell.openExternal.invoke(url);
    } catch (error) {
      console.error('Failed to open external link:', error);
    }
  }, []);
  const location = useLocation();
  const [input, setInput] = useState('');
  const [cursorIndex, setCursorIndex] = useState(0);
  const [commandMenuHidden, setCommandMenuHidden] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionSelectorVisible, setMentionSelectorVisible] = useState(false);
  const [mentionSelectorOpen, setMentionSelectorOpen] = useState(false);
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [dir, setDir] = useState<string>('');
  const [collabMode, setCollabMode] = useState(true);
  const [isCollabModeLoaded, setIsCollabModeLoaded] = useState(false);
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [isInteractiveModeLoaded, setIsInteractiveModeLoaded] = useState(false);
  const { activeProject } = useProjects();
  const dirRef = useRef('');
  const lastProjectWorkspaceRef = useRef<string | null>(null);
  const [currentModel, _setCurrentModel] = useState<TProviderWithModel>();
  const [isInputFocused, setIsInputFocused] = useState(false);
  const isInputActive = isInputFocused;
  const [hoveredQuickAction, setHoveredQuickAction] = useState<'feedback' | 'repo' | null>(null);
  const quickActionStyle = useCallback(
    (isActive: boolean) => ({
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: isActive ? activeBorderColor : inactiveBorderColor,
      boxShadow: isActive ? activeShadow : 'var(--shadow-sm)',
    }),
    [activeBorderColor, activeShadow, inactiveBorderColor]
  );

  useEffect(() => {
    dirRef.current = dir;
  }, [dir]);

  useEffect(() => {
    let isActive = true;
    ConfigStorage.get('guid.collabMode')
      .then((stored) => {
        if (!isActive) return;
        if (typeof stored === 'boolean') {
          setCollabMode(stored);
        }
      })
      .catch((error) => {
        console.error('Failed to load collab mode:', error);
      })
      .finally(() => {
        if (isActive) {
          setIsCollabModeLoaded(true);
        }
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!isCollabModeLoaded) return;
    ConfigStorage.set('guid.collabMode', collabMode).catch((error) => {
      console.error('Failed to save collab mode:', error);
    });
  }, [collabMode, isCollabModeLoaded]);

  useEffect(() => {
    let isActive = true;
    ConfigStorage.get(INTERACTIVE_MODE_CONFIG_KEY)
      .then((stored) => {
        if (!isActive) return;
        if (typeof stored === 'boolean') {
          setInteractiveMode(stored);
        }
      })
      .catch((error) => {
        console.error('Failed to load interactive mode:', error);
      })
      .finally(() => {
        if (isActive) {
          setIsInteractiveModeLoaded(true);
        }
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!isInteractiveModeLoaded) return;
    ConfigStorage.set(INTERACTIVE_MODE_CONFIG_KEY, interactiveMode).catch((error) => {
      console.error('Failed to save interactive mode:', error);
    });
  }, [interactiveMode, isInteractiveModeLoaded]);

  useEffect(() => {
    if (!activeProject?.workspace) return;
    const currentDir = dirRef.current;
    if (!currentDir || currentDir === lastProjectWorkspaceRef.current) {
      setDir(activeProject.workspace);
    }
    lastProjectWorkspaceRef.current = activeProject.workspace;
  }, [activeProject?.workspace]);

  // 从 location.state 中读取 workspace（从 tabs 的添加按钮传递）
  useEffect(() => {
    const state = location.state as { workspace?: string } | null;
    if (state?.workspace) {
      void ensureProjectForWorkspace(state.workspace).then((project) => {
        setDir(project.workspace);
        lastProjectWorkspaceRef.current = project.workspace;
      });
    }
  }, [location.state]);
  // 记录当前选中的 provider+model，方便列表刷新时判断是否仍可用
  const selectedModelKeyRef = useRef<string | null>(null);
  // 支持在初始化页展示 Codex（MCP）选项，先做 UI 占位
  // 对于自定义代理，使用 "custom:uuid" 格式来区分多个自定义代理
  // For custom agents, we store "custom:uuid" format to distinguish between multiple custom agents
  const [selectedAgentKey, _setSelectedAgentKey] = useState<string>('claude');

  // 封装 setSelectedAgentKey 以同时保存到 storage
  // Wrap setSelectedAgentKey to also save to storage
  const setSelectedAgentKey = useCallback((key: string) => {
    _setSelectedAgentKey(key);
    // 保存选择到 storage / Save selection to storage
    ConfigStorage.set('guid.lastSelectedAgent', key).catch((error) => {
      console.error('Failed to save selected agent:', error);
    });
  }, []);
  const [availableAgents, setAvailableAgents] = useState<
    Array<{
      backend: AcpBackend;
      name: string;
      cliPath?: string;
      customAgentId?: string;
      isPreset?: boolean;
      context?: string;
      avatar?: string;
      presetAgentType?: 'claude' | 'codex';
    }>
  >();
  const [customAgents, setCustomAgents] = useState<AcpBackendConfig[]>([]);
  const [skillsEnabledByAgent, setSkillsEnabledByAgent] = useState<Record<string, string[]>>({});

  /**
   * 通过选择键查找代理
   * 支持 "custom:uuid" 格式和普通 backend 类型
   * Helper to find agent by key
   * Supports both "custom:uuid" format and plain backend type
   */
  const findAgentByKey = (key: string) => {
    if (key.startsWith('custom:')) {
      const customAgentId = key.slice(7);
      return availableAgents?.find((a) => a.backend === 'custom' && a.customAgentId === customAgentId);
    }
    return availableAgents?.find((a) => a.backend === key);
  };

  // 获取选中的后端类型（向后兼容）/ Get the selected backend type (for backward compatibility)
  const selectedAgent = selectedAgentKey.startsWith('custom:') ? 'custom' : (selectedAgentKey as AcpBackend);
  const selectedAgentInfo = useMemo(() => findAgentByKey(selectedAgentKey), [selectedAgentKey, availableAgents]);
  // eslint-disable-next-line max-len
  const { modelList, isConfigured: isCliProviderConfigured, hasCliTarget: hasCliProviderTarget, hasEnabledModels: hasCliProviderEnabledModels, isLoading: isCliProviderLoading } = useCliModelList(selectedAgentKey, selectedAgentInfo?.presetAgentType || null);
  const isPresetAgent = Boolean(selectedAgentInfo?.isPreset);
  const [isPlusDropdownOpen, setIsPlusDropdownOpen] = useState(false);
  const [typewriterPlaceholder, setTypewriterPlaceholder] = useState('');
  const [_isTyping, setIsTyping] = useState(true);
  const mentionMatchRegex = useMemo(() => /(?:^|\s)@([^\s@]*)$/, []);

  /**
   * 生成唯一模型 key（providerId:model）
   * Build a unique key for provider/model pair
   */
  const buildModelKey = (providerId?: string, modelName?: string) => {
    if (!providerId || !modelName) return null;
    return `${providerId}:${modelName}`;
  };

  /**
   * 检查当前 key 是否仍存在于新模型列表中
   * Check if selected model key still exists in the new provider list
   */
  const isModelKeyAvailable = (key: string | null, providers?: IProvider[]) => {
    if (!key || !providers || providers.length === 0) return false;
    return providers.some((provider) => {
      if (!provider.id || !provider.model?.length) return false;
      return provider.model.some((modelName) => buildModelKey(provider.id, modelName) === key);
    });
  };

  const setCurrentModel = async (modelInfo: TProviderWithModel, isManualSelection = false) => {
    // 记录最新的选中 key，避免列表刷新后被错误重置
    selectedModelKeyRef.current = buildModelKey(modelInfo.id, modelInfo.useModel);
    _setCurrentModel(modelInfo);
    // Do not pollute global default model with CLI pseudo models.
    if (!modelInfo.id?.startsWith('cli:')) {
      await ConfigStorage.set('model.defaultModel', modelInfo.useModel).catch((error) => {
        console.error('Failed to save default model:', error);
      });
    }

    // Only write to external CLI config when user manually selects a CLI model
    if (isManualSelection && modelInfo.id?.startsWith('cli:')) {
      await applyCliModelOnSelect(modelInfo).catch((error) => {
        console.error('Failed to apply CLI model config:', error);
      });
    }
  };
  const navigate = useNavigate();
  const _layout = useLayoutContext();

  // 处理粘贴的文件
  const handleFilesAdded = useCallback((pastedFiles: FileMetadata[]) => {
    // 直接使用文件路径（现在总是有效的）/ Use file paths directly (always valid now)
    const filePaths = pastedFiles.map((file) => file.path);

    setFiles((prevFiles) => [...prevFiles, ...filePaths]);
    setDir(''); // 清除文件夹选择 / Clear selected directory
  }, []);

  const handleRemoveFile = useCallback((targetPath: string) => {
    // 删除初始化面板中的已选文件 / Remove files already selected on the welcome screen
    setFiles((prevFiles) => prevFiles.filter((file) => file !== targetPath));
  }, []);

  // 使用拖拽 hook
  const { isFileDragging, dragHandlers } = useDragUpload({
    supportedExts: allSupportedExts,
    onFilesAdded: handleFilesAdded,
  });

  // 使用共享的PasteService集成
  const { onPaste, onFocus } = usePasteService({
    supportedExts: allSupportedExts,
    onFilesAdded: handleFilesAdded,
    onTextPaste: (text: string) => {
      // 按光标位置插入文本，保持现有内容
      const textarea = document.activeElement as HTMLTextAreaElement | null;
      if (textarea && textarea.tagName === 'TEXTAREA') {
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? start;
        const currentValue = textarea.value;
        const newValue = currentValue.slice(0, start) + text + currentValue.slice(end);
        setInput(newValue);
        setTimeout(() => {
          textarea.setSelectionRange(start + text.length, start + text.length);
        }, 0);
      } else {
        setInput((prev) => prev + text);
      }
    },
  });
  const handleTextareaFocus = useCallback(() => {
    onFocus();
    setIsInputFocused(true);
  }, [onFocus]);
  const handleTextareaBlur = useCallback(() => {
    setIsInputFocused(false);
  }, []);

  const customAgentAvatarMap = useMemo(() => {
    return new Map(customAgents.map((agent) => [agent.id, agent.avatar]));
  }, [customAgents]);

  const mentionOptions = useMemo(() => {
    const agents = availableAgents || [];
    return agents.map((agent) => {
      const key = getAgentKey(agent);
      const label = agent.name || agent.backend;
      const avatarValue = agent.backend === 'custom' ? agent.avatar || customAgentAvatarMap.get(agent.customAgentId || '') : undefined;
      const avatar = avatarValue ? avatarValue.trim() : undefined;
      const tokens = new Set<string>();
      const normalizedLabel = label.toLowerCase();
      tokens.add(normalizedLabel);
      tokens.add(normalizedLabel.replace(/\s+/g, '-'));
      tokens.add(normalizedLabel.replace(/\s+/g, ''));
      tokens.add(agent.backend.toLowerCase());
      if (agent.customAgentId) {
        tokens.add(agent.customAgentId.toLowerCase());
      }
      return {
        key,
        label,
        tokens,
        avatar,
        avatarImage: avatar ? CUSTOM_AVATAR_IMAGE_MAP[avatar] : undefined,
        logo: AGENT_LOGO_MAP[agent.backend],
      };
    });
  }, [availableAgents, customAgentAvatarMap]);

  const filteredMentionOptions = useMemo(() => {
    if (!mentionQuery) return mentionOptions;
    const query = mentionQuery.toLowerCase();
    return mentionOptions.filter((option) => Array.from(option.tokens).some((token) => token.startsWith(query)));
  }, [mentionOptions, mentionQuery]);

  const stripMentionToken = useCallback(
    (value: string) => {
      if (!mentionMatchRegex.test(value)) return value;
      return value.replace(mentionMatchRegex, (_match, _query) => '').trimEnd();
    },
    [mentionMatchRegex]
  );

  const selectMentionAgent = useCallback(
    (key: string) => {
      setSelectedAgentKey(key);
      setInput((prev) => stripMentionToken(prev));
      setMentionOpen(false);
      setMentionSelectorOpen(false);
      setMentionSelectorVisible(true);
      setMentionQuery(null);
      setMentionActiveIndex(0);
    },
    [stripMentionToken]
  );

  const selectedAgentLabel = selectedAgentInfo?.name || selectedAgentKey;
  const mentionMenuActiveOption = filteredMentionOptions[mentionActiveIndex] || filteredMentionOptions[0];
  const mentionMenuSelectedKey = mentionOpen || mentionSelectorOpen ? mentionMenuActiveOption?.key || selectedAgentKey : selectedAgentKey;
  const mentionMenuRef = useRef<HTMLDivElement>(null);

  const mentionMenu = useMemo(
    () => (
      <div ref={mentionMenuRef} className='bg-bg-2 border border-[var(--color-border-2)] rd-12px shadow-lg overflow-hidden' style={{ boxShadow: '0 0 0 1px var(--color-border-2), 0 12px 24px rgba(0, 0, 0, 0.12)' }}>
        <Menu selectedKeys={[mentionMenuSelectedKey]} onClickMenuItem={(key) => selectMentionAgent(String(key))} className='min-w-180px max-h-200px overflow-auto'>
          {filteredMentionOptions.length > 0 ? (
            filteredMentionOptions.map((option, index) => (
              <Menu.Item key={option.key} data-mention-index={index}>
                <div className='flex items-center gap-8px'>
                  {option.avatarImage ? <img src={option.avatarImage} alt='' width={16} height={16} style={{ objectFit: 'contain' }} /> : option.avatar ? <span style={{ fontSize: 14, lineHeight: '16px' }}>{option.avatar}</span> : option.logo ? <img src={option.logo} alt={option.label} width={16} height={16} style={{ objectFit: 'contain' }} /> : <Robot theme='outline' size={16} />}
                  <span>{option.label}</span>
                </div>
              </Menu.Item>
            ))
          ) : (
            <Menu.Item key='empty' disabled>
              {t('conversation.welcome.none', { defaultValue: 'None' })}
            </Menu.Item>
          )}
        </Menu>
      </div>
    ),
    [filteredMentionOptions, mentionMenuSelectedKey, selectMentionAgent, t]
  );

  // 获取可用的 ACP agents - 基于全局标记位
  const { data: availableAgentsData } = useSWR('acp.agents.available', async () => {
    const result = await ipcBridge.acpConversation.getAvailableAgents.invoke();
    return result.success ? result.data : [];
  });

  // 更新本地状态
  useEffect(() => {
    if (availableAgentsData) {
      setAvailableAgents(availableAgentsData);
    }
  }, [availableAgentsData]);

  // 加载上次选择的 agent / Load last selected agent
  useEffect(() => {
    if (!availableAgents || availableAgents.length === 0) return;
    let isActive = true;
    ConfigStorage.get('guid.lastSelectedAgent')
      .then((savedAgentKey) => {
        if (!isActive) return;
        const savedKey = typeof savedAgentKey === 'string' ? savedAgentKey : '';
        const isAvailable = savedKey ? availableAgents.some((agent) => getAgentKey(agent) === savedKey) : false;
        const pmAgent = availableAgents.find((agent) => agent.backend === 'custom' && agent.customAgentId === 'builtin-pm');
        const fallbackKey = pmAgent ? getAgentKey(pmAgent) : '';
        const resolvedKey = isAvailable ? savedKey : fallbackKey;
        if (resolvedKey) {
          setSelectedAgentKey(resolvedKey);
        }
      })
      .catch((error) => {
        console.error('Failed to load last selected agent:', error);
      });
    return () => {
      isActive = false;
    };
  }, [availableAgents, setSelectedAgentKey]);

  useEffect(() => {
    let isActive = true;
    ConfigStorage.get('acp.customAgents')
      .then((agents) => {
        if (!isActive) return;
        setCustomAgents(agents || []);
      })
      .catch((error) => {
        console.error('Failed to load custom agents:', error);
      });
    return () => {
      isActive = false;
    };
  }, [availableAgentsData]);

  useEffect(() => {
    let isActive = true;
    ConfigStorage.get('skills.enabledByAgent')
      .then((data) => {
        if (!isActive) return;
        setSkillsEnabledByAgent(data || {});
      })
      .catch(() => {
        if (!isActive) return;
        setSkillsEnabledByAgent({});
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (mentionOpen) {
      setMentionActiveIndex(0);
      return;
    }
    if (mentionSelectorOpen) {
      const selectedIndex = filteredMentionOptions.findIndex((option) => option.key === selectedAgentKey);
      setMentionActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }, [filteredMentionOptions, mentionOpen, mentionQuery, mentionSelectorOpen, selectedAgentKey]);

  useEffect(() => {
    if (!mentionOpen && !mentionSelectorOpen) return;
    const container = mentionMenuRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`[data-mention-index="${mentionActiveIndex}"]`);
    if (!target) return;
    target.scrollIntoView({ block: 'nearest' });
  }, [mentionActiveIndex, mentionOpen, mentionSelectorOpen]);

  const { compositionHandlers, isComposing } = useCompositionInput();

  /**
   * 解析预设助手的 rules 和 skills
   * Resolve preset assistant rules and skills
   *
   * - rules: 系统规则，在会话初始化时注入到 userMemory
   * - skills: 技能定义，在首次请求时注入到消息前缀
   */
  const resolvePresetRulesAndSkills = useCallback(
    async (agentInfo: { backend: AcpBackend; customAgentId?: string; context?: string } | undefined): Promise<{ rules?: string; skills?: string }> => {
      if (!agentInfo) return {};
      if (agentInfo.backend !== 'custom') {
        return { rules: agentInfo.context };
      }

      const customAgentId = agentInfo.customAgentId;
      if (!customAgentId) return { rules: agentInfo.context };

      let rules = '';
      let skills = '';

      // 1. 加载 rules / Load rules
      try {
        rules = await ipcBridge.fs.readAssistantRule.invoke({
          assistantId: customAgentId,
          locale: localeKey,
        });
      } catch (error) {
        console.warn(`Failed to load rules for ${customAgentId}:`, error);
      }

      // 2. 加载 skills / Load skills
      try {
        skills = await ipcBridge.fs.readAssistantSkill.invoke({
          assistantId: customAgentId,
          locale: localeKey,
        });
      } catch (error) {
        // skills 可能不存在，这是正常的 / skills may not exist, this is normal
      }

      // 3. Fallback: 如果是内置助手且文件为空，从内置资源加载
      // Fallback: If builtin assistant and files are empty, load from builtin resources
      if (customAgentId.startsWith('builtin-')) {
        const presetId = customAgentId.replace('builtin-', '');
        const preset = ASSISTANT_PRESETS.find((p) => p.id === presetId);
        if (preset) {
          // Fallback for rules
          if (!rules && preset.ruleFiles) {
            try {
              const ruleFile = preset.ruleFiles[localeKey] || preset.ruleFiles['en-US'];
              if (ruleFile) {
                rules = await ipcBridge.fs.readBuiltinRule.invoke({ fileName: ruleFile });
              }
            } catch (e) {
              console.warn(`Failed to load builtin rules for ${customAgentId}:`, e);
            }
          }
          // Fallback for skills
          if (!skills && preset.skillFiles) {
            try {
              const skillFile = preset.skillFiles[localeKey] || preset.skillFiles['en-US'];
              if (skillFile) {
                skills = await ipcBridge.fs.readBuiltinSkill.invoke({ fileName: skillFile });
              }
            } catch (e) {
              // skills fallback failure is ok
            }
          }
        }
      }

      return { rules: rules || agentInfo.context, skills };
    },
    [localeKey]
  );

  const resolvePresetAgentType = useCallback(
    (agentInfo: { backend: AcpBackend; customAgentId?: string } | undefined) => {
      if (!agentInfo) return 'claude';
      if (agentInfo.backend !== 'custom') return 'claude';
      const customAgent = customAgents.find((agent) => agent.id === agentInfo.customAgentId);
      return customAgent?.presetAgentType || 'claude';
    },
    [customAgents]
  );

  // 解析助手启用的 skills 列表 / Resolve enabled skills for the assistant
  const resolveEnabledSkills = useCallback(
    (agentInfo: { backend: AcpBackend; customAgentId?: string } | undefined): string[] | undefined => {
      if (!agentInfo) return undefined;
      if (agentInfo.backend !== 'custom') {
        return skillsEnabledByAgent[agentInfo.backend] || undefined;
      }
      const customAgent = customAgents.find((agent) => agent.id === agentInfo.customAgentId);
      return customAgent?.enabledSkills;
    },
    [customAgents, skillsEnabledByAgent]
  );

  const refreshCustomAgents = useCallback(async () => {
    try {
      await ipcBridge.acpConversation.refreshCustomAgents.invoke();
      await mutate('acp.agents.available');
    } catch (error) {
      console.error('Failed to refresh custom agents:', error);
    }
  }, []);

  const toggleCollabMode = useCallback(() => {
    setCollabMode((prev) => !prev);
  }, []);

  const toggleInteractiveMode = useCallback(() => {
    setInteractiveMode((prev) => !prev);
  }, []);

  useEffect(() => {
    void refreshCustomAgents();
  }, [refreshCustomAgents]);

  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      setCommandMenuHidden(false);
      setTimeout(() => {
        const textarea = document.activeElement as HTMLTextAreaElement | null;
        if (textarea && textarea.tagName === 'TEXTAREA') {
          setCursorIndex(textarea.selectionStart ?? value.length);
        } else {
          setCursorIndex(value.length);
        }
      }, 0);
      const match = value.match(mentionMatchRegex);
      if (match) {
        setMentionQuery(match[1]);
        setMentionOpen(true);
        setMentionSelectorOpen(false);
      } else {
        setMentionQuery(null);
        setMentionOpen(false);
      }
    },
    [mentionMatchRegex]
  );

  const handleSend = async () => {
    // 用户明确选择的目录 -> customWorkspace = true, 使用用户选择的目录
    // 未选择时 -> customWorkspace = false, 传空让后端创建临时目录 (agent-temp-xxx)
    let isCustomWorkspace = !!dir;
    let finalWorkspace = dir || ''; // 不指定时传空，让后端创建临时目录
    let project: ProjectInfo | null = null;

    if (!finalWorkspace && activeProject?.workspace) {
      finalWorkspace = activeProject.workspace;
      isCustomWorkspace = true;
    }

    if (finalWorkspace) {
      project = await ensureProjectForWorkspace(finalWorkspace);
      lastProjectWorkspaceRef.current = project.workspace;
    }

    const projectId = project?.id;

    const agentInfo = selectedAgentInfo;
    const isPreset = isPresetAgent;
    const presetAgentType = resolvePresetAgentType(agentInfo);
    // 加载 rules（skills 已迁移到 SkillManager）/ Load rules (skills migrated to SkillManager)
    const [{ rules: presetRules }, superpowersConfig] = await Promise.all([resolvePresetRulesAndSkills(agentInfo), ConfigStorage.get('superpowers.config').catch((): undefined => undefined)]);
    // 获取启用的 skills 列表 / Get enabled skills list
    const enabledSkills = resolveEnabledSkills(agentInfo);

    if (!currentModel) return;

    const resolvePresetContext = async (backend: AcpBackend) => {
      if (collabMode) return undefined;
      const baseContext = isPreset ? presetRules : '';
      const agentConfig = superpowersConfig?.enabledForAgents?.[backend];
      const mode = superpowersConfig?.workflowMode;
      let workflowContext = '';
      if (agentConfig?.enabled && agentConfig?.autoInject && mode && mode !== 'passive') {
        workflowContext = await ipcBridge.superpowers.getWorkflowContext.invoke({ mode });
      }
      const parts = [baseContext, workflowContext].map((value) => value?.trim()).filter(Boolean) as string[];
      return parts.length ? parts.join('\n\n---\n\n') : undefined;
    };

    if (selectedAgent === 'codex' || (isPreset && presetAgentType === 'codex')) {
      // Codex conversation type (including preset with codex agent type)
      const codexAgentInfo = agentInfo || findAgentByKey(selectedAgentKey);
      const presetContext = await resolvePresetContext('codex');

      // 创建 Codex 会话并保存初始消息，由对话页负责发送
      try {
        const conversation = await ipcBridge.conversation.create.invoke({
          type: 'codex',
          name: input,
          model: currentModel!, // not used by codex, but required by type
          extra: {
            defaultFiles: files,
            workspace: finalWorkspace,
            customWorkspace: isCustomWorkspace,
            projectId,
            // In collab mode, parent conversation should not have preset context
            // Child conversations will have their own preset contexts
            presetContext,
            // 启用的 skills 列表（通过 SkillManager 加载）/ Enabled skills list (loaded via SkillManager)
            enabledSkills: enabledSkills,
            // In collab mode, parent conversation should not have presetAssistantId
            // Child conversations will have their own presetAssistantIds
            presetAssistantId: collabMode ? undefined : isPreset ? codexAgentInfo?.customAgentId : undefined,
          },
        });

        if (!conversation || !conversation.id) {
          alert('Failed to create Codex conversation. Please ensure the Codex CLI is installed and accessible in PATH.');
          return;
        }

        // 更新 workspace 时间戳，确保分组会话能正确排序（仅自定义工作空间）
        if (isCustomWorkspace) {
          closeAllTabs();
          updateWorkspaceTime(finalWorkspace);
          // 将新会话添加到 tabs
          openTab(conversation);
        }

        // 立即触发刷新，让左侧栏开始加载新会话（在导航前）
        emitter.emit('chat.history.refresh');

        // 交给对话页发送，避免事件丢失
        const initialMessage = {
          input,
          files: files.length > 0 ? files : undefined,
        };
        sessionStorage.setItem(`codex_initial_message_${conversation.id}`, JSON.stringify(initialMessage));
        if (collabMode) {
          // Determine initial role from selected assistant
          const initialRole = getCollabRoleFromAgentId(selectedAgentInfo?.customAgentId);
          console.log('[Collab-Guid] Codex: selectedAgentInfo.customAgentId:', selectedAgentInfo?.customAgentId, '→ initialRole:', initialRole);
          sessionStorage.setItem(`collab_auto_enable_${conversation.id}`, '1');
          sessionStorage.setItem(`collab_active_role_${conversation.id}`, initialRole);
        }

        // 然后导航到会话页面
        await navigate(`/conversation/${conversation.id}`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        alert(`Failed to create Codex conversation: ${errorMessage}`);
        throw error;
      }
      return;
    }

    // ACP conversation type (including preset with claude agent type)
    const acpAgentInfo = agentInfo || findAgentByKey(selectedAgentKey);

    // For preset with claude agent type, we use 'claude' as backend
    const acpBackend = isPreset && presetAgentType === 'claude' ? 'claude' : selectedAgent;

    if (!acpAgentInfo && !isPreset) {
      alert(`${selectedAgent} CLI not found or not configured. Please ensure it's installed and accessible.`);
      return;
    }

    try {
      const presetContext = await resolvePresetContext(acpBackend);
      const conversation = await ipcBridge.conversation.create.invoke({
        type: 'acp',
        name: input,
        model: currentModel!, // ACP needs a model too
        extra: {
          defaultFiles: files,
          workspace: finalWorkspace,
          customWorkspace: isCustomWorkspace,
          projectId,
          backend: acpBackend,
          cliPath: acpAgentInfo?.cliPath,
          agentName: acpAgentInfo?.name, // 存储自定义代理的配置名称 / Store configured name for custom agents
          customAgentId: acpAgentInfo?.customAgentId, // 自定义代理的 UUID / UUID for custom agents
          // In collab mode, parent conversation should not have preset context
          // Child conversations will have their own preset contexts
          presetContext,
          // 启用的 skills 列表（通过 SkillManager 加载）/ Enabled skills list (loaded via SkillManager)
          enabledSkills: enabledSkills,
          // In collab mode, parent conversation should not have presetAssistantId
          // Child conversations will have their own presetAssistantIds
          presetAssistantId: collabMode ? undefined : isPreset ? acpAgentInfo?.customAgentId : undefined,
        },
      });

      if (!conversation || !conversation.id) {
        alert('Failed to create ACP conversation. Please check your ACP configuration and ensure the CLI is installed.');
        return;
      }

      // 更新 workspace 时间戳，确保分组会话能正确排序（仅自定义工作空间）
      if (isCustomWorkspace) {
        closeAllTabs();
        updateWorkspaceTime(finalWorkspace);
        // 将新会话添加到 tabs
        openTab(conversation);
      }

      // 立即触发刷新，让左侧栏开始加载新会话（在导航前）
      emitter.emit('chat.history.refresh');

      // For ACP, we need to wait for the connection to be ready before sending the message
      // Store the initial message and let the conversation page handle it when ready
      const initialMessage = {
        input,
        files: files.length > 0 ? files : undefined,
      };

      // Store initial message in sessionStorage to be picked up by the conversation page
      sessionStorage.setItem(`acp_initial_message_${conversation.id}`, JSON.stringify(initialMessage));
      if (collabMode) {
        // Determine initial role from selected assistant
        const initialRole = getCollabRoleFromAgentId(selectedAgentInfo?.customAgentId);
        console.log('[Collab-Guid] ACP: selectedAgentInfo.customAgentId:', selectedAgentInfo?.customAgentId, '→ initialRole:', initialRole);
        sessionStorage.setItem(`collab_auto_enable_${conversation.id}`, '1');
        sessionStorage.setItem(`collab_active_role_${conversation.id}`, initialRole);
      }

      // 然后导航到会话页面
      await navigate(`/conversation/${conversation.id}`);
    } catch (error: unknown) {
      console.error('Failed to create ACP conversation:', error);

      // Check if it's an authentication error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('[ACP-AUTH-')) {
        console.error(t('acp.auth.console_error'), errorMessage);
        const confirmed = window.confirm(t('acp.auth.failed_confirm', { backend: selectedAgent, error: errorMessage }));
        if (confirmed) {
          void navigate('/settings/model');
        }
      } else {
        alert(`Failed to create ${selectedAgent} ACP conversation. Please check your ACP configuration and ensure the CLI is installed.`);
      }
      throw error; // Re-throw to prevent input clearing
    }
  };
  const sendMessageHandler = () => {
    setLoading(true);
    handleSend()
      .then(() => {
        // Clear all input states on successful send
        setInput('');
        setMentionOpen(false);
        setMentionQuery(null);
        setMentionSelectorOpen(false);
        setMentionActiveIndex(0);
        setFiles([]);
        setDir(activeProject?.workspace || '');
      })
      .catch((error) => {
        console.error('Failed to send message:', error);
        // Keep the input content when there's an error
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const { commands: slashCommands } = useSlashCommands();

  const getCommandQuery = useCallback((value: string, cursor: number) => {
    if (cursor < 0 || cursor > value.length) return null;
    const beforeCursor = value.slice(0, cursor);
    const slashIndex = beforeCursor.lastIndexOf('/');
    if (slashIndex === -1) return null;
    const prevChar = slashIndex > 0 ? beforeCursor[slashIndex - 1] : '';
    if (prevChar && !/\s/.test(prevChar)) return null;
    const tokenEndMatch = value.slice(slashIndex + 1).search(/\s/);
    const tokenEnd = tokenEndMatch === -1 ? value.length : slashIndex + 1 + tokenEndMatch;
    if (cursor > tokenEnd) return null;
    const query = value.slice(slashIndex + 1, cursor);
    return { slashIndex, tokenEnd, query };
  }, []);

  const commandQuery = useMemo(() => {
    if (commandMenuHidden || mentionOpen || mentionSelectorOpen) return null;
    return getCommandQuery(input, cursorIndex);
  }, [commandMenuHidden, cursorIndex, getCommandQuery, input, mentionOpen, mentionSelectorOpen]);

  const filteredCommands = useMemo(() => {
    if (!commandQuery) return [];
    const keyword = commandQuery.query.toLowerCase();
    return slashCommands.filter((command) => command.trigger.toLowerCase().startsWith(keyword));
  }, [commandQuery, slashCommands]);

  const isCommandMenuOpen = Boolean(commandQuery);

  useEffect(() => {
    setActiveCommandIndex(0);
  }, [commandQuery?.query, filteredCommands.length]);

  const applyCommandSelection = useCallback(
    (trigger: string) => {
      if (!commandQuery) return;
      const before = input.slice(0, commandQuery.slashIndex);
      const after = input.slice(commandQuery.tokenEnd);
      const nextValue = `${before}/${trigger}${after}`;
      setInput(nextValue);
      setCommandMenuHidden(true);
      setTimeout(() => {
        const textarea = document.activeElement as HTMLTextAreaElement | null;
        if (textarea && textarea.tagName === 'TEXTAREA') {
          const nextCursor = before.length + trigger.length + 1;
          textarea.setSelectionRange(nextCursor, nextCursor);
          setCursorIndex(nextCursor);
        } else {
          setCursorIndex(nextValue.length);
        }
      }, 0);
    },
    [commandQuery, input]
  );
  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (isComposing.current) return;
      if (isCommandMenuOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setCommandMenuHidden(true);
          return;
        }
        if (filteredCommands.length > 0) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveCommandIndex((prev) => (prev + 1) % filteredCommands.length);
            return;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveCommandIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
            return;
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            const selected = filteredCommands[activeCommandIndex];
            if (selected) {
              applyCommandSelection(selected.trigger);
            }
            return;
          }
        }
      }
      if ((mentionOpen || mentionSelectorOpen) && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        if (filteredMentionOptions.length === 0) return;
        setMentionActiveIndex((prev) => {
          if (event.key === 'ArrowDown') {
            return (prev + 1) % filteredMentionOptions.length;
          }
          return (prev - 1 + filteredMentionOptions.length) % filteredMentionOptions.length;
        });
        return;
      }
      if ((mentionOpen || mentionSelectorOpen) && event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (filteredMentionOptions.length > 0) {
          const query = mentionQuery?.toLowerCase();
          const exactMatch = query ? filteredMentionOptions.find((option) => option.label.toLowerCase() === query || option.tokens.has(query)) : undefined;
          const selected = exactMatch || filteredMentionOptions[mentionActiveIndex] || filteredMentionOptions[0];
          if (selected) {
            selectMentionAgent(selected.key);
            return;
          }
        }
        setMentionOpen(false);
        setMentionQuery(null);
        setMentionSelectorOpen(false);
        setMentionActiveIndex(0);
        return;
      }
      if (mentionOpen && (event.key === 'Backspace' || event.key === 'Delete') && !mentionQuery) {
        setMentionOpen(false);
        setMentionQuery(null);
        setMentionActiveIndex(0);
        return;
      }
      if (!mentionOpen && mentionSelectorVisible && !input.trim() && (event.key === 'Backspace' || event.key === 'Delete')) {
        event.preventDefault();
        setMentionSelectorVisible(false);
        setMentionSelectorOpen(false);
        setMentionActiveIndex(0);
        return;
      }
      if ((mentionOpen || mentionSelectorOpen) && event.key === 'Escape') {
        event.preventDefault();
        setMentionOpen(false);
        setMentionQuery(null);
        setMentionSelectorOpen(false);
        setMentionActiveIndex(0);
        return;
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (!input.trim()) return;
        sendMessageHandler();
      }
    },
    // eslint-disable-next-line max-len
    [activeCommandIndex, applyCommandSelection, filteredCommands, filteredMentionOptions, input, isCommandMenuOpen, isComposing, mentionActiveIndex, mentionOpen, mentionQuery, mentionSelectorOpen, mentionSelectorVisible, selectMentionAgent, sendMessageHandler]
  );
  const setDefaultModel = async () => {
    if (!modelList || modelList.length === 0) {
      return;
    }
    const currentKey = selectedModelKeyRef.current || buildModelKey(currentModel?.id, currentModel?.useModel);
    // 当前选择仍然可用则不重置 / Keep current selection when still available
    if (isModelKeyAvailable(currentKey, modelList)) {
      if (!selectedModelKeyRef.current && currentKey) {
        selectedModelKeyRef.current = currentKey;
      }
      return;
    }
    // 读取默认配置，或回落到新的第一个模型
    const useModel = await ConfigStorage.get('model.defaultModel');
    const defaultModel = modelList.find((m) => m.model.includes(useModel)) || modelList[0];
    if (!defaultModel || !defaultModel.model.length) return;
    const resolvedUseModel = defaultModel.model.includes(useModel) ? useModel : defaultModel.model[0];
    await setCurrentModel({
      ...defaultModel,
      useModel: resolvedUseModel,
    });
  };
  useEffect(() => {
    setDefaultModel().catch((error) => {
      console.error('Failed to set default model:', error);
    });
  }, [modelList]);

  // 打字机效果 / Typewriter effect
  useEffect(() => {
    const fullText = t('conversation.welcome.placeholder');
    let currentIndex = 0;
    const typingSpeed = 80; // 每个字符的打字速度（毫秒）/ Typing speed per character (ms)
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const typeNextChar = () => {
      if (currentIndex <= fullText.length) {
        // 在打字过程中添加光标 / Add cursor during typing
        setTypewriterPlaceholder(fullText.slice(0, currentIndex) + (currentIndex < fullText.length ? '|' : ''));
        currentIndex++;
      }
    };

    // 初始延迟，让用户看到页面加载完成 / Initial delay to let user see page loaded
    const initialDelay = setTimeout(() => {
      intervalId = setInterval(() => {
        typeNextChar();
        if (currentIndex > fullText.length) {
          if (intervalId) clearInterval(intervalId);
          setIsTyping(false); // 打字完成 / Typing complete
          setTypewriterPlaceholder(fullText); // 移除光标 / Remove cursor
        }
      }, typingSpeed);
    }, 300);

    // 清理函数：同时清理 timeout 和 interval / Cleanup: clear both timeout and interval
    return () => {
      clearTimeout(initialDelay);
      if (intervalId) clearInterval(intervalId);
    };
  }, [t]);
  return (
    <ConfigProvider getPopupContainer={() => guidContainerRef.current || document.body}>
      <div ref={guidContainerRef} className='h-full flex-center flex-col px-10px' style={{ position: 'relative' }}>
        <div className={styles.guidLayout}>
          <p className={`text-2xl font-semibold mb-8 text-0 text-center`}>{t('conversation.welcome.title')}</p>

          {/* Agent 选择器 - 在标题下方 */}
          {availableAgents && availableAgents.length > 0 && (
            <div className='w-full flex justify-center'>
              <div
                className='inline-flex items-center bg-fill-2'
                style={{
                  marginBottom: 16,
                  padding: '4px',
                  borderRadius: '30px',
                  transition: 'all 0.6s cubic-bezier(0.2, 0.8, 0.3, 1)',
                  width: 'fit-content',
                  gap: 0,
                }}
              >
                {availableAgents.map((agent, index) => {
                  const isSelected = selectedAgentKey === getAgentKey(agent);
                  const logoSrc = AGENT_LOGO_MAP[agent.backend];
                  const avatarValue = agent.backend === 'custom' ? agent.avatar || customAgentAvatarMap.get(agent.customAgentId || '') : undefined;
                  const avatar = avatarValue ? avatarValue.trim() : undefined;
                  const avatarImage = avatar ? CUSTOM_AVATAR_IMAGE_MAP[avatar] : undefined;

                  return (
                    <React.Fragment key={getAgentKey(agent)}>
                      {index > 0 && <div className='text-white/30 text-16px lh-1 p-2px select-none'>|</div>}
                      <div
                        className={`group flex items-center cursor-pointer whitespace-nowrap overflow-hidden ${isSelected ? 'opacity-100 px-12px py-8px rd-20px mx-2px' : 'opacity-60 p-4px hover:opacity-100'}`}
                        style={
                          isSelected
                            ? {
                                transition: 'opacity 0.5s cubic-bezier(0.2, 0.8, 0.3, 1)',
                                backgroundColor: 'var(--fill-0)',
                              }
                            : { transition: 'opacity 0.5s cubic-bezier(0.2, 0.8, 0.3, 1)' }
                        }
                        onClick={() => {
                          setSelectedAgentKey(getAgentKey(agent));
                          setMentionOpen(false);
                          setMentionQuery(null);
                          setMentionSelectorOpen(false);
                          setMentionActiveIndex(0);
                        }}
                      >
                        {avatarImage ? <img src={avatarImage} alt='' width={20} height={20} style={{ objectFit: 'contain', flexShrink: 0 }} /> : avatar ? <span style={{ fontSize: 16, lineHeight: '20px', flexShrink: 0 }}>{avatar}</span> : logoSrc ? <img src={logoSrc} alt={`${agent.backend} logo`} width={20} height={20} style={{ objectFit: 'contain', flexShrink: 0 }} /> : <Robot theme='outline' size={20} style={{ flexShrink: 0 }} />}
                        <span
                          className={`font-medium text-14px ${isSelected ? 'font-semibold' : 'max-w-0 opacity-0 overflow-hidden group-hover:max-w-100px group-hover:opacity-100 group-hover:ml-8px'}`}
                          style={{
                            color: 'var(--color-text-1)',
                            transition: isSelected ? 'color 0.5s cubic-bezier(0.2, 0.8, 0.3, 1), font-weight 0.5s cubic-bezier(0.2, 0.8, 0.3, 1)' : 'max-width 0.6s cubic-bezier(0.2, 0.8, 0.3, 1), opacity 0.5s cubic-bezier(0.2, 0.8, 0.3, 1) 0.05s, margin 0.6s cubic-bezier(0.2, 0.8, 0.3, 1)',
                          }}
                        >
                          {agent.name}
                        </span>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          <div
            className={`${styles.guidInputCard} relative p-16px border-3 b bg-dialog-fill-0 b-solid rd-20px flex flex-col ${mentionOpen ? 'overflow-visible' : 'overflow-hidden'} transition-all duration-200 ${isFileDragging ? 'border-dashed' : ''}`}
            style={{
              zIndex: 1,
              transition: 'box-shadow 0.25s ease, border-color 0.25s ease, border-width 0.25s ease',
              ...(isFileDragging
                ? {
                    backgroundColor: 'var(--color-primary-light-1)',
                    borderColor: 'rgb(var(--primary-3))',
                    borderWidth: '1px',
                    boxShadow: 'var(--shadow-sm)',
                  }
                : {
                    borderWidth: '1px',
                    borderColor: isInputActive ? activeBorderColor : inactiveBorderColor,
                    boxShadow: isInputActive ? activeShadow : 'var(--shadow-md)',
                  }),
            }}
            {...dragHandlers}
          >
            {mentionSelectorVisible && (
              <div className='flex items-center gap-8px mb-8px'>
                <Dropdown
                  trigger='click'
                  popupVisible={mentionSelectorOpen}
                  onVisibleChange={(visible) => {
                    setMentionSelectorOpen(visible);
                    if (visible) {
                      setMentionQuery(null);
                    }
                  }}
                  droplist={mentionMenu}
                >
                  <div className='flex items-center gap-6px bg-fill-2 px-10px py-4px rd-16px cursor-pointer select-none'>
                    <span className='text-14px font-medium text-t-primary'>@{selectedAgentLabel}</span>
                    <Down theme='outline' size={12} />
                  </div>
                </Dropdown>
              </div>
            )}
            <Input.TextArea
              rows={3}
              placeholder={typewriterPlaceholder || t('conversation.welcome.placeholder')}
              className={`text-16px focus:b-none rounded-xl !bg-transparent !b-none !resize-none !p-0 ${styles.lightPlaceholder}`}
              value={input}
              onChange={handleInputChange}
              onPaste={onPaste}
              onFocus={handleTextareaFocus}
              onBlur={handleTextareaBlur}
              {...compositionHandlers}
              onKeyDown={handleInputKeyDown}
              onClick={(e) => {
                const textarea = e.target as HTMLTextAreaElement;
                setCursorIndex(textarea.selectionStart ?? input.length);
              }}
              onKeyUp={(e) => {
                const textarea = e.target as HTMLTextAreaElement;
                setCursorIndex(textarea.selectionStart ?? input.length);
              }}
              onSelect={(e) => {
                const textarea = e.target as HTMLTextAreaElement;
                setCursorIndex(textarea.selectionStart ?? input.length);
              }}
            ></Input.TextArea>
            {isCommandMenuOpen && (
              <div className='mt-8px border border-border-2 bg-bg-1 rd-12px overflow-hidden shadow-sm'>
                <div className='max-h-220px overflow-y-auto'>
                  {filteredCommands.length === 0 ? (
                    <div className='px-12px py-10px text-12px text-t-secondary'>{t('common.commands_empty', { defaultValue: 'No commands available' })}</div>
                  ) : (
                    filteredCommands.map((command, index) => {
                      const isActive = index === activeCommandIndex;
                      return (
                        <div
                          key={command.id}
                          className={`px-12px py-8px cursor-pointer ${isActive ? 'bg-aou-2' : 'hover:bg-aou-1'}`}
                          onMouseEnter={() => setActiveCommandIndex(index)}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            applyCommandSelection(command.trigger);
                          }}
                        >
                          <div className='flex items-center justify-between gap-8px text-13px text-t-primary'>
                            <div className='truncate'>/{command.trigger}</div>
                            <div className='text-11px text-t-secondary uppercase'>{command.source}</div>
                          </div>
                          <div className='text-12px text-t-secondary mt-2px truncate'>{command.description || command.argumentHint || ''}</div>
                          {command.argumentHint && <div className='text-11px text-t-secondary mt-2px truncate'>{command.argumentHint}</div>}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
            {mentionOpen && (
              <div className='absolute z-50' style={{ left: 16, top: 44 }}>
                {mentionMenu}
              </div>
            )}
            {files.length > 0 && (
              // 展示待发送的文件并允许取消 / Show pending files and allow cancellation
              <div className='flex flex-wrap items-center gap-8px mt-12px mb-12px'>
                {files.map((path) => (
                  <FilePreview key={path} path={path} onRemove={() => handleRemoveFile(path)} />
                ))}
              </div>
            )}
            <div className={styles.actionRow}>
              <div className={`${styles.actionTools} flex items-center gap-10px`}>
                <Dropdown
                  trigger='hover'
                  onVisibleChange={setIsPlusDropdownOpen}
                  droplist={
                    <Menu
                      className='min-w-200px'
                      onClickMenuItem={(key) => {
                        if (key === 'file') {
                          ipcBridge.dialog.showOpen
                            .invoke({ properties: ['openFile', 'multiSelections'] })
                            .then((files) => {
                              if (files && files.length > 0) {
                                setFiles((prev) => [...prev, ...files]);
                              }
                            })
                            .catch((error) => {
                              console.error('Failed to open file dialog:', error);
                            });
                        } else if (key === 'workspace') {
                          ipcBridge.dialog.showOpen
                            .invoke({ properties: ['openDirectory'] })
                            .then((files) => {
                              if (files && files[0]) {
                                void ensureProjectForWorkspace(files[0])
                                  .then((project) => {
                                    setDir(project.workspace);
                                    lastProjectWorkspaceRef.current = project.workspace;
                                  })
                                  .catch((error) => {
                                    console.error('Failed to ensure project for workspace:', error);
                                  });
                              }
                            })
                            .catch((error) => {
                              console.error('Failed to open directory dialog:', error);
                            });
                        }
                      }}
                    >
                      <Menu.Item key='file'>
                        <div className='flex items-center gap-8px'>
                          <UploadOne theme='outline' size='16' fill={iconColors.secondary} style={{ lineHeight: 0 }} />
                          <span>{t('conversation.welcome.uploadFile')}</span>
                        </div>
                      </Menu.Item>
                      <Menu.Item key='workspace'>
                        <div className='flex items-center gap-8px'>
                          <FolderOpen theme='outline' size='16' fill={iconColors.secondary} style={{ lineHeight: 0 }} />
                          <span>{t('conversation.welcome.specifyWorkspace')}</span>
                        </div>
                      </Menu.Item>
                    </Menu>
                  }
                >
                  <span className='flex items-center gap-4px cursor-pointer lh-[1]'>
                    <Button type='secondary' shape='circle' className={isPlusDropdownOpen ? styles.plusButtonRotate : ''} icon={<Plus theme='outline' size='14' strokeWidth={2} fill={iconColors.primary} />}></Button>
                    {files.length > 0 && (
                      <Tooltip className={'!max-w-max'} content={<span className='whitespace-break-spaces'>{getCleanFileNames(files).join('\n')}</span>}>
                        <span className='text-t-primary'>File({files.length})</span>
                      </Tooltip>
                    )}
                  </span>
                </Dropdown>

                <Dropdown
                  trigger='hover'
                  droplist={
                    <Menu selectedKeys={currentModel ? [currentModel.id + currentModel.useModel] : []}>
                      {!modelList || modelList.length === 0
                        ? [
                            /* 暂无可用模型提示 */
                            <Menu.Item key='no-models' className='px-12px py-12px text-t-secondary text-14px text-center flex justify-center items-center' disabled>
                              {!hasCliProviderTarget ? t('settings.noAvailableModels') : isCliProviderLoading ? t('common.loading') : !isCliProviderConfigured ? t('settings.cliProviderNotConfigured') : !hasCliProviderEnabledModels ? t('settings.cliProviderNoEnabledModels') : t('settings.noAvailableModels')}
                            </Menu.Item>,
                            /* Add Model 选项 */
                            <Menu.Item key='add-model' className='text-12px text-t-secondary' onClick={() => navigate('/settings/model')}>
                              <Plus theme='outline' size='12' />
                              {t('settings.addProvider')}
                            </Menu.Item>,
                          ]
                        : [
                            ...(modelList || []).map((provider) => {
                              const availableModels = getAvailableModels(provider);
                              if (availableModels.length === 0) return null;
                              return (
                                <Menu.ItemGroup title={provider.name} key={provider.id}>
                                  {availableModels.map((modelName) => (
                                    <Menu.Item
                                      key={provider.id + modelName}
                                      className={currentModel?.id + currentModel?.useModel === provider.id + modelName ? '!bg-2' : ''}
                                      onClick={() => {
                                        setCurrentModel({ ...provider, useModel: modelName }, true).catch((error) => {
                                          console.error('Failed to set current model:', error);
                                        });
                                      }}
                                    >
                                      {provider.id?.startsWith('cli:') && modelName === 'default' ? t('common.default') : modelName}
                                    </Menu.Item>
                                  ))}
                                </Menu.ItemGroup>
                              );
                            }),
                            /* Add Model 选项 */
                            <Menu.Item key='add-model' className='text-12px text-t-secondary' onClick={() => navigate('/settings/model')}>
                              <Plus theme='outline' size='12' />
                              {t('settings.addProvider')}
                            </Menu.Item>,
                          ]}
                    </Menu>
                  }
                >
                  <Button className={'sendbox-model-btn'} shape='round'>
                    {currentModel ? (currentModel.id?.startsWith('cli:') && currentModel.useModel === 'default' ? t('common.default') : currentModel.useModel) : t('conversation.welcome.selectModel')}
                  </Button>
                </Dropdown>
                <div className='flex items-center gap-8px ml-8px'>
                  <Tooltip content={t('conversation.interactiveModeTooltip', { defaultValue: 'Interactive requirement discovery' })}>
                    <Button shape='round' type='secondary' aria-pressed={interactiveMode} onClick={toggleInteractiveMode} className={`${styles.collabToggleBtn} ${interactiveMode ? styles.collabToggleBtnActive : ''}`}>
                      {t('conversation.interactiveMode', { defaultValue: 'Interactive' })}
                    </Button>
                  </Tooltip>
                  <Tooltip content={localeKey.startsWith('zh') ? '协作模式 (PM/Analyst/Engineer)' : 'Collaboration mode (PM/Analyst/Engineer)'}>
                    <Button shape='round' type='secondary' aria-pressed={collabMode} onClick={toggleCollabMode} className={`${styles.collabToggleBtn} ${collabMode ? styles.collabToggleBtnActive : ''}`}>
                      {localeKey.startsWith('zh') ? '协作' : 'Collab'}
                    </Button>
                  </Tooltip>
                </div>
              </div>
              <div className={styles.actionSubmit}>
                <Button
                  shape='circle'
                  type='primary'
                  loading={loading}
                  disabled={!input.trim() || !currentModel}
                  icon={<ArrowUp theme='outline' size='14' fill='white' strokeWidth={2} />}
                  onClick={() => {
                    handleSend().catch((error) => {
                      console.error('Failed to send message:', error);
                    });
                  }}
                />
              </div>
            </div>
            {dir && (
              <div className='flex items-center justify-between gap-6px h-28px mt-12px px-12px text-13px text-t-secondary ' style={{ borderTop: '1px solid var(--border-base)' }}>
                <div className='flex items-center'>
                  <FolderOpen className='m-r-8px flex-shrink-0' theme='outline' size='16' fill={iconColors.secondary} style={{ lineHeight: 0 }} />
                  <Tooltip content={dir} position='top'>
                    <span className='truncate'>
                      {t('conversation.welcome.currentWorkspace')}: {dir}
                    </span>
                  </Tooltip>
                </div>
                <Tooltip content={t('conversation.welcome.clearWorkspace')} position='top'>
                  <IconClose className='hover:text-[rgb(var(--danger-6))] hover:bg-3 transition-colors' strokeWidth={3} style={{ fontSize: 16 }} onClick={() => setDir('')} />
                </Tooltip>
              </div>
            )}
          </div>
        </div>

        {/* 底部快捷按钮 */}
        <div className='absolute bottom-32px left-50% -translate-x-1/2 flex flex-col justify-center items-center'>
          {/* <div className='text-text-3 text-14px mt-24px mb-12px'>{t('conversation.welcome.quickActionsTitle')}</div> */}
          <div className='flex justify-center items-center gap-24px'>
            <div className='group flex items-center justify-center w-36px h-36px rd-50% bg-fill-0 cursor-pointer overflow-hidden whitespace-nowrap hover:w-200px hover:rd-28px hover:px-20px hover:justify-start hover:gap-10px transition-all duration-400 ease-[cubic-bezier(0.2,0.8,0.3,1)]' style={quickActionStyle(hoveredQuickAction === 'feedback')} onMouseEnter={() => setHoveredQuickAction('feedback')} onMouseLeave={() => setHoveredQuickAction(null)} onClick={() => openLink('https://github.com/zhu1090093659/CodeConductor')}>
              <svg className='flex-shrink-0 text-[var(--color-text-3)] group-hover:text-[#2C7FFF] transition-colors duration-300' width='20' height='20' viewBox='0 0 20 20' fill='none' xmlns='http://www.w3.org/2000/svg'>
                <path d='M6.58335 16.6674C8.17384 17.4832 10.0034 17.7042 11.7424 17.2905C13.4814 16.8768 15.0155 15.8555 16.0681 14.4108C17.1208 12.9661 17.6229 11.1929 17.4838 9.41082C17.3448 7.6287 16.5738 5.95483 15.3099 4.69085C14.0459 3.42687 12.372 2.6559 10.5899 2.51687C8.80776 2.37784 7.03458 2.8799 5.58987 3.93256C4.14516 4.98523 3.12393 6.51928 2.71021 8.25828C2.29648 9.99729 2.51747 11.8269 3.33335 13.4174L1.66669 18.334L6.58335 16.6674Z' stroke='currentColor' strokeWidth='1.66667' strokeLinecap='round' strokeLinejoin='round' />
              </svg>
              <span className='opacity-0 max-w-0 overflow-hidden text-14px text-[var(--color-text-2)] font-bold group-hover:opacity-100 group-hover:max-w-250px transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.3,1)]'>{t('conversation.welcome.quickActionFeedback')}</span>
            </div>
            <div className='group flex items-center justify-center w-36px h-36px rd-50% bg-fill-0 cursor-pointer overflow-hidden whitespace-nowrap hover:w-200px hover:rd-28px hover:px-20px hover:justify-start hover:gap-10px transition-all duration-400 ease-[cubic-bezier(0.2,0.8,0.3,1)]' style={quickActionStyle(hoveredQuickAction === 'repo')} onMouseEnter={() => setHoveredQuickAction('repo')} onMouseLeave={() => setHoveredQuickAction(null)} onClick={() => openLink('https://github.com/zhu1090093659/CodeConductor')}>
              <svg className='flex-shrink-0 text-[var(--color-text-3)] group-hover:text-[#FE9900] transition-colors duration-300' width='20' height='20' viewBox='0 0 20 20' fill='none' xmlns='http://www.w3.org/2000/svg'>
                <path
                  d='M9.60416 1.91176C9.64068 1.83798 9.6971 1.77587 9.76704 1.73245C9.83698 1.68903 9.91767 1.66602 9.99999 1.66602C10.0823 1.66602 10.163 1.68903 10.233 1.73245C10.3029 1.77587 10.3593 1.83798 10.3958 1.91176L12.3208 5.81093C12.4476 6.06757 12.6348 6.2896 12.8663 6.45797C13.0979 6.62634 13.3668 6.73602 13.65 6.77759L17.955 7.40759C18.0366 7.41941 18.1132 7.45382 18.1762 7.50693C18.2393 7.56003 18.2862 7.62972 18.3117 7.7081C18.3372 7.78648 18.3402 7.87043 18.3205 7.95046C18.3007 8.03048 18.259 8.10339 18.2 8.16093L15.0867 11.1926C14.8813 11.3927 14.7277 11.6397 14.639 11.9123C14.5503 12.1849 14.5292 12.475 14.5775 12.7576L15.3125 17.0409C15.3269 17.1225 15.3181 17.2064 15.2871 17.2832C15.2561 17.3599 15.2041 17.4264 15.1371 17.4751C15.0701 17.5237 14.9908 17.5526 14.9082 17.5583C14.8256 17.5641 14.7431 17.5465 14.67 17.5076L10.8217 15.4843C10.5681 15.3511 10.286 15.2816 9.99958 15.2816C9.71318 15.2816 9.43106 15.3511 9.17749 15.4843L5.32999 17.5076C5.25694 17.5463 5.17449 17.5637 5.09204 17.5578C5.00958 17.5519 4.93043 17.5231 4.86357 17.4744C4.79672 17.4258 4.74485 17.3594 4.71387 17.2828C4.68289 17.2061 4.67404 17.1223 4.68833 17.0409L5.42249 12.7584C5.47099 12.4757 5.44998 12.1854 5.36128 11.9126C5.27257 11.6398 5.11883 11.3927 4.91333 11.1926L1.79999 8.16176C1.74049 8.10429 1.69832 8.03126 1.6783 7.95099C1.65827 7.87072 1.66119 7.78644 1.68673 7.70775C1.71226 7.62906 1.75938 7.55913 1.82272 7.50591C1.88607 7.4527 1.96308 7.41834 2.04499 7.40676L6.34916 6.77759C6.63271 6.73634 6.90199 6.62681 7.13381 6.45842C7.36564 6.29002 7.55308 6.06782 7.67999 5.81093L9.60416 1.91176Z'
                  stroke='currentColor'
                  strokeWidth='1.66667'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              </svg>
              <span className='opacity-0 max-w-0 overflow-hidden text-14px text-[var(--color-text-2)] font-bold group-hover:opacity-100 group-hover:max-w-250px transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.3,1)]'>{t('conversation.welcome.quickActionStar')}</span>
            </div>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default Guid;
