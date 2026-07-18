# ADR-0013: The Content Service as an Execution Component Within a Larger Optimization Loop

## Status

Accepted.

## Context

The Content Service exists to move measurable business outcomes (see
[docs/principles.md](../principles.md)), which raises an obvious question: if outcomes matter,
shouldn't the service eventually measure them and adjust? The instinctive next step —
letting this service track performance, run experiments, or learn from what it generated before —
would fundamentally change what kind of system it is: from a stateless, synchronous execution
service into a stateful, learning, analytics-owning one. That contradicts
[ADR-0002](0002-stateless-synchronous-service.md) and several principles in
[docs/principles.md](../principles.md) at once, and is exactly the kind of scope creep
[docs/future-vision.md](../future-vision.md) exists to name and defer rather than accidentally
absorb.

At the same time, the business need behind that instinct is real: AstrologyManifest's funnel
(SEO → engagement → RPM → email capture → affiliate conversion) benefits from content generation
that's informed by how previous content actually performed. That need doesn't disappear — it
just belongs to a different system.

## Decision

The Content Service is explicitly positioned as **one execution component within a larger
optimization loop**, most of which is out of scope for this repository, now and later:

```
Analytics/Intelligence Service (future, separate system)
  → measures performance, decides what to optimize next
Website Builder (or another orchestrator)
  → translates strategy + optimization signals into a ContentRequest
Content Service (this repository)
  → executes: generates content optimized toward supplied objective(s)/business model,
    informed by whatever signals it's given
Website Builder
  → publishes (never this service)
Live site
  → generates new performance data, closing the loop back to Analytics/Intelligence Service
```

Concretely, this service:

- **Never measures performance.** No analytics collection, tracking, or metric computation.
- **Never decides what to optimize next.** No experimentation orchestration, no automatic
  strategy adjustment based on past results.
- **Never retains cross-request memory**, including memory that might otherwise be framed as
  "learning to write better" — see [ADR-0002](0002-stateless-synchronous-service.md).
- **May, in a future version, accept read-only "optimization signals"** as additional, optional,
  explicitly-supplied request context (see [docs/future-vision.md](../future-vision.md),
  "Optimization Signals") — the same way `businessModel` and `primaryObjective` are supplied
  today. This is not built in V1.

## Consequences

- Any future proposal to add analytics, experimentation, or "smart" adaptation to this service
  should be redirected to: *design a separate Analytics/Intelligence Service that supplies its
  output to this service as request context*, not extended into this service directly.
- The reserved extension points from [ADR-0010](0010-reserved-extension-points.md) — particularly
  additional optional inputs to `generation/` and the open `metadata` object — are the intended
  landing points for future optimization signals, once an Analytics/Intelligence Service exists
  to produce them.
- This ADR does not commit anyone to building an Analytics/Intelligence Service. It only ensures
  that if one is built, this service's boundaries don't have to be renegotiated to receive its
  output.
- Documentation and code review for this repository should treat "should the Content Service
  track/measure/decide X" as a boundary violation by default, not a feature request to scope —
  see [docs/boundaries.md](../boundaries.md), "Execution only."

## Alternatives considered

- **Let the Content Service own lightweight analytics itself ("just enough" tracking)** —
  rejected: there's no such thing as "just enough" analytics ownership once a service starts
  measuring outcomes — it inevitably grows into deciding what to do about them, which is a
  different system's job and reopens statelessness as a design question.
- **Say nothing architecturally and handle this if/when it comes up** — rejected: the cost of
  stating this boundary explicitly now, while the contract is still unimplemented, is low; the
  cost of an ambiguous boundary once a real Analytics/Intelligence Service project starts (with
  its own incentive to push scope into whatever's easiest) is much higher.
