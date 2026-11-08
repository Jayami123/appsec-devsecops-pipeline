export type Verb = "GET" | "PUT" | "POST" | "PATCH" | "DELETE";
export type Expected = "allow" | "deny-401" | "deny-403" | "deny-404" | "deny-4xx";

export interface MatrixRow {
  readonly actor: string;
  readonly resource: string;
  readonly verb: Verb;
  readonly expected: Expected;
  readonly caseId: string;
}

export class MatrixCoverageError extends Error {
  constructor(cell: string) {
    super(`MATRIX_UNCOVERED: ${cell}`);
    this.name = "MatrixCoverageError";
  }
}

/**
 * Every actor x resource x verb must have a row, in actor, resource, verb order; the first missing
 * cell is named. Each actor and resource also needs at least one control row with expected "allow".
 */
export function assertCovered(
  rows: readonly MatrixRow[],
  actors: readonly string[],
  resources: readonly string[],
  verbs: readonly Verb[],
): void {
  for (const actor of actors) {
    for (const resource of resources) {
      const hasControl = rows.some(
        (row) => row.actor === actor && row.resource === resource && row.expected === "allow",
      );
      if (!hasControl) throw new MatrixCoverageError(`${actor} control ${resource}`);
      for (const verb of verbs) {
        const covered = rows.some(
          (row) => row.actor === actor && row.resource === resource && row.verb === verb,
        );
        if (!covered) throw new MatrixCoverageError(`${actor} ${verb} ${resource}`);
      }
    }
  }
}

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** CSV with the header actor,resource,verb,expected,caseId. Fields containing commas are quoted. */
export function toCsv(rows: readonly MatrixRow[]): string {
  const header = "actor,resource,verb,expected,caseId";
  const lines = rows.map((row) =>
    [row.actor, row.resource, row.verb, row.expected, row.caseId].map(csvField).join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}
