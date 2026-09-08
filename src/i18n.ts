import { messages, englishMessages } from "./translations";

export type Language = "en" | "es" | "va";
export type MessageKey = keyof typeof messages;
const LANGUAGE_KEY = "valencia-language";
let language: Language = "es";
try {
  const saved = localStorage.getItem(LANGUAGE_KEY);
  if (saved === "en" || saved === "es" || saved === "va") language = saved;
} catch { /* Language switching also works when browser storage is unavailable. */ }

export function getLanguage() { return language; }
export function setLanguage(value: Language) {
  language = value;
  document.documentElement.lang = value === "va" ? "ca-valencia" : value;
  try { localStorage.setItem(LANGUAGE_KEY, value); } catch { /* Keep the session choice. */ }
}
export function t(key: MessageKey, values: Record<string, string | number> = {}): string {
  const text = language === "en" ? englishMessages[key] ?? key : messages[key][language === "es" ? 0 : 1];
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`));
}
export function updateDocumentLanguage() {
  document.title = t("La Terreta | Explore Valencia on a small 3D planet");
  document.querySelector('meta[name="description"]')?.setAttribute("content", t("Explore Valencia on a small 3D planet. Walk, cycle, ride the tram, and row across Albufera. Discover landmarks, join the Fallas band, and enjoy local activities in a browser game built with Three.js, TypeScript, and original Blender assets."));
  for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) {
    document.querySelector(selector)?.setAttribute("content", document.title);
  }
  const description = document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
  for (const selector of ['meta[property="og:description"]', 'meta[name="twitter:description"]']) {
    document.querySelector(selector)?.setAttribute("content", description);
  }
  document.querySelector('meta[property="og:locale"]')?.setAttribute("content", { en: "en_US", es: "es_ES", va: "ca_ES" }[language]);
  document.querySelector("#world")?.setAttribute("aria-label", t("Interactive three-dimensional Valencia world"));
  const title = document.querySelector("#loading p");
  const note = document.querySelector("#loading > span");
  if (title) title.textContent = t("Preparing La Terreta…");
  if (note) note.textContent = t("People, streets, and a little music.");
}
if (typeof document !== "undefined") {
  setLanguage(language);
  updateDocumentLanguage();
}
