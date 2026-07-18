# ADR-0002: Stateless, Synchronous Service

## Status

Accepted.

## Context

Content generation could be modeled as an async job (submit request, poll/callback for result) or
as a direct synchronous call. Async models add real infrastructure — queues, job stores, status
endpoints, retry/backoff policies — that only pays for itself once request volume, generation
latency, or fan-out actually demands it. No current consumer requirement demands it.

## Decision

Version 1 is stateless and synchronous:

- A call to the service accepts one `ContentRequest` and returns one `ContentResponse` (or error)
  in the same call — no job IDs, no polling, no webhooks.
- The service holds no state between requests: no request history, no cache, no session.
- Idempotency is a property of the pipeline design (same validated input passed to the same
  provider call shape), not of any stored state.

## Consequences

- Callers must be able to tolerate whatever latency a single synchronous model call takes; the
  service does not offer a way to offload that wait.
- Horizontal scaling is trivial (any instance can serve any request — no shared state, no sticky
  sessions).
- There is no built-in request log, audit trail, or replay capability. If a caller needs that,
  it is the caller's responsibility to store the request/response pair on their own side.
- If future latency or throughput requirements demand async processing, that is an additive
  capability layered in front of (or alongside) this synchronous core — not a replacement of it
  (see [future-vision.md](../future-vision.md)).

## Alternatives considered

- **Async job queue with polling** — rejected for V1: no current requirement justifies the
  operational complexity of a queue, worker, and job-status store.
