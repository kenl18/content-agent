# ADR-0007: Separating `contentType` from `schemaId`

## Status

Accepted.

## Context

The original design (see [ADR-0003](0003-schema-driven-contracts.md)) used a single
`contentType` string to both describe *what kind of content* was being requested and to *look up
the output schema* that content must satisfy. Collapsing these into one concept creates two
problems as the service grows:

1. **Schema evolution is blocked.** If `landing-page-hero`'s output shape needs to change (a
   schema v2), every caller using `contentType: "landing-page-hero"` is forced onto the new shape
   at the same time, with no way to version independently.
2. **Reuse is blocked.** Several distinct `contentType`s (e.g. `landing-page-hero`,
   `product-page-hero`) may legitimately want to share the exact same output shape
   (`headline` + `subheadline`), but a single `contentType` → schema mapping can't express "these
   are different content types, same schema" cleanly.

Additionally, once a [Template layer](0008-template-layer.md) exists, `contentType` more
naturally describes *what a template resolves from*, while `schemaId` describes *what a template
resolves to* for output validation.

## Decision

`contentType` and `schemaId` are separate, decoupled concepts:

- **`contentType`** (caller-supplied, required) — a semantic label for what's being generated
  (e.g. `landing-page-hero`). Used as the primary input to Template Selection.
- **`schemaId`** (never caller-supplied) — identifies the exact structural output schema a
  response's `content` must satisfy (e.g. `hero-headline-subheadline-v1`). Resolved internally,
  as a property of the `Template` matched during Template Selection (see
  [ADR-0008](0008-template-layer.md)), and echoed back in `metadata.schemaId` on a successful
  response purely for traceability/debugging.

Callers never choose or supply a `schemaId` directly in V1 — doing so would reopen the
caller-supplied-schema alternative rejected in [ADR-0003](0003-schema-driven-contracts.md).

## Consequences

- Schema versioning becomes possible without breaking callers: a template can be repointed from
  `hero-headline-subheadline-v1` to `-v2` while `contentType: "landing-page-hero"` stays stable
  for every caller.
- Multiple `contentType`s can share one `schemaId` where their output shape is genuinely the
  same, without conflating the two concepts.
- `docs/contracts.md`'s request contract only exposes `contentType`; `schemaId` appears solely in
  the response's `metadata`, as resolved information, not requestable input.
- `UNKNOWN_CONTENT_TYPE` (see [docs/contracts.md](../contracts.md)) now specifically means
  "`contentType` did not resolve to any registered Template," not "no schema found" — the
  distinction matters if a future error case needs to separately describe "template found, but
  its schema is missing," though no such case exists in V1.

## Alternatives considered

- **Keep a single `contentType` → schema mapping** — rejected: blocks independent schema
  versioning and cross-content-type schema reuse, as described above.
- **Let callers supply `schemaId` directly, bypassing `contentType`** — rejected: this is
  equivalent to the caller-supplied-schema alternative already rejected in
  [ADR-0003](0003-schema-driven-contracts.md), and removes the service's ability to guarantee
  response shape independent of caller behavior.
