import deepMerge from "@tokenring-ai/utility/object/deepMerge";
import anthropic from "./anthropic.yaml";
import cerebras from "./cerebras.yaml";
import deepseek from "./deepseek.yaml";
import elevenlabs from "./elevenlabs.yaml";
import fal from "./fal.yaml";
import google from "./google.yaml";
import groq from "./groq.yaml";
import minimax from "./minimax.yaml";
import openai from "./openai.yaml";
import perplexity from "./perplexity.yaml";
import xai from "./xai.yaml";

export default deepMerge(anthropic, cerebras, deepseek, elevenlabs, fal, google, groq, minimax, openai, perplexity, xai);