// Run-time schema helpers for the GraphQL rows (D-TWISO-B31). Pure apart from the introspection fetch in the spec.
// A depth chain must use REAL object fields (the analyser skips every __ field: use-validate-graphql-query-
// complexity.hook.ts:181), and only single-object fields (not lists), or the response grows without bound.
// The chain is built from the authenticated /graphql schema at run time, never hard-coded. A REQUIRED argument
// is filled only with a placeholder literal of a scalar type, or with {} for an input object whose fields are
// all optional. Any other required argument makes the field unusable.

export interface RequiredArg {
  readonly name: string;
  /** A GraphQL literal, or undefined when no safe placeholder exists. */
  readonly placeholder: string | undefined;
}

export interface SchemaField {
  readonly name: string;
  /** True only when the field returns one object (not a list). */
  readonly singleObject: boolean;
  /** The named return type of an object field; undefined for scalars and enums. */
  readonly returns?: string | undefined;
  /** The arguments the field requires (non-null), with placeholders where possible. */
  readonly requiredArgs: readonly RequiredArg[];
}

export interface SchemaType {
  readonly name: string;
  readonly fields: readonly SchemaField[];
}

const usable = (f: SchemaField): boolean =>
  f.requiredArgs.every((a) => a.placeholder !== undefined);

const stepText = (f: SchemaField): string =>
  f.requiredArgs.length === 0
    ? f.name
    : `${f.name}(${f.requiredArgs.map((a) => `${a.name}: ${String(a.placeholder)}`).join(", ")})`;

/** Returns the steps of a chain of `depth` single-object fields that starts at a root field and reaches a
 *  cycle of such fields, repeating the cycle until the chain has `depth` steps. Undefined when no root field
 *  reaches a cycle. Pure; the cycle search is a depth-first walk over the single-object edges. */
export function buildDepthChain(
  types: readonly SchemaType[],
  rootTypeName: string,
  depth: number,
  preferRoot?: string,
): string[] | undefined {
  if (!Number.isInteger(depth) || depth < 1) {
    throw new RangeError(`TEST BUG: depth must be a positive integer, got ${String(depth)}`);
  }
  const byName = new Map(types.map((t) => [t.name, t]));
  const root = byName.get(rootTypeName);
  if (root === undefined) return undefined;
  const edgesOf = (typeName: string): SchemaField[] =>
    (byName.get(typeName)?.fields ?? []).filter(
      (f) =>
        f.singleObject &&
        usable(f) &&
        f.returns !== undefined &&
        byName.has(f.returns) &&
        !f.name.startsWith("__"),
    );

  // Depth-first search from a type for a cycle: returns the steps before the cycle and the cycle steps.
  const findCycle = (start: string): { prefix: string[]; cycle: string[] } | undefined => {
    const onPath = new Map<string, number>();
    const path: { type: string; step: string }[] = [];
    const explore = (type: string): { prefix: string[]; cycle: string[] } | undefined => {
      onPath.set(type, path.length);
      for (const field of edgesOf(type)) {
        const next = field.returns as string;
        if (onPath.has(next)) {
          const from = onPath.get(next) as number;
          return {
            prefix: path.slice(0, from).map((p) => p.step),
            cycle: [...path.slice(from).map((p) => p.step), stepText(field)],
          };
        }
        path.push({ type, step: stepText(field) });
        const found = explore(next);
        if (found !== undefined) return found;
        path.pop();
      }
      onPath.delete(type);
      return undefined;
    };
    return explore(start);
  };

  // Roots whose required arguments are all scalars are tried first: an input object placeholder ({}) can be
  // refused by a resolver that needs a filter key (live: "Missing filter argument").
  const scalarOnly = (f: SchemaField): boolean =>
    f.requiredArgs.every((a) => a.placeholder !== "{}");
  const orderedRoots = [...root.fields].sort(
    (a, b) =>
      Number(b.name === preferRoot) - Number(a.name === preferRoot) ||
      Number(scalarOnly(b)) - Number(scalarOnly(a)),
  );
  for (const rootField of orderedRoots) {
    if (!usable(rootField) || rootField.name.startsWith("__")) continue;
    const returnType = rootField.returns;
    if (returnType === undefined || !byName.has(returnType)) continue;
    const found = findCycle(returnType);
    if (found === undefined) continue;
    // Head: the root step and the prefix. Then the cycle repeats from its first step until the chain has `depth` steps.
    const head = [stepText(rootField), ...found.prefix];
    const chain: string[] = [];
    for (let i = 0; chain.length < depth; i++) {
      chain.push(
        i < head.length
          ? (head[i] as string)
          : (found.cycle[(i - head.length) % found.cycle.length] as string),
      );
    }
    return chain;
  }
  return undefined;
}

/** Builds `{ f1 { f2 { ... { __typename } } } }` for the steps (one selection set per step). */
export function chainDocument(steps: readonly string[]): string {
  if (steps.length === 0) throw new RangeError("TEST BUG: a chain needs at least one step");
  let inner = "__typename";
  for (let i = steps.length - 1; i >= 0; i--) inner = `${steps[i]} { ${inner} }`;
  return `{ ${inner} }`;
}

export interface IntrospectionTypeRef {
  readonly kind: string;
  readonly name?: string | null | undefined;
  readonly ofType?: IntrospectionTypeRef | null | undefined;
}

export interface IntrospectionInputValue {
  readonly name: string;
  readonly type: IntrospectionTypeRef;
}

export interface IntrospectionField {
  readonly name: string;
  readonly args: readonly IntrospectionInputValue[];
  readonly type: IntrospectionTypeRef;
}

export interface IntrospectionNamedType {
  readonly kind: string;
  readonly name: string;
  readonly fields?: readonly IntrospectionField[] | null;
  readonly inputFields?: readonly IntrospectionInputValue[] | null;
}

const PLACEHOLDER_BY_SCALAR: Readonly<Record<string, string>> = {
  UUID: '"00000000-0000-0000-0000-000000000000"',
  String: '"placeholder"',
  ID: '"placeholder"',
  Int: "0",
  Float: "0",
  Boolean: "false",
};

function unwrap(ref: IntrospectionTypeRef): {
  list: boolean;
  kind: string;
  name: string | null | undefined;
  nonNull: boolean;
} {
  const nonNull = ref.kind === "NON_NULL";
  let list = false;
  let cur: IntrospectionTypeRef | null | undefined = ref;
  while (cur && (cur.kind === "NON_NULL" || cur.kind === "LIST")) {
    if (cur.kind === "LIST") list = true;
    cur = cur.ofType;
  }
  return { list, kind: cur?.kind ?? "UNKNOWN", name: cur?.name, nonNull };
}

/** Pure: converts an introspection result into the SchemaType shape. A field is single-object only when no LIST
 *  wrapper is present and the innermost type is an OBJECT. A required argument gets a placeholder when it is a
 *  scalar in PLACEHOLDER_BY_SCALAR, or an input object with an `id` filter (`{ id: { eq: <uuid> } }`) when the caller
 *  supplies an id that exists in the stack (a record id from a run-time query). Other required arguments are
 *  unusable. An empty filter object is not used: the resolver refuses it ("Missing filter argument", live). */
export function schemaTypesFromIntrospection(
  types: readonly IntrospectionNamedType[],
  options: { readonly idFilterValue?: string | undefined } = {},
): SchemaType[] {
  const byName = new Map(types.map((t) => [t.name, t]));
  const idFilterFor = (inputName: string): string | undefined => {
    const value = options.idFilterValue;
    if (value === undefined || !/^[0-9a-f-]{36}$/i.test(value)) return undefined;
    const input = byName.get(inputName);
    const idField = (input?.inputFields ?? []).find((f) => f.name === "id");
    const idInner = idField === undefined ? undefined : unwrap(idField.type);
    if (
      idInner === undefined ||
      idInner.kind !== "INPUT_OBJECT" ||
      typeof idInner.name !== "string"
    )
      return undefined;
    const eq = (byName.get(idInner.name)?.inputFields ?? []).find((f) => f.name === "eq");
    if (eq === undefined || unwrap(eq.type).name !== "UUID") return undefined;
    return `{ id: { eq: "${value}" } }`;
  };
  const placeholderFor = (ref: IntrospectionTypeRef): string | undefined => {
    const inner = unwrap(ref);
    if (inner.list) return undefined;
    if (inner.kind === "SCALAR" && typeof inner.name === "string")
      return PLACEHOLDER_BY_SCALAR[inner.name];
    if (inner.kind === "INPUT_OBJECT" && typeof inner.name === "string")
      return idFilterFor(inner.name);
    return undefined;
  };
  return types
    .filter((t) => t.kind === "OBJECT" && !t.name.startsWith("__"))
    .map((t) => ({
      name: t.name,
      fields: (t.fields ?? []).map((f) => {
        const inner = unwrap(f.type);
        return {
          name: f.name,
          singleObject: !inner.list && inner.kind === "OBJECT",
          returns:
            inner.kind === "OBJECT" && typeof inner.name === "string" ? inner.name : undefined,
          requiredArgs: f.args
            .filter((a) => unwrap(a.type).nonNull)
            .map((a) => ({ name: a.name, placeholder: placeholderFor(a.type) })),
        };
      }),
    }));
}
