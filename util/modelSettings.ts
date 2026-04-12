import type {ChatModelSettings} from "@tokenring-ai/ai-client/ModelTypeRegistry";

export function parseModelAndSettings(model: string): {
  base: string;
  settings: ChatModelSettings;
} {
  const qIndex = model.indexOf("?");
  const base = qIndex >= 0 ? model.substring(0, qIndex) : model;
  const settings: ChatModelSettings = new Map();
  if (qIndex >= 0) {
    for (const part of model.substring(qIndex + 1).split("&")) {
      if (!part) continue;
      const [rawK, rawV] = part.split("=");
      settings.set(
        decodeURIComponent(rawK),
        coerceFeatureValue(rawV === undefined ? "1" : decodeURIComponent(rawV)),
      );
    }
  }
  return {base, settings};
}

export function coerceFeatureValue(v: string): any {
  const lower = v.toLowerCase?.();
  if (v === "1" || lower === "true") return true;
  if (v === "0" || lower === "false") return false;
  const asNum = Number(v);
  if (
    !Number.isNaN(asNum) &&
    String(asNum) === v.replace(/(?<=\d)\.0+$/, (m) => m)
  )
    return asNum;
  return v;
}

export function serializeModel(
  base: string,
  settings: ChatModelSettings,
): string {
  const entries = Array.from(settings.entries()).filter(
    ([, v]) => v !== undefined,
  );
  if (entries.length === 0) return base;
  const query = entries
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(typeof v === "boolean" ? (v ? "1" : "0") : String(v))}`,
    )
    .join("&");
  return `${base}?${query}`;
}
