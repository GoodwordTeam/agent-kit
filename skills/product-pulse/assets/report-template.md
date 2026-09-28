# <product name> Pulse — <window> — <YYYY-MM-DD HH:MM> <timezone>

<!-- Filling rules. Real numbers, not ranges or hedges; name the source inline when a number is
uncertain. Percent deltas compare with the prior equal-length window; with no comparison, omit the
delta. No thresholds and no "high" or "low" labels unless the configuration asked for them. No email,
account identifier or message content anywhere. Replace every angle-bracketed field; delete any line
whose data this run does not have. Thirty to forty lines in total. Delete this comment before
publishing. -->

## Headlines

- <the most notable thing in the window, in one line>
- <optional second headline>
- <optional third headline>

## Usage

- **Primary engagement:** <N events> (<delta vs prior window>)
- **Value realization:** <N events> (<delta>) — <ratio to engagement>
- **Completions / conversions:**
  - <event>: <N> (<delta>)
- **Strategy metrics:**
  - <metric>: <value> (<delta>) <"(default source)" when routed by default>
  - <metric>: no data (instrumentation pending)
- **Quality sample:** <distribution, such as "8x 5, 1x 4, 1x 2">

## System performance

- **Latency:** p50 <ms>, p95 <ms>, p99 <ms> (<delta vs prior window>)
- **Top errors** (by count, descending, up to the configured count):
  1. **<error signature>** — <N occurrences> — <one line of context, no personal data>

## Followups

- <one thing worth investigating next, specific enough to act on>
- <three to five in total; trim if thin>

---
_Source windows: analytics [<start> → <end>], tracing [<start> → <end>], payments [<start> → <end>].
Trailing buffer: 15m._

<!-- Variations. No tracing source: drop System performance; the pulse is Headlines, Usage and
Followups. Quality scoring off: drop the quality line. No strategy on record: replace the strategy
metrics lines with "No strategy on record." Single source: drop the other windows from the footer.

Before publishing, check: thirty to forty lines, give or take five; Headlines lead with the most
notable item; no threshold labels; no personal data in error signatures, followups or the quality
note; top errors at the configured count; every strategy metric rendered or marked no data;
every followup actionable as a sentence; the title time matches the run. -->
