# Shared API and chat contract

Agree changes with the affected developers and record them here.

- `POST /api/chat` `{sessionId, message}` → `{reply, places:[Place], routeId?}` (agent)
- `GET /api/places?bbox=minLon,minLat,maxLon,maxLat&tags=castle,waterfall` → `[Place]` (api)
- `POST /api/places` `{name, lat, lon, tags[]}` creates a manual place and returns
  HTTP **201 Created** with the complete `Place`, a server-generated UUID,
  server-owned `source: "manual"`, and `photos: []` until photo storage is implemented (api).
  All four fields are required. Coordinates must be finite WGS84 values (`lat` in [-90, 90],
  `lon` in [-180, 180]). Empty tags are allowed; names and supplied tag entries must be
  non-null and nonblank. Strip surrounding whitespace from names/tags and remove duplicate
  tags in first-occurrence order, preserving case. Invalid or malformed input returns
  HTTP **400** Problem Details with an English `detail` and no inserted row. A client-supplied
  source cannot override the manual source. The creation transaction commits before returning
  success, and a matching subsequent bbox/tag search returns the saved place. Separate creation
  requests create separate records; manual creation has no deduplication guarantee. These
  manual-write details were confirmed by the frontend and agent owners in PR #33.
  The accepted researched-write extension below merged in #45.
- `POST /api/routes` `{start:{lat,lon}, end:{lat,lon}, placeIds[], preferences[]}` → `Route` (api)
- `GET /api/routes/{id}` → `Route`
- Deferred, not implemented: `POST /api/photos` multipart `{file, lat, lon}` and Kafka event `photo.uploaded`
- `Place = {id, name, lat, lon, tags[], photos:[Photo], source}`
- `Photo = {url, thumbUrl, author, license, sourceUrl, lat, lon}`
- `Route = {id, geojson(LineString), distanceKm, ascentM, durationMin, places:[Place], segments:[{fromKm,toKm,photos:[Photo]}]}`

## Accepted sourced place and route handoff

D1–D5 were accepted in PR #34 and implemented in #39/#40/#41/#43/#45.
The rules below remain the compatibility baseline. Deployment and live verification
follow the integration runbook.

Researched ingestion uses JPA persistence with a native conflict-safe insert and a separate
canonical read at READ COMMITTED. Flyway V3 enforces OSM identity uniqueness. Its additional
validation details accepted in #45 are signed-64-bit positive OSM IDs and source
URLs without embedded credentials or invalid ports. Unknown write fields, including a
submitted `source`, return 400 rather than being silently ignored. See the
[ingestion implementation guide](../api/INGESTION.md) for evidence and tradeoffs.

- **Researched ingestion (D1/D2):** `POST /api/places` adds optional, complete
  `provenance: {sourceUrl, osmType, osmId}`. The URL is HTTP(S), `osmType` is
  `node|way|relation`, and `osmId` is a positive integer. Manual clients omit it.
  Unknown fields/partial provenance produce 400. Researched `Place.source` is
  the selected research URL; OSM identity is stored separately. New writes return
  201 with a complete Place. Atomic uniqueness on `(osmType, osmId)` returns 200
  with the existing Place on replay, including concurrent submissions. First
  write wins for name, coordinates, tags and selected source; consumers use the
  authoritative returned record. Never deduplicate by names/rounded coordinates
  or submit research through the manual path while discarding its source.

  ```json
  {"name":"Skok waterfall","lat":49.1605,"lon":20.0458,"tags":["waterfall"],"provenance":{"sourceUrl":"https://example.org/hikes/skok","osmType":"node","osmId":100000001}}
  ```

- **Routing (D3):** persist all resolved start/stop/end findings; pass returned
  start/end coordinates and ordered intermediate UUIDs to `POST /api/routes`.
  Preserve repeated visits; do not automatically add endpoints as intermediate
  stops. `placeIds: []` is a direct hike. Resolve UUIDs before ORS `foot-hiking`;
  support at most five intermediate visits and reject larger counts rather than dropping stops. Cache provider
  responses for 24 hours by a hash of all routing inputs and persist the route
  before returning 201 with a full Route. `Route.places` contains only ordered
  intermediate places, including repeats. GET returns the saved Route (200), or
  404 for a missing route. Only return a fetchable, persisted routeId. Keep WGS84,
  `[lon,lat]` GeoJSON, km/m/min units, and actual provider geometry. Empty segments
  and photos are allowed. Preferences remain descriptive interests, without an
  implied routing/ranking effect. Route POST is not idempotent; no automatic POST
  retries, including lost responses. Earlier places/routes may survive failures.
  Java rejects unknown request fields with 400 `invalid_request`. The four baseline
  root fields and optional `startPlaceId`/`endPlaceId` bindings accepted in #80 are
  supported; nested endpoints contain only `lat`/`lon`. See the editor contract below.
  Dates and research metadata belong to the proposed chat extension, never route input.

  ```json
  {"start":{"lat":49.119,"lon":20.063},"end":{"lat":49.179,"lon":20.088},"placeIds":["00000000-0000-4000-8000-000000000002"],"preferences":["wild scenery"]}
  ```

- **Errors (D4):** new write/route errors use Problem Details with required
  `type`, `title`, `status`, English `detail`, and a stable `code`. Existing GET
  place-search errors remain compatible. Codes/statuses are `invalid_request`
  (400), `unknown_place` and `no_hiking_route` (422), `routing_provider_error`
  (502), `storage_unavailable` and `cache_unavailable` (503), `routing_timeout`
  (504), and `route_not_found` (404). Merged #54 adds 422
  `waypoint_not_routable` for ORS 2010, distinct from 2009 `no_hiking_route`,
  as reviewed by both affected owners. Verified routing failures produce distinct
  normal clarifications: different waypoints for no path, or check coordinates/
  choose another point for a failed network match. Neither proves a closure,
  seasonal restriction or difficulty exclusion. Dependency failures remain
  honest errors: the agent retains its `detail` envelope with 502 for dependency
  failures/invalid responses, 503 for storage/cache, and 504 for deadlines. An
  unknown UUID after ingestion is a dependency inconsistency. Never expose
  credentials/provider bodies or identify errors by parsing English text.

- **S2 localized replies (accepted in #65):** enabled chat classifies
  user language before discovery using only the latest user wording and up to six
  previous user messages. Assistant replies and web/place evidence are excluded.
  Support English, Russian, Slovak and Finnish; unknown/unsupported language yields
  a four-language selection question before discovery or writes. Place/link-only
  follow-ups inherit the most recent substantive user's language. Model classification
  remains fallible and needs live acceptance; no local word-count heuristic is used.
  Render ready/clarification/routing outcomes from application catalogs and authoritative
  saved data; preserve canonical start/stops/end names including repeated visits.
  No model is called after handoff to compose the reply. Session storage and existing
  502/503/504 semantics remain. Reply localization preserves the JSON shape.

- **Chat completion (D5):** retain `{sessionId,message}` and `{reply,places,routeId?}`.
  Read recent history before discovery. Missing/ambiguous places or excessive
  intent limits produce a normal 200 clarification with `places: []`, no routeId,
  and no partial writes. Complete discovery ingests places, creates/validates the
  saved route, records the exchange, and returns persisted Place records in
  start/stops/end visit order, deduplicated by UUID at first occurrence for map
  display. Route visits still retain repeats. Replies/clarifications use the
  user's message language; UI labels stay English. Storage failure after route
  creation returns 503 without claiming the exchange was saved. Frontend retains
  endpoint metadata/sources alongside the fetched route, anchors markers to track
  ends, resets stale manual endpoints, and displays sources/OSM attribution.
  Frontend follow-ups #35–#37 are merged; live acceptance remains required.

## Runtime and provider boundary

Enabled chat requires the selected model/key and Exa configuration. Startup validation
does not prove live account availability. The 180-second whole-chat deadline covers
history, classification, discovery, handoff, rendering and session storage; shorter
stage budgets still apply. See the runbook for effective environment values.

Concurrent use of a session returns 409 before provider work. A Valkey owner-token
lease protects history/respond/save and fences stale appends. Exchanges must be
nonblank and at most 4000 characters. Invalid writes/storage return 503; expiry/deadline
returns 504. These guards do not fence an already issued Java POST after suspension.

Requested identities must be verified independently of model descriptive classification.
Unbound places clarify without partial ingestion. The [agent architecture notebook](../agent/ARCHITECTURE.md)
owns the current follow-up, nearby-name, popular-sight, cache and identity algorithms.
Groq supports the three explicit configured profiles. Its bounded 429 replay exception
does not authorize repeating route/chat POSTs or other uncertain side effects.

Implementation status: #89/#90 merged the follow-up, nearby-name and popular-tour
behavior. The preceding CLAUDE.md still labelled these policies "proposed, owner
review pending". This consolidation describes implemented behavior; it does not
silently convert that historical policy status into new shared agreement or certify
live acceptance. Any remaining policy decision needs explicit affected-owner review.

## Routing cache

The routing API uses an explicit `CachedRoutingGateway` backed by **Aiven Valkey**
in deployment. Local development and tests use a disposable Valkey container. The track cache has a 24-hour TTL.
Cache only validated provider tracks, not persisted route IDs. Hash the complete creation
request, resolved ordered coordinates, provider endpoint, and versioned fixed routing options.
Preserve visit order and repeated UUIDs. Cache hits do not refresh TTL; every successful POST
still saves a separate route before HTTP 201. GET of a saved route needs neither ORS nor Valkey.

Read, write, timeout, and corrupt-entry failures return 503 `cache_unavailable`. A failed read
prevents provider work; a failed cache write prevents route persistence even if ORS already
consumed quota. Do not retry ORS or silently bypass the required cache. Check referenced places
before cache access. Concurrent first misses can still issue duplicate provider requests;
distributed request coalescing requires a separate decision before relying on that guarantee.

## Feature contracts

- [Landmark information/photos](LANDMARK_PHOTOS_CONTRACT.md) uses a separate
  GET /api/places/{id}/media. Legacy Photo/Place/Route/chat shapes remain compatible.
  Missing verified photos leave place information available.
- [Route editing](ROUTE_EDITING_CONTRACT.md) adds GET /api/routes/{id}/editing-context
  and optional nullable startPlaceId/endPlaceId to POST /api/routes. V4 stores endpoint
  bindings without inferred backfill. Rebuild saves a new UUID; the original stays
  fetchable. A successful manual rebuild starts a fresh chat session without sending
  edited-route context to the agent.

## Consumer invariants

Research source URLs must be HTTP(S) and credential-free. No place-by-ID GET
or Location header is implied by place creation. Source selection is retained with
the canonical OSM identity; manual creation never replaces researched ingestion.

Frontend route activation follows a successful GET for the returned routeId. Retain
endpoint Place metadata and sources separately from manual draft waypoints. Display
markers deduplicate by UUID; ordered route visits retain repetitions. Committed markers
use track endpoints even when the provider snaps away from the requested coordinates.
After #89, a clarification keeps an existing route visible with previous-route status.
It does not publish a newly built route or erase the user's committed result.

Photo and editing response details live in their feature contracts. Public availability
research is a deferred proposal and cannot add fields to the current chat request.
