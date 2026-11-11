// Decides the state of a known product defect from two live refusal checks (D-TWISO-B35). Pure.
// The anonymous request is the control: the same document, through the complexity hook path, is refused by the
// cap. If the authenticated request is also refused, the defect is absent ("fixed"): a declared expected failure
// must then show as an unexpected pass. If the anonymous control is refused and the authenticated request is not,
// the defect is confirmed. Otherwise there is no evidence either way ("unconfirmed"): nothing is declared.
export type DefectState = "fixed" | "confirmed" | "unconfirmed";

export function productDefectState(refusals: {
  readonly authenticatedRefused: boolean;
  readonly anonymousRefused: boolean;
}): DefectState {
  if (refusals.authenticatedRefused) return "fixed";
  if (refusals.anonymousRefused) return "confirmed";
  return "unconfirmed";
}
