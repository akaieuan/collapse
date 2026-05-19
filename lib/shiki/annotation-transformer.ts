import type { ShikiTransformer } from "shiki";
import { buildLineMap, extractAttr, parseAnnotMeta } from "./parse-meta";

type State = {
  lineMap: Map<number, string>;
  title?: string;
  lang?: string;
};

const STATE = Symbol("moth-annot-state");

type Carrier = { [STATE]?: State };

export type AnnotationTransformerOptions = {
  kindMap?: Map<string, string>;
};

export function annotationTransformer(options: AnnotationTransformerOptions = {}): ShikiTransformer {
  const kindMap = options.kindMap;
  return {
    name: "moth:annotations",
    preprocess(_code, opts) {
      const meta = (opts.meta as { __raw?: string } | undefined)?.__raw ?? "";
      const lineMap = buildLineMap(parseAnnotMeta(meta));
      const title = extractAttr(meta, "title");
      const lang = opts.lang;
      (this as unknown as Carrier)[STATE] = { lineMap, title, lang };
    },
    line(node, line) {
      const state = (this as unknown as Carrier)[STATE];
      const id = state?.lineMap.get(line);
      if (!id) return;
      const kind = kindMap?.get(id) ?? "note";
      const wrapper = {
        type: "element" as const,
        tagName: "span",
        properties: {
          class: "annot",
          "data-annot-id": id,
          "data-annot-kind": kind,
          tabindex: "0",
          role: "button",
          "aria-label": `Annotation ${id}`,
        },
        children: node.children,
      };
      node.children = [wrapper];
    },
    pre(node) {
      const state = (this as unknown as Carrier)[STATE];
      const props = (node.properties ?? {}) as Record<string, string | number | boolean>;
      if (state?.title) props["data-title"] = state.title;
      if (state?.lang) props["data-lang"] = state.lang;
      node.properties = props;
    },
  };
}
