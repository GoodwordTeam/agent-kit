/**
 * Tenant usage reporting.
 *
 * This file is a *caller* of quota, not a dependency of it. The fixture ticket
 * does not name it and `allowed_changes` does not permit changing it, which is
 * what makes it the affected untouched surface (release scenario 8). A scout
 * following the ticket's scope reads quota.ts and what quota.ts imports; it
 * does not walk upward to who imports quota.ts, so this file is not handed to
 * the builder.
 */
import { consumed } from "./quota.ts";
import { resolveCached, lastScope } from "./scope.ts";

export interface Row {
  readonly tenantId: string;
  readonly limit: number;
  readonly used: number;
}

export interface Summary {
  readonly rows: Row[];
  /** The largest limit among the tenants in this request. */
  readonly widestLimit: number;
}

// Callers asked for the rows in a stable order so the dashboard stops
// reshuffling between refreshes. Sorting happens at the call site for now.
export function buildTenantSummary(tenantIds: string[]): Summary {
  const rows = tenantIds.map((tenantId) => {
    const scope = resolveCached(tenantId);
    return { tenantId, limit: scope.limit, used: consumed(tenantId) };
  });
  const widest = lastScope();
  return { rows, widestLimit: widest === null ? 0 : widest.limit };
}
