/**
 * `ak firstmate status`: one run outcome to one Firstmate status line, per
 * adapters/firstmate/CONTRACT.md §4. It prints the line and writes nothing; the
 * worker appends it to its own status file the way every Firstmate worker does.
 */

export type Outcome = "complete" | "needs-input" | "cap-reached" | "failed" | "cancelled";
export const OUTCOMES: readonly Outcome[] = ["complete", "needs-input", "cap-reached", "failed", "cancelled"];

export interface StatusArgs {
  outcome: Outcome;
  at: number;
  pr?: string;
  evidence?: string[];
  reason?: string;
  run?: string;
  openFindings?: string[];
  by?: string;
  /** A child whose outcome the worker cannot state. Wins over every other row. */
  unknownChild?: string;
}

export interface StatusResult {
  ok: boolean;
  line: string;
  error?: string;
}

const bad = (error: string): StatusResult => ({ ok: false, line: "", error });

export function statusLine(binding: { delivery: { action: "publish" | "dry-run" } }, a: StatusArgs): StatusResult {
  const at = `[at=${a.at}]`;
  // A worker that cannot say what one of its children did has not finished,
  // whatever else it has to report.
  if (a.unknownChild !== undefined) return { ok: true, line: `blocked ${at}: child ${a.unknownChild} state unknown` };

  const evidence = (a.evidence ?? []).filter((e) => e !== "");
  switch (a.outcome) {
    case "complete":
      if (evidence.length === 0) return bad("done needs evidence refs: the receipts and the review the ship rested on");
      if (binding.delivery.action === "dry-run") {
        return {
          ok: true,
          line: `done ${at}: dry-run ship prepared, nothing published evidence=${evidence.join(",")}`,
        };
      }
      if (a.pr === undefined || a.pr === "") return bad("done on a publish needs the PR url");
      return { ok: true, line: `done ${at}: PR ${a.pr} checks green evidence=${evidence.join(",")}` };
    case "needs-input":
      if (a.reason === undefined || a.reason === "") return bad("needs-input needs the decision, named");
      return { ok: true, line: `needs-decision ${at}: ${a.reason}` };
    case "cap-reached": {
      if (a.run === undefined || a.run === "") return bad("cap-reached needs the run id for its key");
      const open = (a.openFindings ?? []).join(",");
      return {
        ok: true,
        line: `needs-decision ${at} [key=fix-cap-${a.run}]: fix-cycle cap reached; blocked or replan; open findings=${open === "" ? "none" : open}`,
      };
    }
    case "failed":
      if (a.reason === undefined || a.reason === "") return bad("failed needs a reason");
      return { ok: true, line: `failed ${at}: ${a.reason}` };
    case "cancelled":
      if (a.by === undefined || a.by === "") return bad("cancelled needs who cancelled it");
      return { ok: true, line: `failed ${at}: cancelled: ${a.by}` };
    default: {
      const unhandled: never = a.outcome;
      throw new Error(`statusLine: unknown outcome ${JSON.stringify(unhandled)}`);
    }
  }
}
