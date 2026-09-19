import { createHash } from "node:crypto";

/**
 * Canonical JSON form: keys sorted, no insignificant whitespace.
 * schemas/common.schema.json#/$defs/hash defines the digest over this form.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * The artifact digest an approval binds to: sha256 over the canonical JSON form
 * with the `approvals` member removed, so approving an artifact does not change
 * the hash that the approval names.
 */
export function artifactHash(artifact: unknown): string {
  const subject =
    artifact !== null && typeof artifact === "object" && !Array.isArray(artifact)
      ? Object.fromEntries(Object.entries(artifact as Record<string, unknown>).filter(([k]) => k !== "approvals"))
      : artifact;
  return `sha256:${sha256Hex(canonicalJson(subject))}`;
}
