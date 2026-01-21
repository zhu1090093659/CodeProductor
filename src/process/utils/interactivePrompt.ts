import { injectInteractivePrompt, INTERACTIVE_MODE_CONFIG_KEY } from '@/common/interactivePrompt';
import { ProcessConfig } from '../initStorage';

export const applyInteractivePromptIfEnabled = async (input: string): Promise<string> => {
  if (!input?.trim()) return input;
  try {
    const enabled = await ProcessConfig.get(INTERACTIVE_MODE_CONFIG_KEY);
    if (enabled !== true) {
      return input;
    }
    return injectInteractivePrompt(input);
  } catch {
    return input;
  }
};
