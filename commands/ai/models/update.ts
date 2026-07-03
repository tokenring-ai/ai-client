import type { AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand } from "@tokenring-ai/agent/types";
import { doFetchWithRetry } from "@tokenring-ai/utility/http/doFetchWithRetry";
import { YAML } from "bun";

const inputSchema = {
  args: {
    y: {
      type: "flag",
      description: "Don't prompt for confirmation",
    },
  },
  remainder: {
    name: "url",
    description: "URL of the models.yaml to download",
    defaultValue: "https://dist.tokenring.ai/models.yaml",
  },
} as const satisfies AgentCommandInputSchema;

async function execute({ args, remainder: url, agent }: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  if (!args.y) {
    if (
      !(await agent.askForApproval({
        message: `Would you like to download the latest models from ${url}?`,
        label: "Update models?",
      }))
    ) {
      return "User declined to update models";
    }
  }

  const response = await doFetchWithRetry(url);
  const yamlText = await response.text();

  YAML.parse(yamlText);

  return "Model download successful";
}

export default {
  name: "ai models update",
  description: "Updates the models file with the latest models from the TokenRing AI server.",
  inputSchema,
  execute,
  help: `Updates the models file with the latest models from the TokenRing AI server..

## Example

/ai models update`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
