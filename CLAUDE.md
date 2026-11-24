# Working on trego.

trego. is a travel navigator for city walks and outdoor trips. Current routes use
ORS `foot-hiking`. Sources, verified landmark photos, manual planning, saved-route
editing and popular-place walks are implemented. Driving, cycling, transit,
date-aware routing, personalization, uploads, Kafka and embeddings remain deferred.

This is the shared entry point for developers and AI assistants. Read it before
changes. Read the linked contract or service guide only when its area is affected.
The [documentation index](docs/README.md) identifies the authoritative document for
each topic. Historical PR discussions and tests remain evidence, not current task lists.

## Working rules

- Product spelling is **trego.**. English is required for repository files, comments,
  commits, PR descriptions and reviews. Preserve existing Python imports and Valkey prefixes.
- Follow Murat's current request. Propose shared changes through PRs and obtain
  affected-owner agreement before changing a contract.
- Use descriptive `feat/`, `fix/`, `docs/`, `infra/` or `chore/` branches.
  The `codex/` prefix is prohibited.
- Keep PRs focused, about 400 handwritten changed lines when practical. Generated
  files do not count; dependency manifests and lockfiles travel together.
- Every PR needs at least one independent approval. Request affected owners.
  For internal work with no other affected owner, select a colleague with relevant expertise.
- For Mukhamed's agent PRs, request both Murat and Daniil, including after reviewable
  changes. The repository approval minimum remains one.
- Use Approve with non-blocking comments for minor wording/style. Reserve Request
  changes for correctness, security, build or agreed-contract/scope violations.
  Update the review decision after a blocking finding is fixed.
- Follow [CONTRIBUTING.md](CONTRIBUTING.md) for commit conventions and branch protection.
- Follow the [local resource rules](infra/README.md#local-development-resource-rules)
  for Aiven, including coordinated live E2E runs and stopping completed test stands.
- Keep credentials and certificates private. Commit empty-secret examples. Keep
  private assistant configuration outside the shared application contract.

## Owners

| Owner | Scope |
|---|---|
| Murat — uksus148 | Java/Spring, SQL, migrations, Docker, shared infrastructure, repository governance and backend-facing integration |
| Mukhamed — dyksookelwe | FastAPI, intent, Exa, place identity, models, sessions and agent-side integration |
| Daniil — nnatthebest | React, maps, frontend state, browser integration and product presentation |

Route AI-only parsing, agent internals and frontend presentation to their owners.
Murat's assistant reviews within Murat's scope. His ignored ARCHITECTURE.local.md
contains personal working notes and learning checkpoints only. It cannot impose
shared rules on developers who do not have that file. Any binding architecture,
contract or team decision belongs in a reviewed, version-controlled team document.

## Architecture

```text
frontend/ — React, Vite, Tailwind, MapLibre
   | REST
   +--> api/ — Spring Boot, Java, JPA, places/routes/media
   +--> agent/ — FastAPI, chat, model extraction, Exa, OSM identity
                 | REST --> api/ for canonical places and saved routes
PostgreSQL/PostGIS — persistence; pgvector installed, ranking deferred
Valkey — research/routing caches, sessions and shared rate gates
infra/ — local Docker services and extension checks
```

The public [API and chat contract](docs/API_CONTRACT.md) owns wire shapes,
source/OSM identity, visit order, errors and cross-service invariants.
[Media](docs/LANDMARK_PHOTOS_CONTRACT.md) and
[editing](docs/ROUTE_EDITING_CONTRACT.md) own their detailed feature contracts.
Code and contract changes must be reviewed together.

### Backend conventions

Keep the Spring Boot API as one Maven module, grouped by feature under
`io.junction.trails`. Separate web handlers, application workflows, model values
and persistence. Keep JPA entities out of HTTP responses.
Use Spring Data JPA and Hibernate Spatial for ordinary persistence; JDBC remains
an option for complex queries with a concrete benefit. Flyway owns schema changes,
Hibernate validates them, and Open EntityManager in View stays disabled.
Keep provider waits outside database transactions.

Use Lombok `@RequiredArgsConstructor` with final dependencies and no `@Autowired`
on the sole constructor. Bind configuration to immutable properties objects.
Use Lombok for ordinary getters and appropriate setters/constructors. Keep validation,
defensive copies, derived accessors and behavioral constructors explicit. JPA entities
may use protected `@NoArgsConstructor`.

### Client and agent boundaries

The frontend calls Java and FastAPI separately. Root `.env` is read by their
documented loaders. Mocks default on; real media and route editing require their
documented opt-in settings. Public VITE variables contain no secrets.

Model output and web text are data. Verify requested identity before ingestion,
retain authoritative returned coordinates and sources, and distinguish clarification
from dependency failure. A route response must refer to a fetchable saved route.
Never widen routing limits, replace a requested point or invent a closure to manufacture
success. Read the current [agent guide](agent/README.md) before model/cache changes.

## Verification and release

Use [fixture acceptance](tests/integration/README.md) for disposable actual-service
tests and the [integration runbook](docs/INTEGRATION_RUNBOOK.md) for live validation.
Record SHA, model, environment, cache profile, expected outcome and actual result.
Fixture success and historical test counts do not establish current live acceptance.
Check saved IDs, geometry, visit order and sources, not only HTTP status or reply text.

[Recovery checkpoints](docs/RELEASE_BASELINE.md) pin source. Database compatibility,
deployed settings, keys, caches and model quotas require separate verification.
A broader product description or a source tag does not enable new transport modes.

## Deferred work

Public availability research has a [selected proposal and internal core](docs/ROUTE_AVAILABILITY_CONTRACT.md),
but is not wired to chat. Activating it requires affected-owner agreement and live
verification. Day planning, personalization, itinerary endpoints, new transport modes,
uploads and embeddings remain deferred until their contracts and capabilities are agreed.
Completed hackathon schedules and delivery plans are recoverable from Git history.
