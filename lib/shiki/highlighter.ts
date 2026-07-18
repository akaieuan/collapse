import { createHighlighter, type Highlighter } from "shiki";

let highlighterPromise: Promise<Highlighter> | null = null;

export const SUPPORTED_LANGS = [
  "ts",
  "tsx",
  "js",
  "jsx",
  "vue",
  "vue-html",
  "python",
  "bash",
  "json",
  "html",
  "css",
] as const;

export const THEMES = {
  light: "vitesse-light",
  dark: "vitesse-dark",
} as const;

export function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [THEMES.light, THEMES.dark],
      langs: [...SUPPORTED_LANGS],
    });
  }
  return highlighterPromise;
}
