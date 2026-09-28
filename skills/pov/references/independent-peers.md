# Independent peers

Loaded by `pov` at Workflow step 8, and only when the human has affirmatively asked for
independent opinions. The body carries the rule: peers inform the position
and never vote on it. This file carries how a consultation runs.

A peer is an independent reviewer context: a context that shares no reasoning state with the one
that formed this skill's position. Who fills that seat is the runner's decision. This file names
no participant and selects none.

## What counts as a request

- An explicit ask to consult other reviewers, gather independent opinions, or cross-check the take
  starts a consultation.
- Wording that declines one ("just your view, no cross-check") starts nothing. So does wording that
  only recounts an earlier cross-check.
- With no request, offer a consultation once, after the position is formed, and only at tier 2 or
  3 where later work will build on the take before an error could surface. Never offer at tier 1.
- Announce which peers will be consulted before any of them receives the subject.

## The independent round

1. The position is already frozen. A peer in the independent round never sees it.
2. Each peer receives the framed question, the full subject, the read scope and the source-located
   evidence. Interpretations, risk rankings and recommended consequences are withheld until
   reconciliation.
3. The payload says that rejecting every option, or the framing itself, is a valid position.
4. Every peer receives the identical payload. A peer that cannot accept it is unavailable; the
   payload is never trimmed for one peer.
5. Peers read only. They inspect the project and change nothing.

## Reconciliation

Only independent-round voices enter reconciliation. Material dissent is a different grade, a
different selected approach, or a different bottom line on a document. Different wording or
emphasis for the same decision is agreement.

For each exchange, at most two after the independent round unless the human set another limit:

1. Reconsider every current position and its evidence, this skill's included.
2. Verify only the disputed project claims that could change the decision. Mark each `verified`,
   `contradicted` or `unverifiable`, with its source location.
3. Send every surviving peer the same evidence delta and every surviving position.
4. Record each peer's answer as `moved` or `held`, with what changed or why the evidence was not
   enough.

Stop at the first of these:

- `confident`: this skill holds a reasoned position after weighing every surviving voice.
- `no-movement`: every surviving peer held and this skill is still not confident.
- `limit-reached`: the round limit is spent and this skill is still not confident.

Agreement raises confidence without removing blind spots the peers may share. A split is never
settled by counting.

## Disclosure

Lead with the point of view, then a short panel note:

- Each peer, its position, and whether it moved.
- Every peer that failed or dropped out, with the failure observed. Never an invented cause, and
  never a position attributed to a peer that did not run.
- For each peer, an independence attestation: `true` where the runner attests that the context
  shares no reasoning state with this one, `false` where it does, `unverified` where nothing
  attests either way. An unverified peer is still disclosed, labelled as such.
- On a stalemate: this skill's position, each surviving position, and whether the split is an
  evidence gap or a judgment difference. Recommend where there is a real basis; otherwise say
  "Either is viable" and give the trade-offs.
- With no surviving peer: the solo point of view and one line saying the independent check was
  unavailable or incomplete.

A failed peer never blocks the point of view. It is disclosed, not hidden.

## Skeptic mode

When the ask is to challenge this skill's position rather than form an independent one, the peer
receives the position, because critiquing it is the task. Its critique is weighed once, stays out
of reconciliation, and the note says whether it changed the point of view.
