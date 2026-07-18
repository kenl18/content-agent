// Deferred: no HTTP transport in Version 1 (see docs/technical-design.md, "Resolved decisions,"
// and ADR-0004). A real adapter here should translate its own request format into a raw request
// object, call `generateContent` from src/application/content-service.ts, and translate the
// result back into its own response format (e.g. HTTP status codes) — without introducing any
// transport-specific logic upstream of this file.
export {};
