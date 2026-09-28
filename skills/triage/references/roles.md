# Triage roles

Loaded on demand by `triage` at workflow step 2. These are the canonical role names. What each one
becomes in the system of record is the project's triage policy's to say, never this file's.

## The roles

Two **category** roles:

- `bug` — something is broken.
- `enhancement` — a new feature or an improvement.

Five **state** roles:

- `needs-triage` — the maintainer needs to evaluate it.
- `needs-info` — waiting on the reporter for more information.
- `ready-for-agent` — fully specified, ready for an agent to build.
- `ready-for-human` — ready, but needs a human to implement.
- `wontfix` — will not be actioned.

Every triaged item carries exactly one category and one state. Where an item carries two conflicting
states, flag it and ask the maintainer before doing anything else.

There is no priority role, no severity role and no owner role. Triage classifies and moves state; it
does not rank or assign.

## Transitions

An untriaged item normally goes to `needs-triage` first. From there it moves to `needs-info`,
`ready-for-agent`, `ready-for-human` or `wontfix`. `needs-info` returns to `needs-triage` once the
reporter replies. The maintainer can override at any time; flag a transition that looks unusual and
ask before applying it.

## A pull request is an item with attached code

Where the project treats external pull requests as a request surface, the same roles, states and
transitions apply, with two readings changed: `ready-for-agent` means a brief is attached and an
agent should take the next step on the diff; `ready-for-human` means it is ready for a human to
merge. Discovery lists only external pull requests; a collaborator's in-flight one is not triage
work unless the maintainer names it.

## The policy mapping

The project record's `tracker_policy.policy` names the policy. For each role it states what the
tracker operations write in the system of record: typically a ticket status for `updateStatus`, with
the text this skill writes carried as the resolution. The tracker contract has six operations and no
label or comment operation, so a role the policy maps onto something none of the six can write is a
role this skill cannot apply. Stop with `needs-input` and name the role; do not reach the backend any
other way and do not substitute a nearby state.

With no policy at all, stop with `needs-input` and ask for one to be configured. Canonical names are
not a fallback mapping.
