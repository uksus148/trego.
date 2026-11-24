# Landmark information and photos — hybrid delivery contract v1

**Latest scope selected by Murat:** multiple verified demo scenarios with at least
two photographed landmarks each, plus automatic photo discovery for other supported
places. Marker cards always show place information, whether or not photos exist.
This supersedes the earlier catalog-only delivery scope. Technical wire/provider
details were reviewed in merged #73/#71/#74. The Java implementation is described
in [api/MEDIA.md](../api/MEDIA.md); code review and fixture acceptance do not
establish final live image/demo acceptance.
Read canonical [CLAUDE.md](../CLAUDE.md) first; existing chat/routing contracts remain.

## 1. Implemented scope

- Prepare multiple demo scenarios, each with at least two distinct photographed
  landmarks. The Tatras demo initially targets **Štrbské Pleso, Skok waterfall and
  Popradské pleso**. Coverage and actual routes must be verified, not assumed.
- Match canonical persisted places by **osmType + osmId**, never by display name,
  rounded coordinates or a UUID copied from one developer's database.
- `GET /api/places/{placeId}/media` resolves that environment's UUID to the stored
  OSM identity. Use a reviewed catalog entry first; for uncatalogued OSM identities,
  attempt verified automatic discovery. The server owns this policy.
- No verified image after a successful lookup means photos:[], not a substitute.
  Manual places without a verified external identity can remain photo-free. Keep
  their information card and omit the image region entirely.
- Desktop hover or keyboard focus opens a place-information card; click/tap pins
  it for interaction. Photos, when available, accompany that information.
- Route rendering/persistence does not wait for media. A media failure never causes
  another chat/route POST or a fabricated substitute photo.
- Keep legacy Photo, Place.photos, Route.segments and chat shapes unchanged. Use
  a separate LandmarkPhoto DTO with nullable actual image coordinates.
- Use the existing Spring Boot Maven module and feature packages. No separate Java
  module, new database migration, worker or Kafka integration is needed.

Local backend activation is explicit: API_MEDIA_ENABLED=true. Default false keeps
the endpoint/workers disabled (404) on the existing MVP profile. See
[API environment example](../api/media.env.example) and
[media compatibility notes](../api/MEDIA.md#compatibility-notes-for-reviewers). Do not turn the feature on
implicitly while stabilizing/versioning the route MVP. The frontend is merged; verify the selected target and live assets before joint activation.

## 2. Automatic discovery

Automatic discovery outside the curated set is part of the requested capability,
not a claim that arbitrary internet photos are available or verified. The implemented
path is canonical OSM identity -> Nominatim lookup/extratags -> Wikidata P18 ->
Commons metadata. Missing links return empty; a Commons category is not proof that
every file depicts the landmark. No proximity-only or arbitrary web-image fallback.

Murat selected a 12-second total lookup budget, the agent-compatible shared Nominatim
gate in Aiven Valkey, and metadata caching: 24 hours for an image, five minutes for an
empty result, without read-based TTL refresh. At most three provider requests are made
on an uncached successful chain (batched P18 images, no automatic HTTP retries).
The gate uses the existing agent namespace/hash and token-checked one-second cooldown;
rate waits and cache work consume the same budget. Failures are not cached. Provider
endpoints and policy version participate in cache identity; UUID changes do not relabel
the underlying OSM object. Affected owners still review implementation compatibility.
Existing routing limits/cache remain unchanged. SQL photo storage, uploads, EXIF,
Kafka, embeddings and route-corridor association stay deferred.

A catalog-only milestone may be demonstrated with explicit limited coverage, but
does not complete the newly requested general-discovery feature. Preserve the
verification run and report any gap in the selected environment.

## 4. Catalog preparation and identity proof

Murat and Mukhamed review the three exact OSM identities selected by the real demo
flow, then bind them to reviewed Commons file IDs. A lake and a settlement with the
same name are different objects. If another canonical identity is used, return empty
until that exact association is reviewed; do not use name fallback.

The version-controlled catalog contains only public, reviewed metadata:
- OSM type/ID, Commons page ID, actual full and thumbnail HTTPS URLs;
- image title, creator attribution, exact license label/reference;
- the file-description page and evidence establishing the depicted landmark;
- sourced caption or null; actual image geotag or null;
- original metadata retrieval time, plus review evidence/reference for maintainers.

No real photo is chosen by the synthetic fixtures. Before enabling, verify all selected
actual files, metadata, full-size URLs and association evidence with the owners.
Do not treat a nearby image, similar filename, Commons category or LLM confidence as
proof. Show absence rather than an unrelated image. Do not infer trail visibility.

Catalog entries provide reliable curated coverage; the automatic adapter handles
uncatalogued identities using the same subject/rights validation and output DTO.
Keep catalog data separate from controller/service code; load it through a small
catalog lookup component. Validate catalog structure, IDs, URLs and required metadata
in tests. Invalid defensive runtime candidates are omitted and logged safely, never
repaired with fake credits/coordinates. The catalog is refreshed through reviewed changes.

## 5. Read API and exact response

`GET /api/places/{placeId}/media` accepts an existing Place UUID, with no query
parameters. Unknown parameters return 400, including a frontend cache-buster.
Java loads the canonical place and selects at most **one** verified image by its OSM
pair, from the catalog or the bounded automatic adapter. The API returns metadata;
the frontend loads image bytes from the approved image host. Both paths share the
same contract. Empty is not used to disguise provider failures.

```json
{
  "placeId": "00000000-0000-4000-8000-000000000002",
  "status": "ready",
  "fetchedAt": "2026-11-15T00:00:00Z",
  "placeDescription": null,
  "photos": [{
    "id": "commons:123456",
    "provider": "wikimedia_commons",
    "url": "https://upload.wikimedia.org/fixture-full.jpg",
    "thumbUrl": "https://upload.wikimedia.org/fixture-thumb.jpg",
    "title": "Synthetic landmark image",
    "description": {
      "text": "Synthetic source caption identifying the landmark.",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Fixture.jpg"
    },
    "author": "Fixture photographer",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Fixture.jpg",
    "associationSourceUrl": "https://commons.wikimedia.org/wiki/File:Fixture.jpg",
    "photoLocation": null
  }]
}
```

Example facts/IDs/URLs are **synthetic**, not real fetchable/verified image metadata.
[Shared consumer fixtures](contracts/landmark-photos.examples.json) are the matching
mock/test source. They must not be mistaken for the actual reviewed demo catalog.

| Field | Rule |
|---|---|
| placeId | Exact requested UUID, not an OSM or catalog identifier |
| status | ready iff photos has one item; empty iff photos is []; contradictions are invalid responses |
| fetchedAt | Original metadata retrieval timestamp, offset-aware RFC3339; null only when no external metadata was retrieved; never stamp old metadata with GET time |
| placeDescription | Required key; null or {text,sourceUrl}, a verified short description of the place independent of photos, plain text <=1,000 characters |
| id / provider | Stable commons:<positive-page-id> and literal wikimedia_commons |
| url / thumbUrl | Full image: HTTPS upload.wikimedia.org; thumbnail: HTTPS upload.wikimedia.org or thumb.wikimedia.org; fallback to full URL only when no thumbnail exists |
| title | Nonblank source title, plain text, <=300 characters |
| description | Required key; null or {text,sourceUrl}; sourced plain-text image/subject caption <=1,000 characters |
| author | Actual credited creator, nonblank plain text <=500 characters; not an invented placeholder or automatically the uploader |
| license / licenseUrl | Exact reviewed license designation and matching reference, not a generic “See source” |
| sourceUrl | Commons file-description page, not the raw image URL or Place research source |
| associationSourceUrl | Reviewed evidence linking this file to this canonical landmark; may equal the file page |
| photoLocation | null or finite WGS84 {lat,lon} from image metadata; never a Place-coordinate fallback or a claim of exact camera position |

Empty gallery: same placeId, `status:empty`, `photos:[]`; placeDescription may still
exist. fetchedAt is the actual provider retrieval time for automatic lookup or null
when no external metadata was retrieved. Ready retains catalog/provider retrieval time.
A matched record that cannot be safely served is also empty; do not fabricate metadata.
Missing caption alone does not reject a fully attributed photo. UI states that the
caption is unavailable. A caption is not a new tourist/history description of Place.

HTTP errors use existing Problem Details with safe English detail:
- 400 invalid_request: malformed UUID or unsupported query parameters;
- 404 place_not_found: UUID does not identify a persisted place;
- 503 storage_unavailable: canonical place lookup cannot reach storage;
- unexpected server defects remain safe 500 responses, not successful empty results.

Automatic-provider failures use 502 photo_provider_error, total deadline uses
504 photo_timeout; if a required photo cache is selected, 503 cache_unavailable is
also possible. These affect only media. A provider outage is not a successful empty
result. The curated path does not require a live metadata request for reviewed entries.

## 6. Attribution, formats and links

Review JPEG/PNG/WebP files. Accept reviewed **CC BY and CC BY-SA versions 2.0, 2.5,
3.0 and 4.0**, plus CC0/public-domain records with explicit supporting metadata.
Preserve each file's exact designation, including any jurisdiction-specific variant,
and matching license URL; do not collapse it into a 4.0 label or accept arbitrary
strings because they contain “CC”. Review each selected file rather than adding
an unbounded license parser. Unknown/contradictory credits exclude it.

Treat all source text as untrusted: convert HTML to plain text, decode entities, never
render provider HTML. Caption language is source language, not necessarily chat language.
Render Place.source (place research), sourceUrl (image), description source and license
as separately labelled references. Keep existing map/OSM attribution visible.
Validate exact approved HTTPS hosts, no credentials, unexpected ports or arbitrary
redirects. No private key or credential may occur in catalog or image URLs.

Live Commons metadata inspection confirmed thumb.wikimedia.org thumbnail URLs and
optional utm_source/utm_campaign/utm_content analytics parameters. The adapter removes
only those known query parameters; arbitrary query tokens remain rejected. Consumers
must permit the exact thumbnail host above if using an image allowlist/CSP. This is a
host-policy clarification, not a new response field or a wildcard-host exception.

## 7. Frontend: one media store, multiple views

1. Draw the existing route immediately. Fetch media by distinct canonical Place UUID;
   selected place first, maximum two concurrent GETs. Deduplicate repeated visits.
2. Keep loading/ready/empty/error state by UUID. A stale response from the previous
   selection must not overwrite the newly selected place's gallery.
3. Hover/focus opens an information card; tap/click pins it. It always shows the
   canonical Place name and available tags/type. Show Place.source as a safe source
   link when it is an HTTP(S) URL, otherwise a plain origin label such as manual.
   Show placeDescription only when source-backed; do not turn the photo caption
   into a fabricated attraction description. Information is visible while media
   loads and remains visible when photos are empty, broken or fail.
   Keep the card open when moving the pointer from marker into card; its links and
   image must be usable. It must be keyboard reachable, closable and touch-accessible.
   Display the first/only photo as a thumbnail at the Place marker. Marker position
   remains Place.lat/lon, regardless of photoLocation being missing or different.
4. Within the card show place information beside/above the photo. Selecting the
   photo opens a keyboard-accessible viewer with full **url**, title, caption or an honest
   missing-caption message, author, license and source links. Escape closes it and
   focus returns to the invoking control. Broken image affects that tile/view only.
5. Build **“What you will see along the way” from the same media-by-UUID store**, in
   the route's visit order. It is another view of the same galleries, not a second
   image search, API or cache. Repeated visits can reference the same gallery while
   retaining their visit labels; duplicate data/requests are not needed.
6. Do not fabricate Route.segments, fromKm/toKm or on-track visibility. If the strip
   no longer represents distance segments, update its labels/selection behavior
   accordingly rather than retaining misleading kilometre ranges.

Route.places exposes ordered intermediate visits only. In chat context, use the
returned start/stops/end Place order to include available endpoint galleries. Without
that context show available route.places; do not reconstruct endpoint UUIDs from GPS.
A raw manually selected A/B point is not a persisted landmark. A manually created
Place with UUID but no OSM pair has an empty gallery in this first slice.

Keep the route during media loading/errors. An explicit retry repeats this GET only;
never replay chat/route POST, switch providers or show unverified nearby photos.
Frontend must reject status/photos contradictions and mismatched placeId as gallery
errors, keeping the route and place information. For empty results, omit the photo
area and leave a normal information-only card. “No verified photos” may appear in
an explicit photo-details view, but is not a replacement for the place card.

Place information comes from the canonical Place and optional source-backed
placeDescription. Description coverage is independent of photo coverage: if neither
provides a verified narrative, show the name/type/source without inventing facts.

## 8. Demo and mocks

**Target demonstration profile: real services, VITE_USE_MOCKS=false**, with curated
demo metadata and verified automatic discovery for other supported identities. Image
bytes still load from Wikimedia, so verify
those exact URLs in the selected environment. A broken image does not become a routing error.

Development/mock mode consumes synthetic ready/empty/problem responses from the shared
examples file; it makes **no live coordinate-based photo search**. Synthetic images
must be visibly labelled illustrations/placeholders and must not be presented as
verified real photos. The fixture's dummy Wikimedia paths must not be fetched; use a
local labelled illustration for rendering tests while preserving the response-shape test.
Do not switch silently from real services to mocks during failure or demo. A mock demo,
if explicitly chosen later, must be labelled and not claimed as live integration.

## 9. Responsibilities and acceptance

| Owner | Responsibility |
|---|---|
| Murat | Existing-module media endpoint/DTO, canonical OSM lookup, catalog and agreed bounded automatic adapter; independent place information and photo outcomes; integration/error tests |
| Mukhamed | Verify canonical identities and subject/source evidence, review automatic identity resolution/provider coordination and sourced description policy; preserve agent baseline |
| Daniil | Hover/focus/tap information cards with optional photo, fixtures-only mock, full viewer/credits, shared ordered strip and isolated errors |
| All three | Agree exact fixture/schema, review real catalog assets, review affected boundaries and run same-revision live acceptance |

Required checks before enabling:
- At least two demo scenarios each expose two distinct photographed landmark identities
  with the exact reviewed image metadata and verified routing entry mode.
- Uncatalogued OSM places attempt the automatic path; no verified match returns empty.
- Manual/no-identity places retain information-only cards, without guessed photos.
- UUIDs may differ between databases without changing OSM-based matching.
- Full viewer uses url, thumbnail uses thumbUrl; source/creator/license are visible.
- Hover/focus/tap cards retain place information with/without photos and during errors.
- Strip and marker/details share data; repeated visits do not duplicate GETs.
- No-caption/no-geotag cases work honestly; malformed metadata and unsafe URLs fail validation.
- Missing place, bad UUID/query and storage failure have correct isolated errors.
- Agent's existing chat/route fixtures and legacy Photo semantics remain compatible.
- Live E2E: real chat -> saved route -> three available galleries -> full viewer and
  credits; at least one uncatalogued automatic success; then empty/manual case and
  controlled gallery failure with route and information cards retained.

### Demo scenario manifest — candidates, not completed acceptance

| Candidate | Minimum photographed subjects | Gate before presenting |
|---|---|---|
| July Tatras: Strbske Pleso -> Skok -> Popradske pleso | At least two distinct subjects among the three canonical landmarks | Actual route, exact OSM identities, two reviewed images and cards verified live |
| Bratislava Castle -> St. Martin's Cathedral | Both distinct landmarks | Verify current text or manual route entry and both photo associations |

Keep reviewed prompts, tested revision, routing entry mode and approved image/OSM
identities together in the verification record. Do not label either photo demo
ready until those checks pass. An uncatalogued request exercises
the automatic path; missing photos simply leave information-only cards.
