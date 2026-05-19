export type ParsedCellType = "code" | "markdown";

export type AdmonitionKind =
  | "note"
  | "tip"
  | "warning"
  | "important"
  | "caution"
  | "seealso"
  | "attention"
  | "danger";

export type Admonition = {
  kind: AdmonitionKind;
  title?: string;
  body: string;
};

export type ParsedCell = {
  type: ParsedCellType;
  source: string;
  language?: string;
  admonitions: Admonition[];
};

export type ParsedNotebook = {
  source: "ipynb" | "myst";
  language: string;
  title?: string;
  cells: ParsedCell[];
};
