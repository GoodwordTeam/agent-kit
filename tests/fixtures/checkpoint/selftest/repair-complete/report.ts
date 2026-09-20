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
import { resolve } from "./scope.ts";

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

export function buildTenantSummary(tenantIds: string[]): Summary {
  const rows = tenantIds.map((tenantId) => {
    const scope = resolve(tenantId);
    return { tenantId, limit: scope.limit, used: consumed(tenantId) };
  });
  const widestLimit = rows.reduce((widest, row) => (row.limit > widest ? row.limit : widest), 0);
  return { rows, widestLimit };
}
