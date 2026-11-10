// Pure GraphQL document builders for the tw-iso GraphQL rows (tw-iso.md 8.5-8.10). No I/O, no secrets.
// Field paths that need a real schema are taken as arguments; the only root field used by the
// builders below is the introspection field __type, which exists on every schema.

const FIELD_NAME = /^[_A-Za-z][_0-9A-Za-z]*$/;

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`TEST BUG: ${label} must be a positive integer, got ${String(value)}`);
  }
  return value;
}

/** One root field with no nesting: the control query. */
export function shallowQuery(): string {
  return "{ __typename }";
}

/**
 * A single chain of `depth` nested selection sets (GQL-001). The chain walks the introspection
 * type graph with `ofType`, which returns one object per level, so the response stays linear.
 */
export function nestedQuery(depth: number): string {
  positiveInteger(depth, "depth");
  let inner = "__typename";
  // Wrap from the innermost level outwards, so the outermost selection is __type on the root Query.
  for (let level = depth; level >= 1; level--) {
    const field = level === 1 ? '__type(name: "Query")' : "ofType";
    inner = `${field} { ${inner} }`;
  }
  return `{ ${inner} }`;
}

/** `count` aliases of __typename in one document (GQL-003). */
export function aliasQuery(count: number): string {
  positiveInteger(count, "count");
  const parts: string[] = [];
  for (let i = 1; i <= count; i++) parts.push(`a${i}: __typename`);
  return `{ ${parts.join(" ")} }`;
}

/**
 * Exactly `count` requested fields (GQL-002): one root field plus `count - 1` aliased scalar fields.
 * Real fields only: the live probe (D-TWISO-B15) showed that __typename aliases are not counted by the
 * field cap (2001 of them returned 200 with no errors), so they cannot test it. The cap refuses real fields.
 */
export function overFieldsQuery(count: number): string {
  if (!Number.isInteger(count) || count < 2) {
    throw new RangeError(`TEST BUG: count must be an integer of at least 2, got ${String(count)}`);
  }
  const parts: string[] = [];
  for (let i = 1; i < count; i++) parts.push(`f${i}: email`);
  return `{ r: currentUser { ${parts.join(" ")} } }`;
}

/** The schema name query (GQL-005). */
export function introspectionQuery(): string {
  return "{ __schema { queryType { name } } }";
}

/** A query for one field name. The name is validated, so it cannot inject syntax. */
export function fieldQuery(name: string): string {
  if (!FIELD_NAME.test(name)) {
    throw new RangeError(`TEST BUG: field name must match ${String(FIELD_NAME)}`);
  }
  return `{ ${name} }`;
}
