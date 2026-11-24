# Baseline fixture acceptance

Owner: Murat; frontend boundary review: Daniil; agent fixture review: Mukhamed.

## Run

Prerequisites: Docker with sufficient disk, JDK21+, Maven, Node24+, Python3.12 and uv.
On Linux, install Chromium system libraries with Playwright's `install --with-deps
chromium` command first (CI does this). From the repository root:

```sh
bash tests/integration/check.sh
```

The wrapper installs frozen dependencies and Chromium, then runs the baseline. With
dependencies already installed, `python tests/integration/run.py` runs just the stack.
Its `--python /absolute/path/to/python` option can reuse an existing synced agent
environment. There are no required cloud keys or root `.env` edits.

## What is real and what is a fixture

Real React/Vite, FastAPI factories/discovery/handoff/sessions, Java HTTP/JPA/Flyway,
canonical PostgreSQL18/PostGIS/pgvector and Valkey run on disposable loopback ports.
The API uses a clean Maven build; applied Flyway script names must exactly match
this checkout's sources, so stale target files from another branch cannot leak in.
All migrations in the current checkout, including V4, are verified. No shared Compose
volumes, Aiven services or production data are used.
The runner removes only its own container IDs and process groups, including on failure.

Groq20B responses are synthetic structured JSON, not model execution. Exa and
Nominatim HTTP are strict in-process fixtures. The agent transport forwards only
the exact local Java API origin and rejects unknown provider hosts/paths. Its negative
test proves there is no network fallback. Java ORS points at a local strict HTTP fixture;
media uses a synthetic local catalog, automatic discovery is disabled, and unused
metadata endpoints point at the local fixture too. Browser routing supplies a blank
map style, empty font CSS and a synthetic image, and rejects other external URLs. This verifies
integration and error handling, not live geographic correctness or photographic rights.

Child environments are constructed from an allowlist. Spring config import is empty,
the test agent disables dotenv before importing its default app, and the test Vite
config disables envDir while reusing production plugins. No developer keys are read
to configure these services. Package/image downloads happen during setup, outside
the provider-fixture boundary. This is application-level containment, not an OS sandbox.

## Assertions and known findings

The shared [baseline corpus](../../docs/contracts/baseline.examples.json) uses only
accepted Route/Place/chat semantics. Java, Python and TypeScript consume it directly;
no schema generator or duplicate editor DTO is introduced. The actual-service run
checks sources/coordinates, ordered X→A→X visits, independent route GET, a distinct
saved ID without a second ORS request, incomplete-intent zero writes, persisted chat
history, both database extensions, and catalog/empty media results. Browser checks
use the real chat/API, inject a media-only503, and require exactly one GET on Retry
without another POST or lost route.
The browser readback is matched to the routeId returned by that browser's chat
response, not a setup route. A failed readback must not append a new ready reply;
any retained route must separately show a visible previous-route status label.

The two #82 defects were corrected by merged #86. Their browser assertions are now
ordinary required regressions: a failed readback must suppress a new ready reply
and label any retained previous route; invalid route200 must remain recoverable
without blanking React. A separate manual-planner browser case intercepts writes to verify
that stop changes label the saved route as previous without changing its track or starting
a new build. All four baseline browser cases must pass, with no failures or skips.

The synthetic provider protocol follows merged #78: complete and incomplete intents
explicitly carry advisory `descriptiveTargets: []`, and research uses the exact-target
query prefix. A factory-level compatibility test exercises both cases through actual
discovery. Named fixture targets never gain descriptive authorization; unexpected
provider/query protocols still fail closed.

The baseline has four browser cases; the editor profile has six. Factory compatibility
checks exercise the current strict intent/discovery protocol. This corpus does not
provide exhaustive coverage of model behavior, same-session races, live quotas,
all geographic identities, public API security or navigation safety. Read the agent
unit suites alongside it when changing identity/session logic.

## CI and evidence

`acceptance.yml` runs the stack for service/infra/corpus/harness changes.
`frontend.yml` adds frontend tests/build/lint for frontend/shared examples.
Existing API/agent workflows and main rulesets are unchanged; these conditional jobs
are not made globally required checks. #80's API-workflow edit is not overwritten.

Ignored `api/target/fixture-e2e/` contains service/build logs, exact Git revision and
working-tree diff digest, assertions, provider counts and Playwright JSON. CI uploads
only named synthetic logs and JSON, for seven days. Logs redact checkout paths and
fixture credentials; no HAR, trace, video, .env or generic target archive is uploaded.
Inputs are synthetic public constants; never point this harness at private locations.
Existing unit suites and actual-service fixtures remain separate from live evidence.

Review `run.py` for process/DB isolation and HTTP assertions, `fixture_agent.py` for
provider boundaries, then `baseline.spec.ts` for required UI regressions.
Shared-owner review and a reviewed integrated revision remain necessary before merge.

## Saved-route editor profile

With the matching API and frontend editor, run `bash tests/integration/check.sh --editor`.
This enables the real editor for the local frontend and adds two browser cases.
The manual case starts from an API save, removes one repeated visit, reorders the
remaining visits, swaps endpoints and explicitly binds an endpoint to a saved Place.
It verifies the new route/context, unchanged source route, preserved preferences,
reload restoration and zero agent requests during editing. Baseline provider calls
remain explicit fixtures; this is not live geographic acceptance. CI runs this profile.

The chat-origin case keeps both legacy endpoints unbound. It injects an HTML gateway
timeout on the first rebuild, then checks that declining confirmation sends no second
POST. An explicitly confirmed rebuild saves a new route. Only the next explicit chat
prompt starts a fresh agent session, with the original plan kept in read-only history.

The runner applies current migrations and validates their names against the checkout.
Record current counts and results from the generated report. Historical run counts
belong to PR #85/#87 and do not describe a new checkout's verification.
