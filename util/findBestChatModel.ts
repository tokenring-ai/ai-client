/**
 * Gets the first chat client that matches the requirements and is online
 */
import AIChatClient, {ChatModelSpec} from "../client/AIChatClient.ts";
import type {ChatModelRequirements} from "../ModelRegistry.ts";
import type {ModelTypeRegistry} from "../ModelTypeRegistry.ts";

export default async function getFirstOnlineClientByRequirements(
  registry: ModelTypeRegistry<ChatModelSpec>,
  requirements: ChatModelRequirements,
) {
  const modelSpecs = getModelSpecsByRequirements(registry, requirements);

  // Find first hot model
  for (const modelSpec of modelSpecs) {
    const available = modelSpec.isAvailable
      ? await modelSpec.isAvailable()
      : true;
    if (available) {
      const isHot = modelSpec.isHot ? await modelSpec.isHot() : true;
      if (isHot) {
        return new registry.AIClient(modelSpec);
      }
    }
  }

// Fallback to a cold model
  for (const modelSpec of modelSpecs) {
    const available = modelSpec.isAvailable
      ? await modelSpec.isAvailable()
      : true;
    if (available) {
      return new registry.AIClient(modelSpec);
    }
  }

  throw new Error(`No online model found`);
};

/**
 * Finds the chatModels that match the requirements and sorts them by the expected price of the query
 */
function getModelSpecsByRequirements(registry: ModelTypeRegistry<ChatModelSpec>, requirements: ChatModelRequirements): ChatModelSpec[] {
  requirements = {...requirements};
  if (requirements.provider === "auto") delete requirements.provider;

  let estimatedContextLength = 10000;
  if (requirements.contextLength) {
    const [, value] =
    String(requirements.contextLength).match(/^[<>]?[=<>]?([^=<>].*)$/) ??
    [];

    estimatedContextLength = Math.max(
      estimatedContextLength,
      Number.parseInt(value),
    );
  }

  const eligibleModels = Object.entries(registry.modelSpecs.getAllItems()).filter(
    ([modelName, metadata]): boolean => {
      for (const [key, condition] of Object.entries(requirements)) {
        const [, operator, value] =
        String(condition).match(/^([<>]?[=<>]?)([^=<>].*)$/) ?? [];

        const field = metadata[key as keyof ChatModelSpec];
        if (typeof field === "number") {
          const numValue = Number(value);
          switch (operator) {
            case ">":
              if (!(field > numValue)) return false;
              break;
            case "<":
              if (!(field < numValue)) return false;
              break;
            case ">=":
              if (!(field >= numValue)) return false;
              break;
            case "<=":
              if (!(field <= numValue)) return false;
              break;
            case "":
            case "=":
              if (field !== numValue) return false;
              break;
            default:
              throw new Error(`Unknown operator '${operator}'`);
          }
        } else if (typeof field === "string") {
          switch (operator) {
            case "":
            case "=":
              if (key === "name") {
                if (modelName !== value) return false;
              } else {
                if (field !== value) return false;
              }
              break;
            default:
              throw new Error(`Operator '${operator}' not supported for strings`);
          }
        } else {
          throw new Error(`Unsupported field type for '${key}'`);
        }
      }
      return true;
    },
  );

  // Sort the matched chatModels by price, using the current context length + 1000 tokens to calculate the price
  return eligibleModels
    .map((el) => el[1])
    .sort((a, b) => {
      const aPrice =
        estimatedContextLength * (a.costPerMillionInputTokens ?? 600) +
        1000 * (a.costPerMillionOutputTokens ?? 600);
      const bPrice =
        estimatedContextLength * (b.costPerMillionInputTokens ?? 600) +
        1000 * (b.costPerMillionOutputTokens ?? 600);

      return aPrice - bPrice;
    });
}
