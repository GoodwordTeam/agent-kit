---
name: beta
description: Reviews a large diff when a human asks for it.
---

# Beta

Review, then report.

## When to use

When a human asks for the beta workflow on a ticket that already exists.

## Not for

Not for a request that names no ticket. Not for a second run against a ticket that already carries
a receipt. Not for a request to edit a file.

## Authority

Authority: `explicit`. A human starts it.

## Inputs

The ticket the request names. Absent: stop and report `needs-input`.

## Workflow

1. Read the named ticket and record its id.
2. Produce the receipt and return it.

## Hard gates

Gate: no ticket, no run.

| The thought | Why it is wrong | Do this instead |
|---|---|---|
| "The ticket is obviously the one just discussed." | A ticket named in conversation is not a ticket that exists. | Stop and report `needs-input`. |

## Outputs

One receipt, published through the knowledgebase adapter.

## Side effects

`artifact-write`.

## Stop conditions

Stop when the workflow has produced its receipt.

## Limits

Runs per ticket: 1 (gate).
