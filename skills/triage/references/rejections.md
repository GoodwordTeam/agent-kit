# Rejections

Loaded on demand by `triage` at workflow steps 4 and 8. A record of rejected enhancement requests
serves two purposes: the reasoning survives the item being closed, and a new request matching an old
rejection surfaces the earlier decision instead of re-litigating it.

## Where a rejection lives

In the system of record, on the item itself. A rejected enhancement is closed with `updateStatus`
to the state the policy maps `wontfix` to, and its resolution text carries the rejection: the
concept rejected, stated so a later reader recognizes it, and the reason. One concept has one
record: the first item closed for it carries the reason, and every later item that matches is closed
with a `linkRecord` to that first one rather than a second copy of the reason. No rejection record
is written into the working repository or published as a knowledgebase document.

## Writing the reason

The reason is substantive and durable: not "we don't want this" but why. A good reason names the
project's scope ("this project focuses on X; theming is a downstream concern"), a technical
constraint ("supporting this needs Y, which conflicts with Z"), or a strategic choice ("we chose A
over B because…"). A temporary circumstance ("too busy right now") is a deferral, not a rejection:
leave the item open in its state rather than recording it.

## Checking for a prior rejection

At step 4, read the closed-as-rejected items in the system of record and compare the new request by
**concept**, not by keyword: "night theme" matches a rejected "dark mode". Where the system of
record cannot return a closed item's resolution text, say so as a coverage limitation; do not report
"no prior rejection" from a check that could not see the reasons.

On a match, surface it: "This resembles <the earlier item>, rejected because <reason>. Do you still
feel the same way?" The maintainer may:

- **Confirm** — close the new item linked to the earlier one.
- **Reconsider** — the new item proceeds through normal triage. The earlier item stays closed as a
  historical record.
- **Disagree** — the two are related but distinct; proceed with normal triage.

## When to record one

Only when an **enhancement** is rejected as `wontfix`, pull requests included, so the same request
does not return as fresh code. Never when an item is closed because the behavior is **already
implemented**: that is a built feature, and recording it as a rejection poisons every later check.
The closing text points to where the feature lives instead. A rejected **bug** is explained and
closed without a rejection record.
