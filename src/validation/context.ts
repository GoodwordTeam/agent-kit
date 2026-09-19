import type { Catalog } from "../catalog/load.ts";

/** Everything a check needs: the tree under inspection and its declared truth. */
export interface CheckContext {
  /** Absolute path to the repository root under inspection. */
  root: string;
  catalog: Catalog;
}
