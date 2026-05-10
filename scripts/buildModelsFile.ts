import deepMerge from "@tokenring-ai/utility/object/deepMerge";
import { YAML } from "bun";
import { writeFileSync } from "node:fs";
import anthropic from "../models/anthropic.yaml";
import cerebras from "../models/cerebras.yaml";
import deepseek from "../models/deepseek.yaml";
import elevenlabs from "../models/elevenlabs.yaml";
import fal from "../models/fal.yaml";
import google from "../models/google.yaml";
import groq from "../models/groq.yaml";
import minimax from "../models/minimax.yaml";
import openai from "../models/openai.yaml";
import perplexity from "../models/perplexity.yaml";
import xai from "../models/xai.yaml";

const models = deepMerge(anthropic, cerebras, deepseek, elevenlabs, fal, google, groq, minimax, openai, perplexity, xai);

const modelsFile = process.argv[2];
if (! modelsFile) {
  console.error("Usage: node buildModelsFile.js <modelsFile>");
  process.exit(1);
}

writeFileSync(modelsFile, YAML.stringify(models, null, 2));