# Landmark media — backend implementation

The optional Java media feature merged in #73; frontend cards/gallery and strict
timestamps merged in #71/#74. See the [shared contract](../docs/LANDMARK_PHOTOS_CONTRACT.md).
It requires no agent feature, schema migration, upload endpoint or routing change.
Default activation remains false; final live photo/demo acceptance and deployment
must be verified on the selected target.

## Enable locally

The default is **API_MEDIA_ENABLED=false**: the endpoint returns 404 and there are
no media workers or external photo requests. For review, inject the process variables
from [media.env.example](media.env.example); the only required opt-in is:

```sh
API_MEDIA_ENABLED=true mvn spring-boot:run
```

Use the existing private PostgreSQL and Valkey configuration. Native startup needs
the native PostgreSQL CA path, whereas a container uses its mounted path; keep TLS
verification enabled. Do not shell-source the shared .env or commit its private values.
Root .env and the ordinary route-MVP activation were not modified by this implementation.

Optional controls all have the API_MEDIA_ prefix. Default lookup budget is 12 seconds
(configuration may lower but not exceed it), connection timeout 2 seconds. Automatic
discovery can be disabled independently for explicit catalog-only testing. A replacement
catalog must be a server-configured local classpath/file resource, never a remote URL.

## Review the request trace

```text
GET /api/places/{UUID}/media
  MediaController: UUID and no query parameters
  MediaService: caller deadline, at most four concurrent lookups
    MediaPlaceReader: short read-only transaction -> canonical OSM identity
    no OSM identity -> empty (frontend already has the Place information)
    MediaCatalog hit -> source-linked metadata, no provider or media-cache dependency
    otherwise CachedPhotoDiscovery
      validated Valkey hit -> original metadata/time, no TTL refresh
      miss -> WikimediaPhotoDiscovery
        shared NominatimGate -> exact /lookup OSM type/ID -> Wikidata ID
        Wikidata entity -> source-backed place description and nondeprecated P18
        Commons batched metadata -> verified file/title, format, links and credits
      cache complete metadata with TTL -> ready/empty response
```

No database transaction spans Valkey/provider work. The lookup itself is read-only;
it does not create places/routes, modify legacy Photo or fill Route.segments. On any
media error the frontend retains the route and canonical name/tags/source it already
received. placeDescription is an independent optional sourced Wikidata description;
an image caption cannot become an invented landmark narrative.

## Source, identity and metadata choices

- Catalog keys are OSM type/ID, not environment-specific Place UUIDs. Five actual
  source-linked records cover the three Tatras demo subjects and the two Bratislava
  subjects. Each retains original retrieval time, file ID, creator/license and review
  evidence. Feature reviews merged in #71/#73/#74. Verify the selected environment and live assets before activation.
- For other OSM identities, the automatic path uses a single exact Nominatim lookup,
  one Wikidata request and one batched Commons request. Missing identity/P18 gives an
  honest empty result; there is no name/proximity fallback or HTTP retry.
- Preferred P18 claims take precedence; deprecated/unknown claims are excluded. At
  most 20 valid filenames enter the Commons batch. Accepted files sort by numeric
  Commons page ID and only one photo is returned.
- Nominatim response identity, Wikidata entity ID and Commons file/source title are
  checked. Actual photo geotags are not requested in this slice: photoLocation is null,
  never the canonical Place coordinate or a claimed camera position.
- Jsoup converts untrusted metadata to plain text, removing scripts/styles and decoding
  entities. Full/thumbnail URLs are independent; original sources remain attributable.
- BY/BY-SA 2.0/2.5/3.0/4.0 and exact jurisdiction suffix/URL pairs are checked; explicit
  CC0/public-domain references are supported. Unsupported or contradictory metadata
  excludes the candidate rather than inventing a creator or license. This is a bounded
  application filter and does not replace the required review of curated files.

## Deadline, cache and coordination

The service's virtual-thread task has one caller deadline including its queue and
lookup work; expiry interrupts rate waits/HTTP futures. At most four tasks hold lookup
permits. Each HTTP request uses the remaining deadline, with no redirect following
and a one-MiB response-body limit. Slow response bodies are covered, not just headers.
No late provider retry is scheduled after timeout. A database/Redis operation may
finish its own driver cleanup after cancellation; the next stage rechecks the deadline.

The Nominatim gate is compatible with the existing agent implementation:

```text
gopstop:nominatim:gate:v1:<sha256(base URL without trailing slash)>
```

Acquire an expiring unique token; preserve a one-second cooldown using the same
compare-token Lua script. Never delete/release another caller's token. The API and
agent must use the same actual Valkey database and provider base URL for shared
coordination. Do not change this namespace or protocol unilaterally. Agent source
is unchanged. This limiter controls aggregate rate; it is not a request retry.

Issue #75 correction: the API canonicalizes the Nominatim scheme/host to lowercase,
removes default HTTPS 443 / loopback HTTP 80 and trailing slashes before both provider
use and gate hashing, matching Python Settings -> HttpUrl -> geocoder. The canonical
default key stays unchanged. Nondefault ports and plain ASCII path prefixes (including
case and internal slashes) remain distinct. HTTP is limited to localhost, 127.0.0.1
and [::1] fixtures. Escaped/non-ASCII paths, dot segments, unusual IP spellings and
IPv6 spellings other than [::1] fail configuration binding; no guessed URL identity
or provider request is allowed. Use a plain DNS/canonical IPv4 host or [::1].

Shared key vectors live in src/test/resources/media/nominatim-gate-vectors.json.
The Java/actual-agent concurrency test uses disposable Valkey and fixture HTTP only.
After syncing the agent's frozen environment, run from api:

```sh
mvn --batch-mode --no-transfer-progress -Dagent.python=../agent/.venv/bin/python verify
```

CI supplies this Python path and also runs on agent configuration/geocoding or lockfile
changes. Without agent.python, ordinary Java tests still run; the cross-runtime class
is explicitly skipped. Tokens, leases, Lua ownership checks and one-second completion
cooldown remain unchanged. This corrects coordination, not earlier Groq 502 causes.

Media cache keys use trego:media:commons:v1 plus a hash of OSM identity and provider
endpoints. v1 identifies the metadata/selection policy. Positive TTL is 24 hours;
empty TTL is five minutes. Hits preserve fetchedAt and never refresh TTL. Unknown,
malformed or oversized cache entries are deleted by exact key and refreshed once.
No global flush, stale-on-error serving or error-result caching occurs. Read/write
failure returns safe cache_unavailable; the required routing cache is separate.
Concurrent first misses may still perform duplicate metadata lookups; the common
Nominatim gate bounds rate but does not provide distributed single-flight.

## Compatibility notes for reviewers

Public fields follow the merged media contract. Ready returns exactly one photo;
empty returns none. Nullable description/geotag keys remain present. Query parameters,
including cache-busters, return 400. Commons thumbnails may use exact hosts
thumb.wikimedia.org and upload.wikimedia.org; originals use upload.wikimedia.org.
Only observed utm_source/utm_campaign/utm_content parameters are removed; other
image query tokens are rejected. Preserve file/license identity and never infer a
newer license version. These consumer notes replace the completed draft handoff.
The baseline Place, Route, chat and legacy Photo shapes are unchanged. New errors
are scoped to this endpoint and use safe Problem Details. API_CORS_ALLOWED_ORIGINS
continues to control exact frontend origins, including this GET.

## Verification and remaining gates

Run from api:

```sh
mvn --batch-mode --no-transfer-progress verify
```

Tests use disposable PostgreSQL/PostGIS/Valkey and local provider HTTP fixtures, not
live credentials. They cover identity/source mismatches, absent P18, independent
place description, supported/invalid attribution, unsafe URLs, Commons analytics URL
normalization, redirect rejection, oversized bodies, body deadlines/cancellation,
cache TTL/refresh/corruption, shared token ownership, query validation, safe dependency
errors, changed database UUID, catalog priority and disabled-feature compatibility.
Existing API tests retain their original assertions.

Public metadata was inspected through the same shared Nominatim gate. All five full
URLs responded 200 to HEAD and all thumbnails returned JPEG data; full-size image
downloads were not required for this check. Bratislava Castle's full image is about
9.9 MB, so frontend should load it only when the full viewer opens. Source metadata
and connectivity artifacts live under ignored api/target/media-research/.

The frontend is merged, but these original metadata checks do not certify all-region
coverage or final live catalog/demo acceptance. Missing photos remain valid. Use the
actual-service fixture suite for cards/gallery/error isolation and record separate
real-provider photo/viewer evidence on the selected release before claiming it.
