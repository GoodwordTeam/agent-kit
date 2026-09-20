/**
 * Tenant scope resolution.
 *
 * `resolve` is pure and correct. The cache below it is the part that matters:
 * it is keyed by nothing, because when it was written there was only ever one
 * tenant in flight at a time. That assumption is not stated anywhere it would
 * be read, which is the point.
 */
export interface Scope {
  readonly tenantId: string;
  readonly limit: number;
}

const LIMITS: Record<string, number> = { acme: 100, globex: 250, initech: 50 };

export function resolve(tenantId: string): Scope {
  const limit = LIMITS[tenantId];
  if (limit === undefined) throw new Error(`unknown tenant: ${tenantId}`);
  return { tenantId, limit };
}

let lastResolved: Scope | null = null;

/** Resolve, remembering the result for callers that ask for it again. */
export function resolveCached(tenantId: string): Scope {
  if (lastResolved !== null) return lastResolved;
  lastResolved = resolve(tenantId);
  return lastResolved;
}

/** The most recently resolved scope, or null before anything has resolved. */
export function lastScope(): Scope | null {
  return lastResolved;
}

/** Clear the remembered scope. Tests only; nothing in the service calls it. */
export function resetScope(): void {
  lastResolved = null;
}
