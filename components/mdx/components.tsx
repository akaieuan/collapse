import type { MDXComponents } from "mdx/types";
import { Concept, Note, Detail, CrossRef } from "./concept";
import { LangTab } from "./lang-tabs";
import { MdxPre } from "./code-pre";

export const mdxComponents: MDXComponents = {
  Concept,
  Note,
  Detail,
  CrossRef,
  LangTab,
  pre: MdxPre as MDXComponents["pre"],
};
