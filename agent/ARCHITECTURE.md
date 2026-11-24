# Agent architecture and working notebook

Keep current understanding, decisions and the next task here. Edit sections in
place; do not append chat transcripts or create a Markdown report per discussion.
Use **implemented**, **proposed direction**, and **idea to evaluate** explicitly.
Repository documentation is English; learning explanations in chat are Russian.

Baseline reviewed: main `c38953f` (through #90). The shared [root decisions](../CLAUDE.md)
and [handoff contract](../docs/API_CONTRACT.md) remain authoritative.
This document proposes internal work; it approves no new public fields or Java changes.

## Goal, ownership and learning position

The goal is a reliable walking assistant: understand a request, retain its intended
places, attach verifiable sources/OSM identities, and publish a real saved route
or a clear question/error. Reliability means measurable behavior on agreed cases,
including failures; it does not mean infallible language understanding.

- Python/AI owner: interpretation, research, geographic verification, conversation,
  Java client, factual replies, diagnostics and tests of those boundaries.
- Java owner: canonical place UUIDs, OSM deduplication, persistence, ORS routing,
  saved-route APIs and database migrations.
- Frontend owner: chat/map state, markers, route editing, media presentation.
- Shared changes need affected-owner agreement; an internal rewrite preserves the
  accepted HTTP/identity/unit/error contracts until that agreement exists.

Covered together: product responsibilities, the broad pipeline and provider roles.
Next: inspect one request's actual values in the local lab, then understand the
endpoint/stop handoff and reproduce one failure before changing the implementation.
Explain each stage's input, output and failure behavior before replacing it.

## Implemented request flow

Start in [main.py](src/gopstop_agent/main.py), `create_app` and its `/api/chat` handler:

1. Validate `ChatRequest`; acquire a per-session Valkey lease inside the total
   deadline. Read the last six complete exchanges from `ValkeySessionStore.history`.
2. [ChatService.respond](src/gopstop_agent/chat.py) selects EN/RU/SK/FI using
   `LanguageSelector`. Unsupported/uncertain language asks for a choice before discovery.
3. [ClaudeIntentExtractor.extract](src/gopstop_agent/intent.py) reads message/history
   into `RouteIntent`: start/end, up to five intermediate `mustSee` stops, up to
   twelve preferences, and advisory `descriptiveTargets` roles. Missing endpoints
   remain null; excessive ordinary-route intent clarifies rather than truncates.
4. [PlaceDiscovery.discover](src/gopstop_agent/discovery.py) handles ordinary routes
   or eligible city tours. For each ordinary target: `ExaSearch.search` returns
   title/URL/text evidence; `ClaudePlaceResolver.resolve` chooses a source-backed
   name, query, type tags and source index. No LLM supplies trusted coordinates.
5. [NominatimGeocoder](src/gopstop_agent/geocoding.py) obtains OSM candidates;
   [candidate selection](src/gopstop_agent/geocoding_candidates.py) checks names,
   features, context and identity. `DiscoveryResult` retains start/stops/end,
   evidence and reasons. Incomplete ordinary intent stops before place research;
   tour detection may still perform a model call.
6. Only `ready_for_handoff` permits [RouteHandoff.persist](src/gopstop_agent/handoff.py).
   Ingest verified places, use Java's returned records, create the route once and
   fetch it by ID. [TrailsApi](src/gopstop_agent/trails_api.py) validates HTTP results.
7. `FactualReplyWriter` renders authoritative outcome facts locally. There is no
   final reply-generation LLM call. Store the complete exchange before HTTP 200;
   a later failure may leave already committed Java data.

For Bratislava -> Devín Castle -> Vienna, discovery must retain those three roles
and sources. Handoff sends canonical endpoint coordinates and only the intermediate
castle UUID in `placeIds`. Java computes the walking track. A city-to-city result
does not imply cycling support, even if the user mentioned a bicycle.

Data types live in `intent.py` (`RouteIntent`), `discovery.py` (`PlaceFinding`,
`DiscoveredPlace`, `DiscoveryResult`), `geocoding_models.py` (`GeocodedPlace`) and
`api_models.py` (Java records). History stores text, not a structured saved/draft plan.
`drop_stale_stops` partly infers previous built routes from assistant arrow text;
this fragile dependency is a candidate for replacement, not a reliable state model.

## Identity and write rules to preserve

The user's wording, extracted target, researched name, OSM type/ID and Java UUID
are different values. Trace them separately. Strict JSON validates shape, not truth.
Groq uses strict JSON Schema plus local validation; Anthropic uses tool output.
Historical `Claude*` names do not mean that Anthropic is always selected.

Every ordinary target passes its requested name to verification. `descriptiveTargets`
cannot authorize a city-to-landmark substitution or positive cache promotion.
An unbound description asks for an explicit name before writes. Source index must
refer to supplied evidence; a model's confident answer is insufficient.

Names/aliases and supported feature constraints apply together. Exact OSM attributes
such as `historic=castle` or `building=cathedral` can supplement primary categories;
generic attraction text cannot. St./Saint normalization is limited to church/cathedral
names. City boundaries need explicit settlement labels, not admin level alone.
Several distinct valid identities remain ambiguous; never select the first/nearest
to force success. Narrow evidenced same-Wikidata/linked-settlement rules can merge
representations of one entity; historical OSM IDs are fixtures, not runtime overrides.

The nearby-name path (#89) can resolve one exact OSM object within 25 km of independent
route anchors when web resolution is inadequate. It excludes infrastructure and
retains ambiguity; address containment can distinguish local matches. Requested-identity,
conflict and outside-context rejections remain final. The OSM URL supplies evidence
when no research source exists. This is bounded lookup, not unrestricted fallback.

Java deduplicates by `(osmType, osmId)`, not by name/coordinates. First write wins;
use its authoritative UUID, source and coordinates. Preserve repeated visits and
intermediate-stop order; deduplicate only display records. WGS84 objects use lat/lon;
GeoJSON is `[lon, lat]`; metrics are km, metres and minutes. Validate route creation
and saved GET before publishing the ID. Never retry an uncertain Java POST or
substitute a straight line. There is no cross-service rollback or durable request idempotency.

## Conversation and city-tour limits

Implemented: recent text history, model follow-up interpretation, stale-stop filtering,
session ownership and owner-checked exchange append. A lease prevents overlapping
turns but does not fence an already running Java write or undo a saved route.

Implemented city tours (#90): missing endpoints, same-city endpoints without
intermediate stops, and eligible over-limit intents can enter tour detection.
Complete routes between distinct endpoints retain the ordinary path. Optional
research suggestions may be skipped if they cannot resolve; retain at most seven
distinct located sights (start, five stops, end), ordered west to east, not as a
shortest-tour optimization. Research selection can make one additional model call
when it returns fewer than five suggestions (MIN_SUGGESTIONS).

If an over-limit extraction lists sights that the user explicitly named, those
names replace optional research suggestions. Every named sight must resolve to a
single exact OSM match; ask about an unmatched sight rather than dropping it. More
than seven named sights require reduction. This path cites each OSM object URL;
optional research suggestions cite their selected Exa evidence. Fewer than two
located sights produce a nonblank destination clarification, including same-city
intents, without Java writes. These rules describe the merged implementation;
shared policy status and live acceptance remain separate from documentation cleanup.

Proposed regression case: request a route from an airport, then supply a named
destination after clarification. Verify that the airport qualifier survives, or
that unresolved identity produces a specific question before writes. This is an
acceptance requirement, not a reproduced defect against the reviewed main revision.
Capture intent/history/evidence on a pinned version before opening a defect issue.
Proposed structured state must retain an unfinished request as well as the last
successful route; remembering only a successful route does not establish that
clarification works.

## Budgets, caches and diagnostics

Source defaults: provider/API call 20 s, discovery/handoff 60 s, total chat 180 s.
The root example overrides discovery to 90 s. At most three ordinary unique target
chains run concurrently; unfinished siblings are cancelled/joined on failure.
Groq serializes calls per worker and waits on advisory quota headers inside the
deadline. Current main permits up to two replays only for HTTP 429 with a numeric
Retry-After of 0-60 s. Other errors and Java POSTs are not automatically replayed.
Per-worker coordination does not coordinate separate processes or daily quotas.

- Exa: successful/empty results 24 h; full-request hash; corrupt entries refreshed.
- Resolution v3: new/null results provisional for five minutes; exact final accepted
  selections promoted to 24 h; rejected entries demoted. Hits/feedback do not refresh
  lifetimes; compare-and-update protects concurrent replacements. No single-flight guarantee.
- Nominatim candidate v3: nonempty 24 h, empty five minutes, at most eight candidates.
  A shared host gate and cooldown space requests. Empty search can use one narrower
  name/country query; HTTP errors/ambiguity do not trigger that fallback.
- Sessions: default retention 200 messages, TTL 24 h; only six exchanges sent onward.
  Managed Valkey checks idle connections before use; application writes have no replay.

Missing/ambiguous findings are normal clarification. Provider/invalid-response failures
are 502; cache/storage failures 503; deadlines 504; same-session contention 409.
Verified `no_hiking_route` and `waypoint_not_routable` are distinct normal outcomes.
Neither proves a closure, season restriction or danger. Production diagnostics log
safe trace/timing/reason/count metadata; payload inspection remains local development work.
See [VERIFY.md](VERIFY.md) for commands and evidence limits.

## Replacement direction and sequence

**Proposed direction:** build a small understandable core in an isolated branch,
replace one boundary at a time, and integrate through small reviewed PRs. Keep the
current service available for comparison. Do not delete safeguards because their
implementation looks complicated; first establish which requirement they protect.

1. Understand the baseline. Walk through one success and one clarification; identify
   original target, evidence, OSM ID, canonical UUID and route request. Done when the
   owner can explain the values and responsibilities without generated commentary.
2. Make the local lab reproducible. Review/migrate the existing uncommitted lab work
   separately. One launcher, personal key controls, fixtures, simulated Java, stage
   input/output and explicit WARNING/ERROR. No production entrypoint or shared dotenv.
3. Fix the smallest proven conversation defect. Capture a failing multi-turn case;
   introduce explicit draft/saved state with tests for new requests and stale stops.
   Preserve wire shape, lease ownership, TTL and atomic exchange semantics.
4. Simplify discovery behind stable data types. Separate orchestration, provider
   adapters and deterministic verification. Preserve source/OSM identity, repetitions,
   deadlines and cache acceptance; compare old/new behavior on the same offline corpus.
5. Integrate the new core behind the existing chat/handoff boundary. Keep one clear
   rollback path; retire old modules only after references/tests prove replacement.
   Share real Java/browser acceptance with teammates when their services are available.
6. Add capabilities individually after baseline acceptance. Evaluate alternative
   research/geocoding services, then separately agreed product features. Measure
   identities, ambiguity, sources, latency, calls and cost instead of counting tests.

Aim for several focused days: understanding/lab, one state fix, then one discovery
slice and comparison. This is a work order, not a promise of a complete rewrite in
that time. If a step is larger than one reviewable change, split it before proceeding.

### Providers and deferred scope

**Proposed direction:** small replaceable research/geocoding/model adapters with
application-owned result types; validation stays independent of provider choice.
Factories already accept dependencies but still compose concrete providers.
Exa's selection reflects the original challenge/credits, not demonstrated superiority.
Tavily, Photon and GraphHopper are only ideas to evaluate, not selected replacements.
An alternative geocoder must supply OSM type/ID or a verified mapping; coordinates
alone cannot satisfy current ingestion. Routing changes belong with the Java owner.
Use provider-specific cache identity and explicit unsupported capabilities; no silent fallback.

[AVAILABILITY.md](AVAILABILITY.md) remains the useful internal-core reference;
public consent/dates/evidence mapping is deferred. Day planning, personalization,
cycling/transit, Gemini/pgvector ranking, uploads/EXIF/Kafka, photo-rights policy,
candidate confirmation and durable idempotency need separate acceptance/owner decisions.
Installed pgvector or an Exa image result does not deliver ranking or photo rights.

## History, not current acceptance

Historical stage reports and sequencing are preserved at
[the pre-consolidation tree](https://github.com/uksus148/trego./tree/c38953f02413ca3946101f1dd4d6b0b3c50bc872/agent)
and in [the former plans](https://github.com/uksus148/trego./tree/c38953f02413ca3946101f1dd4d6b0b3c50bc872/docs).
Old guide paths stay as compatibility pointers because shared documents link to them.

The [final #78 review](https://github.com/uksus148/trego./pull/78#pullrequestreview-5909280030)
approved the corrected `602bb90` head and recorded five real 120B saved-route/readback
cases using shared/warm caches. It explicitly excluded primary-20B, browser/media
and combined-fixture acceptance. Earlier claims that all corrected-head live checks
were pending are superseded; this historical sample still does not certify current main.
Use the [shared runbook](../docs/INTEGRATION_RUNBOOK.md) for the team's acceptance ledger.
