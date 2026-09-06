# Public API response compression — 2026-09-06

The backend already has GZipMiddleware. The frontend's fetch-based proxy decodes
upstream responses and forwards their decoded streams without Content-Encoding.
Consequently, public search returns 352,995 bytes for `skulle`, even when the
client advertises gzip. Enabling compression again in the backend would not fix
that final transfer.

The proxy now requests identity encoding upstream and applies streaming gzip
at the public boundary when the client accepts it. It uses Node's native
CompressionStream, preserving backpressure and cancellation without buffering
the complete response. Existing frontend HTML Brotli compression is unchanged.

Compression applies to successful JSON responses. Known bodies below 1 KiB,
HEAD, partial/range responses, non-JSON content, and no-transform requests or
responses retain their existing behavior. Unknown-length JSON streams compress
without waiting to buffer a minimum body size. Gzip quality values and explicit
rejection override wildcard negotiation. Eligible identity and compressed
variants both vary by Accept-Encoding. Compressed responses weaken strong ETags;
the proxy continues discarding upstream Content-Length and Content-Encoding,
which describe upstream bytes rather than the outgoing representation.

Validation:

- 110 focused proxy and compression tests pass, including exact decoded parity,
  GET/POST/HEAD behavior, encoding negotiation, caching metadata, already encoded
  upstream responses, streaming before upstream completion, and disconnect
  cancellation.
- Typecheck, focused ESLint, and the architecture policy pass.
- On Node 22.22.0, the captured 352,995-byte response compresses to 60,101 bytes,
  an 83% reduction. Median local compression time is about 2.9 ms over 23 warm
  observations, with every result checked by decompressing to the original bytes.
  This local measurement is not an end-to-end latency claim.

Before rollout, four public responses and all deployed component identities were
captured under `/Users/johan/dev/lb-corpus-search-local/response-compression-20260906/`.
Release acceptance requires actual public gzip bytes to decompress exactly to
those references, identity fallback, browser search/pagination/Reader navigation,
and preservation of every unselected component identity. The release uses the
existing guarded frontend-only deployment and immutable image workflow.
