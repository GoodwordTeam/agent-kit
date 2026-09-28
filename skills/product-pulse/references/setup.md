# First-run setup

Read on a first run, or when the human asks to set up or reconfigure the pulse. The keys and their
defaults are in the run guide.

## Seed from the strategy

Before asking anything, read the product's strategy page through `readContext`. If one exists, take:

- The product's name, from the page title with its trailing " Strategy" removed.
- The key metrics, one per line, from the Key metrics section, or on a page in another shape the
  section that lists the success measures by meaning. When none carries them, say that no metrics are
  on record.

Open by showing what was read: the page, the seeded name, and the metrics that will be carried into
source setup. Invite correction before continuing. With no strategy page, say so in one line, run
setup from scratch, and mention that the strategy skill can seed the pulse later.

## Interview

One question at a time, using the host's blocking-question tool where one is listed and numbered
options in chat otherwise. In order:

1. Product name: confirm or correct the seeded value.
2. Primary engagement event: the one action that means someone used the product.
3. Value-realization event: the action that means they got what they came for.
4. Completions or conversions: zero to three.
5. Quality scoring: opt-in, and only for a product that generates answers.
6. Data sources: which of the host's data connections serves each event and each strategy metric,
   and which metrics are pending or excluded. A database is optional.
7. System performance: propose a default for top errors and latency and accept it unless the human
   objects.
8. Default lookback window.

Hold every event and metric to a plain bar: specific, measurable, actionable, relevant, and timely.
Push back once on anything vague, anything that only ever goes up, or anything no one would act on.

**Read-write database access is refused.** If the human offers a read-write credential, say that the
pulse only reads, and offer a read-only connection, a read replica, or no database at all. Many
products complete the pulse from analytics and tracing alone.

## Publish the configuration

Show the resulting configuration in chat and offer one edit round. Then publish it as the product's
pulse configuration page and read it back. It carries no credential: a source is named by the host
connection that serves it, never by a secret.

## Scheduling

After the configuration is published, suggest once that the human keep a recurring reminder to run
`/ak:product-pulse`. A schedule may only remind the human; it never starts a run. This skill creates
no reminder and no schedule: the human sets one up where they keep their own, or declines. Later
runs mention it again only as the workflow says.
