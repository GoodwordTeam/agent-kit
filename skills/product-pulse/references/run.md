# Running the pulse

Read before dispatching any query, and whenever a configuration value has to be interpreted.

## Configuration keys

The pulse configuration page carries these keys. An unset or invalid value takes the default below;
it is never guessed.

- `product_name`: the name used in report titles. Required: unset means the pulse is not set up.
- `lookback_default`: one of `1h`, `24h`, `7d`, `30d`. Default `24h`.
- `primary_event`: the engagement event.
- `value_event`: the value-realization event.
- `completion_events`: zero to three conversion events.
- `quality_scoring`: `true` or `false`, default `false`. For products that generate answers only.
- `quality_dimension`: what a sampled session is scored on, 1 to 5, when scoring is on.
- `analytics_source`, `tracing_source`, `payments_source`: which of the host's data connections
  serves each; payments is omitted when unused.
- `db_enabled`: `true` or `false`, default `false`. When `true`, read-only database queries are part
  of the pulse.
- `metric_sources`: per strategy metric, the source that serves it. A metric not listed falls back to
  the analytics source and is rendered with `(default source)`.
- `pending_metrics`: strategy metrics awaiting instrumentation, rendered `no data (instrumentation
  pending)`.
- `excluded_metrics`: strategy metrics left out of the pulse on purpose. They stay in the strategy.
- `error_count`: how many top errors to list. Default five.

## Dispatch

In parallel, since they share no load:

- Analytics: primary engagement, value realization, completions and their ratios over the window
  and the prior window.
- Tracing: error counts by category, the latency distribution, and the top error signatures.
- Payments, if configured: new customers, churn and the revenue delta.

Then serially, only when `db_enabled` is `true`: read-only database queries, one at a time, tight
and scoped. Never a full scan of a large table. A query that would be expensive is skipped and noted
as "DB query skipped (estimated cost too high)".

Every call uses the tool's read-only mode. A tool that offers a write mode does not get it used.

## Optional quality sample

When `quality_scoring` is on, sample up to ten sessions from the window and score each 1 to 5 on the
configured dimension. Default to 4 or 5 when a session looks normal; reserve 1 to 3 for a clear
failure (a wrong answer, a stuck user, a surfaced error). If everything scores 3 the bar is too strict;
if everything scores 5 it is too loose.

Record only a count distribution, such as "8x 5, 1x 4, 1x 2", and a short anonymized note on anything
below 4. No message content and no user identifier.

## Strategy metrics

Read the strategy page's Key metrics section, or on a page in another shape the section that lists the
success measures by meaning. Resolve each metric as the workflow says: excluded, pending, sourced, or
`no data`. With no strategy page, say in the report that no strategy is on record and carry no
metrics forward.

## Assemble and publish

Fill the report template: Headlines, Usage, System performance, Followups, then the footer. Thirty to
forty lines; if a section is thin, leave it thin, and if the report runs long, cut. Run the
template's checklist, then publish the report as a new revision of the product's pulse page.

## Why this shape

One page with four sections makes the reader notice what matters; a dashboard with forty metrics
spreads attention thin. The pulse page's revision history is the team's working memory: every past
pulse is there to compare, and none of them is a data warehouse.
