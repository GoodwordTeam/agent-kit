# Idempotent state-changing endpoints

The detail behind `pack-api`'s constraints `idempotency-key-from-intent` and
`idempotency-outcomes-handled`. A reviewer checks a handler against each section below and cites the
section in the finding.

## Derive the key from the intent, not the attempt

The key is the same across every retry of one intent and different across distinct intents.

```typescript
crypto.randomUUID()                    // wrong: a new key per attempt, so every retry is a new charge
`${userId}:${amount}`                  // wrong: two legitimate charges of the same amount collapse into one
`${orderId}:${Date.now()}`             // wrong: a timestamp is a random key by another name

req.headers['idempotency-key']         // right: the client generates it once and reuses it on retry
`charge:v1:${orderId}`                 // right: derived from an immutable identifier
```

The key comes from the client or the initiating event, never from the layer doing the retrying.

## Claim atomically

A check followed by an act is a race. Two concurrent retries both read "not seen" and both act.

```typescript
// wrong: time-of-check to time-of-use
if (!(await db.exists(key))) {
  await chargeCard(amount);
  await db.insert(key);
}

// right: the unique constraint picks the winner
try {
  await db.insert({ key, state: 'in_progress', requestHash });
} catch (e) {
  if (isUniqueViolation(e)) return replayOrReject(key);
  throw;
}
const result = await chargeCard(amount);
await db.update({ key, state: 'succeeded', response: result });
```

The unique constraint is the mechanism. A store that cannot enforce uniqueness in one operation
cannot back this.

## Guard the payload

The same key with a different body is a client bug. It fails loudly rather than serving the first
response to a second request.

```typescript
if (existing.requestHash !== hash(req.body)) {
  return res.status(422).json({ error: 'idempotency key reused with a different payload' });
}
```

## Decide what an in-flight duplicate gets

The first request is still running when the second arrives. Under retry storms this is the common
case, not the rare one.

| Strategy | Response | Use when |
|---|---|---|
| Reject | `409 Conflict` | The client can retry later. Simplest and safest |
| Wait | Block for the result, bounded | The caller needs the result synchronously |
| Return pending | `202` and a status URL | The effect is long-running |

Never let the second caller through because the first seems stuck. A stalled attempt whose fate is
unknown is exactly when a duplicate costs most.

## Three outcomes, not two

Every outbound call ends in success, failure or unknown. A timeout says nothing about whether the
effect applied. Record the intent before calling out, so a crash between the call and its response
leaves evidence that something must resolve later rather than a silently retried charge.

## Retention outlives the longest retry path

Set key retention from the longest path that can re-deliver the same intent, not from storage cost.
That includes a dead-letter queue replayed later and any provider dispute window. A retention
shorter than the replay window is a duplicate waiting to happen. The actual periods are project
facts, read from the knowledgebase and never assumed here.
