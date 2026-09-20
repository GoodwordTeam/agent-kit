/**
 * Usage accounting. This is the file the fixture ticket changes.
 *
 * `consumed` currently counts every unit recorded, across all tenants, because
 * the service began life single-tenant. AC-1 makes it count per tenant.
 */
import { resolve, type Scope } from "./scope.ts";

interface Entry {
  readonly tenantId: string;
  readonly units: number;
}

const entries: Entry[] = [];

export function record(tenantId: string, units: number): void {
  entries.push({ tenantId, units });
}

/** Units recorded for one tenant. */
export function consumed(tenantId: string): number {
  return entries.filter((entry) => entry.tenantId === tenantId).reduce((total, entry) => total + entry.units, 0);
}

export function remaining(tenantId: string): number {
  const scope: Scope = resolve(tenantId);
  return scope.limit - consumed(tenantId);
}

export function reset(): void {
  entries.length = 0;
}
