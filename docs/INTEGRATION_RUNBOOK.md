# Integration and live acceptance

Owners are listed in [CLAUDE.md](../CLAUDE.md). The [shared contract](API_CONTRACT.md)
defines behavior; this runbook owns environment selection and integrated verification.
Past reports remain in PR discussions and Git history. Record a fresh result for each
tested revision rather than treating a closed issue or merged feature as live acceptance.

## Select the environment

Use disposable local PostgreSQL and Valkey for development and automated tests.
Follow the [resource rules](../infra/README.md#local-development-resource-rules)
before a coordinated Aiven check. Record the chosen profile and verify effective targets.

The root `.env.example` lists supported settings. Each service loads root `.env`;
do not shell-source it. Secret values and host-specific certificate paths stay private.
Use process environment overrides when loader escaping is incompatible.

| Component | Configuration to verify |
|---|---|
| PostgreSQL | SPRING_DATASOURCE_URL/USERNAME/PASSWORD, extensions and Flyway V1–V4 |
| Valkey | SPRING_DATA_REDIS_URL and AGENT_VALKEY_URL point at the intended cache |
| Model | AGENT_LLM_PROVIDER, the selected model and its provider key |
| Research/routing | EXA_API_KEY, ORS_API_KEY and endpoint configuration |
| Chat | AGENT_CHAT_ENABLED=true only after preflight |
| Frontend | VITE_USE_MOCKS=false, VITE_API_BASE_URL and VITE_AGENT_BASE_URL |
| Browser origins | Matching API_CORS_ALLOWED_ORIGINS and JSON AGENT_CORS_ORIGINS |
| Optional UI | API_MEDIA_ENABLED and VITE_ENABLE_ROUTE_EDITOR for the tested features |

For Aiven PostgreSQL use sslmode=verify-full with a readable CA certificate.
For container execution mount the CA at the configured in-container path; a host JVM
needs a host path. Keep Valkey TLS verification enabled and use the compatible rediss://
URI with encoded credentials. Local Docker port variables do not describe cloud ports.

Code defaults and example diagnostic budgets differ. Check config.py, application.properties
and the effective environment together. In particular, the agent API call budget defaults
to 20 seconds, discovery to 60, handoff to 60 and whole chat to 180; the root example
sets discovery to 90. ORS has a 20-second read timeout before storage overhead.
Account for queue waits and any proxy deadline when selecting a live-test profile.

## Start and preflight

Record the checkout SHA and selected model first. Start local dependencies using
[infra/README.md](../infra/README.md). In separate terminals from repository root:

```sh
cd api
mvn spring-boot:run
```

```sh
cd agent
uv sync --frozen --extra test
uv run --frozen uvicorn gopstop_agent.main:app --app-dir src --host 127.0.0.1 --port 8000 --log-config logging.json
```

```sh
cd frontend
npm ci
npm run dev -- --host localhost --port 5173 --strictPort
```

Check API startup/migrations and database access, agent OpenAPI and actual browser origin.
An OpenAPI response alone does not validate model access or route creation.
Use the [agent preflight](../agent/LIVE_TEST.md) before enabling chat. After changing
environment flags, restart the affected service. API/V4 must be ready before editor activation.

## Acceptance matrix

Agree a small live scenario set and its concurrency before using shared services.
Use a fresh session for each independent scenario and answer legitimate clarification.
Record whether a route succeeded on the first request and how many turns were required.

| Scenario | Required observation |
|---|---|
| Manual direct walk | POST 201, matching saved GET, visible geometry and metrics |
| Named intermediate stops | Canonical UUIDs/coordinates and requested visit order survive readback |
| Chat route | Sourced findings → ingestion → saved routeId → matching browser GET |
| Same-session clarification | Only intended changes apply; unresolved state gives a useful question |
| New complete request | Obsolete failed stops do not leak into the new plan |
| Multiple/repeated visits | Route order retains repeats; display markers deduplicate without losing sources |
| Other city/region | Identity/source verification works outside the demo |
| Ambiguity or excessive intent | Clarification without partial ingestion or a fabricated route |
| Previous route and clarification | Existing route remains labelled as previous, per #89 |
| No path / unmatched waypoint | Distinct confirmed outcomes; no inferred closure or changed provider limits |
| Model/quota/cache failure | Honest errors and no automatic replay of uncertain writes |
| Same route payload again | New saved UUID; track-cache reuse verified independently of reply text |
| Landmark media | Correct place association, full image, information, attribution and empty/error states |
| Saved-route editing | Rebuild creates new ID, original unchanged, bindings/order survive reload, fresh chat session |

The standard outdoor request is:

> Plan a summer hike in July from Štrbské Pleso to Popradské pleso via the Skok waterfall. I love wild scenery.

The original Rysy request is a routing regression. A word such as July does not give
ORS seasonal awareness. See [routing errors](../api/ROUTES.md#error-contract).
For popular-place requests, verify the independently resolved city and each retained
sight; geographic west-to-east ordering is not a shortest-tour guarantee.

A repeated chat prompt may produce different inputs. Prove track-cache reuse using
the same resolved payload and provider-call evidence. GET remains independent of ORS/Valkey.
Sequential reuse does not prove coalescing of concurrent cache misses.

## Evidence and completion

Record timezone, SHA, executor, environment, provider/model, cache profile, scenario,
expected result, messages/turn count and sanitized trace. Include HTTP status/code,
saved place/route IDs, matching GET, geometry/order/source checks and browser observation.
Keep cold and warm runs separate. Retain private location details only in local evidence;
never publish keys, raw provider bodies, credentials or raw session identifiers.

A failure report identifies the first divergent stage and its owner. Do not repeatedly
spend provider quota or replay an uncertain POST. Earlier writes may survive later failures.
Close a defect only after its specific regression passes; record unresolved live gates.

On completion, follow the resource rules to stop processes and temporary containers
started for the run. Verify connections close. A manual stand may remain running for
its user with an identified shutdown owner. Source release and schema recovery follow
[RELEASE_BASELINE.md](RELEASE_BASELINE.md).
