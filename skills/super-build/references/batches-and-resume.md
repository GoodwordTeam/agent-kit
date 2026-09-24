# Ticket batches and resuming a run

Read this when more than one ticket is ready at once, or when a ledger from an earlier run exists.

## Deciding what runs in parallel

A missing dependency edge records only that no dependency was declared; it says nothing about shared
write surface. A shared generated artifact (a snapshot, a lockfile, a generated client), a shared
migration sequence, or one exported interface makes two edgeless tickets contending writers, and the
DAG cannot see it.

For each pair of tickets with no edge between them:

1. Read the declared `write_ownership`, generated artifacts, migration sequence and exported
   interfaces.
2. Where a declaration is silent, read the files themselves.
3. Serialize exactly the pairs whose contention survives that inspection. Dispatch every other
   ticket in the layer together; one contending pair does not serialize the layer.
4. Do not serialize on a general caution about concurrency or on unknown contention you did not find.

Report which surfaces you inspected to reach each verdict. Dispatch in bounded batches; a unit too
small to outweigh its own dispatch runs inline or batched with related units, and the runner's ticket
budget is the only start cap enforced.

## Resuming after an interruption

Establish where the run stopped from the record, not from recollection: recorded base commits,
commits on ticket branches, published receipts and written rulings in the ledger.

- A ticket with a commit and receipts bound to that commit is done. Dispatch no implementer for it
  and do not re-run its receipts merely to confirm them.
- A ticket mid-loop resumes at the round the ledger shows. Rounds already spent still count against
  the cap of five; the interruption does not reset the loop. A resume at round four or five
  dispatches a fresh implementer, as the round schedule requires.
- Worktrees, branches and rulings left by a `failed` or `cancelled` run are read and reused, not
  cleaned up and re-derived.
