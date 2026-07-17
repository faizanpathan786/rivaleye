import type { ZodTypeAny } from "zod";

export type MockRng = () => number;

export interface MockContext {
  userPrompt: string;
}

const FALLBACK_SENTENCES = [
  "The onboarding flow was surprisingly smooth and the team picked it up in a day",
  "Support has been unresponsive for weeks and the pricing tripled without warning",
  "I wish it had a proper offline mode because our field team keeps losing work",
  "We moved to an alternative because the sync kept breaking on large workspaces",
  "The reporting dashboard is the single best thing about this product",
];

const CONTENT_KEY_RE =
  /(quote|text|body|title|summary|headline|evidence|phrase|thesis|insight|message|reason|explanation|rationale|recommendation|complaint|claim|reality|need|pain|why|note|copy|angle|feature|risk|action|step|detail)/i;
const URL_KEY_RE = /url/i;
const ID_KEY_RE = /(^id$|_id$|_ids$|^ids$|(^|_)id(s)?_)/i;

function pickSentences(userPrompt: string): string[] {
  const parts = userPrompt
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^[\s\-•*#>[\]{}",:]+|[\s"',]+$/g, "").trim())
    .filter((s) => s.length >= 15 && s.length <= 240 && /[a-zA-Z]{3}/.test(s));
  return parts.length > 0 ? parts : FALLBACK_SENTENCES;
}

function pick<T>(rng: MockRng, arr: readonly T[]): T {
  const item = arr[Math.floor(rng() * arr.length)];
  return item as T;
}

function seededSlug(rng: MockRng, prefix: string): string {
  const n = Math.floor(rng() * 0xffffffff)
    .toString(16)
    .padStart(8, "0");
  return `${prefix}-${n}`;
}

function seededUuid(rng: MockRng): string {
  const hex = (count: number): string =>
    Array.from({ length: count }, () => Math.floor(rng() * 16).toString(16)).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}

interface StringChecks {
  min?: number;
  max?: number;
  uuid?: boolean;
  url?: boolean;
  email?: boolean;
  datetime?: boolean;
}

function readStringChecks(checks: Array<Record<string, unknown>>): StringChecks {
  const out: StringChecks = {};
  for (const c of checks) {
    switch (c.kind) {
      case "min":
        out.min = c.value as number;
        break;
      case "max":
        out.max = c.value as number;
        break;
      case "uuid":
        out.uuid = true;
        break;
      case "url":
        out.url = true;
        break;
      case "email":
        out.email = true;
        break;
      case "datetime":
        out.datetime = true;
        break;
    }
  }
  return out;
}

function mockString(
  rng: MockRng,
  context: MockContext,
  keyHint: string,
  checks: StringChecks,
): string {
  let value: string;
  if (checks.uuid) return seededUuid(rng);
  if (checks.datetime) {
    const daysAgo = Math.floor(rng() * 60);
    return new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  }
  if (checks.email) return `${seededSlug(rng, "user")}@example.com`;
  if (checks.url || URL_KEY_RE.test(keyHint)) {
    value = `https://example.com/${seededSlug(rng, keyHint.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "page")}`;
  } else if (ID_KEY_RE.test(keyHint)) {
    value = seededSlug(rng, "mock");
  } else if (CONTENT_KEY_RE.test(keyHint)) {
    value = pick(rng, pickSentences(context.userPrompt));
  } else {
    value = `mock ${keyHint || "value"} ${Math.floor(rng() * 1000)}`;
  }
  if (checks.min !== undefined) {
    while (value.length < checks.min) value = `${value} ${value}`;
  }
  if (checks.max !== undefined && value.length > checks.max) {
    value = value.slice(0, checks.max).trimEnd();
    if (checks.min !== undefined && value.length < checks.min) {
      value = value.padEnd(checks.min, "x");
    }
  }
  return value;
}

function mockNumber(rng: MockRng, checks: Array<Record<string, unknown>>): number {
  let min: number | undefined;
  let max: number | undefined;
  let isInt = false;
  for (const c of checks) {
    if (c.kind === "min") min = c.value as number;
    if (c.kind === "max") max = c.value as number;
    if (c.kind === "int") isInt = true;
  }
  const lo = min ?? 0;
  const hi = max ?? lo + 100;
  let value = lo + rng() * (hi - lo);
  if (isInt) {
    value = Math.floor(value);
    if (value < lo) value = Math.ceil(lo);
    if (value > hi) value = Math.floor(hi);
  } else {
    value = Math.round(value * 100) / 100;
    if (value < lo) value = lo;
    if (value > hi) value = hi;
  }
  return value;
}

function singularize(key: string): string {
  if (key.endsWith("ies")) return `${key.slice(0, -3)}y`;
  if (key.endsWith("s") && !key.endsWith("ss")) return key.slice(0, -1);
  return key;
}

export function generateMock(
  schema: ZodTypeAny,
  rng: MockRng,
  context: MockContext,
  keyHint = "",
): unknown {
  const def = schema._def as Record<string, unknown> & { typeName: string };
  switch (def.typeName) {
    case "ZodObject": {
      const shape = (def.shape as () => Record<string, ZodTypeAny>)();
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(shape)) {
        const value = generateMock(child, rng, context, key);
        if (value !== undefined) out[key] = value;
      }
      return out;
    }
    case "ZodArray": {
      const element = def.type as ZodTypeAny;
      const min = (def.minLength as { value: number } | null)?.value ?? 0;
      const max = (def.maxLength as { value: number } | null)?.value;
      const exact = (def.exactLength as { value: number } | null)?.value;
      let count = exact ?? 2 + Math.floor(rng() * 3);
      if (count < min) count = min;
      if (max !== undefined && count > max) count = max;
      return Array.from({ length: count }, () =>
        generateMock(element, rng, context, singularize(keyHint)),
      );
    }
    case "ZodString":
      return mockString(
        rng,
        context,
        keyHint,
        readStringChecks(def.checks as Array<Record<string, unknown>>),
      );
    case "ZodNumber":
      return mockNumber(rng, def.checks as Array<Record<string, unknown>>);
    case "ZodBoolean":
      return rng() < 0.5;
    case "ZodEnum":
      return pick(rng, def.values as readonly string[]);
    case "ZodNativeEnum": {
      const values = Object.values(def.values as Record<string, string | number>).filter(
        (v) => typeof v !== "number" || !((def.values as Record<string, unknown>)[v] !== undefined),
      );
      return pick(rng, values.length > 0 ? values : Object.values(def.values as object));
    }
    case "ZodLiteral":
      return def.value;
    case "ZodUnion":
      return generateMock(pick(rng, def.options as readonly ZodTypeAny[]), rng, context, keyHint);
    case "ZodDiscriminatedUnion":
      return generateMock(
        pick(rng, [...(def.options as ZodTypeAny[] | Map<string, ZodTypeAny>).values?.() ?? (def.options as ZodTypeAny[])]),
        rng,
        context,
        keyHint,
      );
    case "ZodNullable":
      return rng() < 0.9 ? generateMock(def.innerType as ZodTypeAny, rng, context, keyHint) : null;
    case "ZodOptional":
      return rng() < 0.9
        ? generateMock(def.innerType as ZodTypeAny, rng, context, keyHint)
        : undefined;
    case "ZodDefault":
      return generateMock(def.innerType as ZodTypeAny, rng, context, keyHint);
    case "ZodCatch":
      return generateMock(def.innerType as ZodTypeAny, rng, context, keyHint);
    case "ZodEffects":
      return generateMock(def.schema as ZodTypeAny, rng, context, keyHint);
    case "ZodRecord": {
      const valueType = def.valueType as ZodTypeAny;
      const out: Record<string, unknown> = {};
      for (let i = 0; i < 2; i++) {
        out[seededSlug(rng, keyHint || "key")] = generateMock(valueType, rng, context, keyHint);
      }
      return out;
    }
    case "ZodTuple":
      return (def.items as readonly ZodTypeAny[]).map((item) =>
        generateMock(item, rng, context, keyHint),
      );
    case "ZodAny":
    case "ZodUnknown":
      return { mock: true, note: `generated for ${keyHint || "unknown field"}` };
    default:
      throw new Error(
        `zod-mock: unsupported Zod type "${def.typeName}"${keyHint ? ` at key "${keyHint}"` : ""}`,
      );
  }
}
