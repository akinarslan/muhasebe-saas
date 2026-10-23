import { createHash } from "node:crypto";

// Business identity is separate from a transport retry UUID. Equal legacy-shaped
// requests need a distinct explicit reference to represent two genuine sales.
export function saleSource<
  T extends {
    idempotencyKey: string;
    sourceRef?: string;
  },
>(input: T) {
  if (input.sourceRef) return `ref:${input.sourceRef}`;
  const { idempotencyKey: _key, ...business } = input;
  void _key;
  const canonical = (v: unknown): string => {
    if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
    if (v && typeof v === "object")
      return `{${Object.entries(v)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`)
        .join(",")}}`;
    return JSON.stringify(v);
  };
  return `payload:${createHash("sha256").update(canonical(business)).digest("hex")}`;
}
