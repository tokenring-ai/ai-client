import { YAML } from "bun";
import { writeFileSync } from "node:fs";
import providers from "../providers/configs/index.ts";

const config = {
  ai: {
    providers,
  }
};

const modelsFile = process.argv[2];
if (! modelsFile) {
  console.error("Usage: node buildModelsFile.js <modelsFile>");
  process.exit(1);
}

writeFileSync(modelsFile, YAML.stringify(config, null, 2));