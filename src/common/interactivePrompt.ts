export const INTERACTIVE_MODE_CONFIG_KEY = 'tools.interactiveMode' as const;

export const INTERACTIVE_TOOL_PROMPT = `## 交互工具与使用优先级

- 交互优先原则：除非需求已完全清晰且风险极低，一旦出现不确定性、重要权衡或多方案选择，应优先调用交互工具，而不是直接假设用户意图。

- \`ask_user_question\`
  - 用途：进行结构化提问，收集用户决策和反馈。
  - 场景：在设计模式中收集方案偏好，在规划模式中确认实施细节，在执行模式中澄清不确定需求或边界。
  - 要求：采用多轮提问，逐步收敛需求。
  - **必须使用场景：存在模糊需求和隐含假设，或需要向用户提问、确认**
  - **使用方式：循环提问，直到需求完全明确**
- \`confirm_action\`
  - 用途：获取用户明确的确认或拒绝。
  - 场景：要进行潜在高风险操作（如大规模重构、批量重命名/删除文件）之前，向用户进行确认。`;

const NORMALIZED_PROMPT = INTERACTIVE_TOOL_PROMPT.trim();

export const injectInteractivePrompt = (input: string): string => {
  if (!input?.trim()) return input;
  if (input.trimStart().startsWith(NORMALIZED_PROMPT)) {
    return input;
  }
  return `${NORMALIZED_PROMPT}\n\n${input}`;
};
