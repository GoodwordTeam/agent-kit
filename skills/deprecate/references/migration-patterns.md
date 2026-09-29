# Migration patterns

Loaded on demand by `deprecate` at workflow step 4. Each pattern keeps old and new valid at every
step, so any step can be rolled back without losing the ones before it.

## Strangler

Run old and new side by side and route traffic across in phases. Remove the old system only once it
handles none.

1. New handles 0%, old handles 100%.
2. New handles about 10%, as a canary.
3. New handles about 50%.
4. New handles 100%; old is idle.
5. Remove old — under the removal gate in `SKILL.md`.

The percentages are a starting shape, not a rule; the project sets its own steps.

## Adapter

An adapter satisfies the old interface and delegates to the new implementation. Consumers keep
calling the old interface while the backend moves, and then migrate at their own pace onto the new
one. The adapter is itself retired last.

## Feature flag

A flag chooses old or new per consumer, per tenant or per user, so consumers switch one at a time
and switch back on trouble. The flag and its old branch are removed together once no consumer is on
the old side.

## Expand and contract, for schema changes

A schema change is the riskiest migration, because data is the one thing a code revert does not
restore. The failure is coupling the schema change to the code change: rename a column in the same
release that starts using the new name, and during the rollout, while old and new code both run, one
of them queries a column that does not exist. So a column is never changed in place.

```
EXPAND                    MIGRATE                     CONTRACT
add the new column,  -->  backfill existing rows, -->  once no code reads the old
nullable, beside the      write both old and new       column, drop it in a later,
old one                   from the application         separate deploy
```

**Worked example: renaming `name` to `full_name`.**

1. **Expand.** Add `full_name` as nullable. Deploy. Old code ignores it; nothing breaks.
2. **Dual-write.** The application writes both `name` and `full_name` on every insert and update.
   Deploy.
3. **Backfill.** Copy `name` into `full_name` for existing rows, in batches, so the table is never
   locked.
4. **Switch reads.** Read `full_name`, keep writing both. Deploy and let it bake.
5. **Contract.** Stop writing `name`; then, in a separate later deploy, drop the column. The drop is
   `destructive-data` and waits for its charter entry.

Each step deploys on its own and reverses on its own: if step 4 misbehaves, roll the code back and
`full_name` is still being populated.

**Rules.**

- Additive first; destructive last and alone. Adds (a nullable column, a table, an index) are safe in
  any deploy. Drops and renames get their own deploy, after no code references the old shape.
- Every migration has a tested down path. Write and run the down before the migration merges.
- Backfill in throttled batches, off the hot path. One update over every row locks the table.
- Build large indexes without blocking writes, where the database supports it.
- Decouple a risky cutover with a feature flag, as above.

## Code nobody owns

Code nobody owns but everybody depends on shows these signs: no commits for a long stretch while
consumers are active, no maintainer, failing tests nobody fixes, dependencies with known
vulnerabilities nobody updates, documentation pointing at systems that are gone. It gets one of two
answers: assign an owner and maintain it, or retire it with a concrete plan through this skill. It
does not stay in between.

## Verification

After a retirement: the replacement covers every critical use case; the migration guide has
concrete steps; every active consumer is migrated, shown by the impact analysis; the old code, tests,
documentation, configuration and notices are gone; nothing references the retired surface.

After a schema migration: it shipped in additive phases; old and new code were both valid at every
deploy; each migration has a tested down path; backfills ran in throttled batches; destructive steps
shipped in their own deploy after no code referenced the old shape.
