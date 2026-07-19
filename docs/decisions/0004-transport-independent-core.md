# ADR-0004: Transport-Independent Core

## Status

Accepted. V1 ships the directly-callable core only; a working HTTP transport is deferred until an
actual caller (Website Builder) defines what it needs from the HTTP boundary (see
technical-design.md, "Resolved decisions"). `src/transport/http/` exists as a placeholder.

## Context

The Content Agent will eventually be called by multiple systems, possibly over different
transports (HTTP from Website Builder, a direct in-process call if ever co-located, a CLI for
manual testing). Coupling the generation pipeline directly to one transport (e.g. building
request/response handling directly inside Express route handlers) would make the core logic
harder to test and harder to reuse under a different transport later.

## Decision

The six-step generation pipeline (`src/application/content-service.ts`) is a plain,
directly-callable function/class with no dependency on any transport framework. It accepts a
plain object and returns a plain object (success or error shape) — nothing HTTP-specific (status
codes, headers, request/response objects) crosses into `src/domain`, `src/templates`,
`src/validation`, `src/generation`, `src/providers`, or `src/application`.

(`src/application/` and `src/generation/` were named `src/service/` and `src/prompt/`
respectively in earlier drafts of this ADR — see [ADR-0009](0009-module-renames.md).)

Any transport (HTTP, CLI, direct library import) lives in `src/transport/` as a thin adapter that
translates its own input format into a `ContentRequest`, calls the service core, and translates
the result back into its own output format (e.g. HTTP status codes).

## Consequences

- The service core can be unit-tested with Vitest without spinning up an HTTP server.
- Adding a second transport later (e.g. a CLI for local testing, or direct in-process use by
  another Node service) requires only a new thin adapter, not changes to the core.
- V1 may or may not ship a working HTTP adapter as part of the first implementation pass — that
  is a scheduling decision, not an architectural one. The architecture holds either way.

## Alternatives considered

- **Build directly on top of an HTTP framework** — rejected: would make the core untestable in
  isolation and would tie the service's identity to one transport, contradicting the
  "transport-independent at its core" requirement.
