import {z} from "zod";
import {AIProviderConfigSchema} from "./providers.js";

export type {Tool, UserModelMessage} from "ai";
export {tool as chatTool, stepCountIs} from 'ai';

export const AIClientConfigSchema = z.object({
  providers: z.record(z.string(), AIProviderConfigSchema),
});

