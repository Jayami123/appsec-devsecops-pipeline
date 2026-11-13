// Pure CSV formula-injection corpus (OWASP CSV injection). X closeout imports this module
// fork ref held by the owner). Data only: no I/O and never the run prefix.
export type CsvCellKind = "plain" | "formula" | "numeric-formula" | "space-formula";

export interface CsvCorpusEntry {
  readonly id: string;
  readonly cell: string;
  readonly kind: CsvCellKind;
}

const FORMULA_LEADS = new Set(["=", "+", "-", "@", "\t", "\r"]);

export const CSV_CORPUS: readonly CsvCorpusEntry[] = [
  { id: "plain-word", cell: "p5 plain cell", kind: "plain" },
  { id: "eq-sum", cell: "=SUM(1,1)", kind: "formula" },
  { id: "plus-cmd", cell: "+1+1", kind: "numeric-formula" },
  { id: "minus-num", cell: "-1+1", kind: "numeric-formula" },
  { id: "at-sum", cell: "@SUM(1,1)", kind: "formula" },
  { id: "tab-eq", cell: "\t=1+1", kind: "formula" },
  { id: "cr-eq", cell: "\r=1+1", kind: "formula" },
  { id: "space-eq", cell: " =1+1", kind: "space-formula" },
] as const;

/** True when the first character makes a spreadsheet treat the cell as a formula. */
export function isFormulaLike(cell: string): boolean {
  return cell.length > 0 && FORMULA_LEADS.has(cell[0] ?? "");
}
