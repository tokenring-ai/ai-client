import deepClone from "@tokenring-ai/utility/object/deepClone";
import type { AIProviderConfig } from "../../providers.ts";
import anthropic from "./anthropic.yaml";
import cerebras from "./cerebras.yaml";
import chutes from "./chutes.yaml";
import deepseek from "./deepseek.yaml";
import elevenlabs from "./elevenlabs.yaml";
import fal from "./fal.yaml";
import google from "./google.yaml";
import groq from "./groq.yaml";
import meta from "./meta.yaml";
import mimo from "./mimo.yaml";
import minimax from "./minimax.yaml";
import nvidia from "./nvidia.yaml";
import openai from "./openai.yaml";
import openrouter from "./openrouter.yaml";
import perplexity from "./perplexity.yaml";
import qwen from "./qwen.yaml";
import xai from "./xai.yaml";
import zai from "./zai.yaml";

export default deepClone(
  anthropic, cerebras, chutes, deepseek, elevenlabs, fal, google, groq, meta, mimo,
  minimax, nvidia, openai, openrouter, perplexity, qwen, xai, zai
) as Record<string, AIProviderConfig>;