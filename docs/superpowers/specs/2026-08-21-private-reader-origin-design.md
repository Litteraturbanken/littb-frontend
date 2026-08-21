# Private Reader Origin Design

**Date:** 2026-08-21

**Status:** Approved

## Purpose

Give the Nuxt Reader a production-safe source for legacy text, image, EPUB, and PDF assets without routing those requests through the public `litteraturbanken.se` frontend after cutover.

The change must be rehearsed on Stage and must not deploy the Nuxt site to production.

## Current failure

Stage currently uses `https://litteraturbanken.se` as its Reader source. That works only while the legacy site owns the public hostname. After the Nuxt cutover, the same configuration would proxy Reader requests back into Nuxt and create a self-loop.

Neither `http://lb-apache.int.lb.se` nor `http://lb-webserver-a.int.lb.se` is a usable replacement. Their internal authorities intentionally select a health virtual host and return an empty `200` with no content type. Both hosts serve the expected assets only when the upstream `Host` is `litteraturbanken.se`.

The two legacy content hosts serve byte-identical representative text, CSS, image, EPUB, and PDF assets. They share legacy storage, so redundant web heads do not remove the storage dependency.

## Architecture

### Canonical private authority

Create one exact private authority:

```text
http://reader-origin.int.lb.se
```

The legacy DNS source must publish two A records:

```text
10.1.0.19 reader-origin.int.lb.se
10.1.0.3  reader-origin.int.lb.se
```

These are the private addresses of the two Ansible-managed outer load balancers. The records must not include a public address, CNAME to `litteraturbanken.se`, or a short unqualified alias.

The tracked DNS file currently contains unrelated uncommitted operator edits which are also present on the live DNS host. The Reader-origin commit must stage only the two new records. Live deployment must patch the current remote file in place, preserve all other bytes, validate `dnsmasq`, reload it, and verify both answers. It must not replace the live file with the repository blob.

### Load-balancer boundary

Both managed load balancers receive an HTTP-only Caddy virtual host for `reader-origin.int.lb.se`.

The virtual host:

- accepts only `GET` and `HEAD`;
- accepts only `/txt/*`, `/bilder/*`, and `/export/faksimil/*`;
- returns `404` for all other paths or methods;
- proxies to both `http://lb-apache` and `http://lb-webserver-a` using round robin;
- sets upstream `Host: litteraturbanken.se` and `X-Forwarded-Proto: https`;
- explicitly removes `Cookie`, `Authorization`, and `Proxy-Authorization` upstream;
- uses bounded retries and active health checks against a real representative asset;
- evaluates the health request with upstream `Host: litteraturbanken.se`;
- exposes no administrative, API, or general public-site route.

The private authority deliberately uses HTTP. The content is public, the Nuxt proxy already forwards only an audited header allowlist, and the route stays on the private interconnect. The boundary must not later be generalized to authenticated or editorial content.

### Frontend configuration contract

Stage and production accept exactly `http://reader-origin.int.lb.se` as the Reader source. Development and test fixtures may use explicitly supplied local origins, but a production or staging runtime must reject every other authority, scheme, port, path, query, fragment, credential, control character, and hostname spelling.

The Stage jobspec and deployment script default to the canonical private origin. The production jobspec and promotion tool require the same exact value. Promotion compares Stage and candidate identity and refuses an origin mismatch.

The Nuxt proxy retains its existing path, method, request-header, response-header, redirect, traversal, and disconnect protections. The exact-origin check is an additional configuration boundary, not a replacement for those controls.

### Semantic startup preflight

Before starting the Nuxt server, each Stage and production allocation performs one bounded request through `READER_SOURCE_BASE` to a stable representative CSS asset.

The preflight must require:

- the exact configured canonical origin;
- a `2xx` response;
- `Content-Type` beginning with `text/css`;
- a nonempty response body;
- a strict maximum number of bytes read;
- an overall timeout;
- no redirect to another authority.

An empty `200`, missing or incorrect content type, redirect, timeout, or transport failure stops the new allocation before it becomes healthy. Ordinary frontend liveness remains independent of the Reader origin after startup; a later legacy outage must produce monitored Reader errors rather than restart otherwise healthy Nuxt allocations.

### Monitoring and release rehearsal

The Stage observability verifier gains a read-only Reader probe through the public Stage frontend. It checks a representative text/CSS asset for status, content type, and a nonempty bounded body. It must not emit raw content or sensitive headers.

Before production approval, Stage must prove:

1. each load balancer independently serves all allowed asset families when addressed with `reader-origin.int.lb.se`;
2. disallowed paths and methods fail closed;
3. DNS returns both private addresses from a Nomad allocation;
4. representative text, CSS, JPEG, PNG, EPUB range, and PDF range responses have correct status, type, and nonempty bodies;
5. one unavailable legacy content host does not interrupt the private origin;
6. one unavailable outer load-balancer address is either retried successfully by the deployed Node/Undici stack or is recorded as a release blocker requiring a health-aware service endpoint;
7. the public Stage Reader flow and the full local/Stage suites pass;
8. no request for Reader content reaches the public production hostname.

If item 6 fails, do not accept single-host operation and do not weaken the test. Replace DNS multi-A consumption with a dedicated health-aware internal proxy or service-discovery endpoint in a separately approved design.

## Source ownership

Changes span three repositories:

- `lb-meta`: authoritative legacy DNS host records only;
- `lb-infra`: managed dual-load-balancer Caddy configuration, production jobspec, promotion guard, observability verifier, tests, and release runbook;
- `littb-frontend`: Nuxt exact-origin policy, Stage jobspec/deployer defaults and startup preflight, tests, and release audit references.

Commits remain repository-local and scoped. Unrelated dirty files in `lb-meta`, `lb-infra`, and `lb-backend` must remain untouched and uncommitted.

## Rollback

Rollback is ordered from consumers to providers:

1. revert Stage frontend to its prior pinned jobspec revision;
2. remove the two private DNS records and reload `dnsmasq`;
3. remove the private Caddy virtual host from both load balancers and reload Caddy.

Removing the private origin must never precede reverting an active Stage consumer. Production is not changed by this implementation or rehearsal.

## Acceptance

The design is accepted only when source diffs are independently reviewed, repository-focused suites are green, Caddy and dnsmasq configurations validate, Stage allocations use the exact canonical origin, the semantic startup preflight is observed on real allocations, the failure rehearsals above pass, and all worktrees retain their pre-existing unrelated state.
