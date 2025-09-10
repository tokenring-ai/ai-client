import Agent from "@tokenring-ai/agent/Agent";
import AIService from "../AIService.js";
import ModelRegistry from "../ModelRegistry.ts";

interface TreeNode {
  name: string;
  value?: string;
  children?: TreeNode[];
  hasChildren?: boolean;
}

export const description: string =
  "/model [model_name] - Set or show the target model for chat";

export async function execute(remainder: string, agent: Agent): Promise<void> {
  const modelRegistry = agent.requireFirstServiceByType(ModelRegistry);
  const aiService = agent.requireFirstServiceByType(AIService);

  const aiConfig = aiService.getAIConfig(agent);

  // Handle direct model name input, e.g. /model gpt-4
  const directModelName = remainder?.trim();
  if (directModelName) {
    aiService.setModel(directModelName, agent);
    agent.infoLine(`Model set to ${directModelName}`);
    return;
  }

  // If no remainder provided, show interactive tree selection grouped by provider
  const modelsByProvider = await agent.busyWhile("Checking online status of models...", modelRegistry.chat.getModelsByProvider());

  // Build tree structure for model selection
  const buildModelTree = (): TreeNode => {
    const tree: TreeNode = {
      name: "Model Selection",
      children: [],
    };
    const sortedProviders = Object.keys(modelsByProvider).sort((a, b) =>
      a.localeCompare(b),
    );

    for (const provider of sortedProviders) {
      const providerModels = modelsByProvider[provider];

      // Sort models by status (online first) then by name
      const sortedModels = providerModels.sort((a, b) => {
        if (a.status === b.status) {
          return a.name.localeCompare(b.name);
        } else {
          return a.status.localeCompare(b.status);
        }
      });

      const children = sortedModels.map((model) => ({
        value: model.name,
        name:
          model.status === "online"
            ? `✅ ${model.name}`
            : model.status === "cold"
              ? `🧊 ${model.name} (cold)`
              : `🔴 ${model.name} (offline)`,
      }));

      // Count online models for provider display
      const onlineCount = providerModels.filter(
        (m) => m.status === "online",
      ).length;
      const coldCount = providerModels.filter(
        (m) => m.status === "cold",
      ).length;
      const totalCount = providerModels.length;
      const statusIcon = onlineCount > 0 ? "✅" : coldCount > 0 ? "🧊" : "🔴";

      tree.children?.push({
        name: `${statusIcon} ${provider} (${onlineCount}/${totalCount} online)`,
        hasChildren: true,
        children,
      });
    }

    return tree;
  };

  // Interactive tree selection if no model name is provided in the command
  try {
    const selectedModel = await agent.askHuman({
      type: "askForSingleTreeSelection",
      message: `Current model: ${aiConfig.model}. Choose a new model:`,
      tree: buildModelTree()
    });

    if (selectedModel) {
      aiService.setModel(selectedModel, agent);
      agent.infoLine(`Model set to ${selectedModel}`);
    } else {
      agent.infoLine("Model selection cancelled. No changes made.");
    }
  } catch (error) {
    agent.errorLine(`Error during model selection:`, error as Error);
  }
}

// noinspection JSUnusedGlobalSymbols
export function help(): string[] {
  return [
    "/model [model_name]",
    "  - With no arguments: Shows interactive tree selection for models grouped by provider",
    "  - With model_name: Sets the target model for chat",
    "  - Special values: auto|auto:reasoning|auto:frontier to auto-select model",
  ];
}