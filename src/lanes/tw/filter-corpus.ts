// Filter injection corpus for P5-TW-INJ-001 (data only). Each value is sent as a filter or search
// term; the oracle is no 500 and no SQL text in the response.

/** Basis: a long value near common request-body and query limits. Not a budget. */
export const LONG_STRING_LENGTH = 4096;

export const FILTER_CORPUS: readonly string[] = [
  // quotes
  "'",
  '"',
  "`",
  "a'b\"c`d",
  // comment tokens
  "x--",
  "x/*",
  "*/x",
  // boolean tautologies
  "' OR '1'='1",
  '" OR "1"="1',
  "1 OR 1=1",
  // unicode: fullwidth apostrophe and quotation mark, right-to-left mark
  "＇ OR ＇1＇=＇1",
  "＂",
  "a‮b",
  // operator injection in filter JSON style keys
  '{"$where": "1==1"}',
  '{"$ne": null}',
  // very long string
  "A".repeat(LONG_STRING_LENGTH),
];
