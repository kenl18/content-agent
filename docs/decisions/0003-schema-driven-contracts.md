# ADR-0003: Schema-Driven Contracts via a Server-Owned Schema Registry

## Status

Proposed — the registry mechanism (static registry vs. caller-supplied schema) is flagged for
confirmation in technical-design.md, "Open decisions." Refined by
[ADR-0007](0007-content-type-schema-id-separation.md), which splits the single `contentType` ->
schema lookup described here into `contentType` -> `Template` (via Template Selection, see
[ADR-0008](0008-template-layer.md)) -> `schemaId` -> schema. The server-ownership principle in
this ADR still holds; only the lookup mechanism became two steps instead of one.

## Context

The service must know the exact structural shape a piece of content should take (which sections,
which fields, what's required) in order to both prompt the model correctly and validate its
output. Two ways to get that shape:

1. The caller supplies a `contentType` string; the service looks up a schema it owns for that
   type.
2. The caller supplies the output schema directly as part of the request.

## Decision

Version 1 uses option 1: a **server-owned schema registry**, keyed by `contentType`. The request
contract (`docs/contracts.md`) requires `contentType` and a `sections` array describing the
pieces of content needed; the service validates `contentType` against its own registry and uses
the registered schema to validate the model's output.

Request and response validation both go through Zod schemas defined in `src/domain/`. Nothing
enters or leaves the pipeline without passing through a schema check — there is no "trust the
caller" or "trust the model" path.

## Consequences

- The set of valid `contentType`s is controlled by this service, not by callers — an unknown
  `contentType` is a validation error (`UNKNOWN_CONTENT_TYPE`), never silently accepted.
- Adding support for a new kind of content means adding a schema to the registry in this
  repository, not a caller-side change alone.
- Because output shape is server-owned, the service can guarantee response shape consistency
  across all callers requesting the same `contentType`.
- The `sections` array in the request is still caller-supplied — it tells the service which
  pieces of the registered schema apply for this particular request/prompt, without letting the
  caller redefine the schema itself.

## Alternatives considered

- **Caller-supplied output schema** — more flexible, but weakens the service's ability to
  guarantee response shape and pushes schema-design responsibility onto every caller. Rejected
  for V1; may be revisited if the registry proves too rigid in practice.
