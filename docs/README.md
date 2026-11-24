# Documentation map

Read [CLAUDE.md](../CLAUDE.md) first for shared instructions and ownership. Then open
only the contract and service guide relevant to the task. Git history and PR discussions
retain completed handoffs, old schedules and test-run evidence.

## Authoritative references

| Question | Source |
|---|---|
| What does trego. do, and how do I start? | [Project README](../README.md) |
| Who owns the change and what rules apply? | [CLAUDE.md](../CLAUDE.md), [contributing and repository rules](../CONTRIBUTING.md) |
| What crosses service boundaries? | [API/chat contract](API_CONTRACT.md) |
| How do verified landmark photos work? | [Media contract](LANDMARK_PHOTOS_CONTRACT.md) |
| How does saved-route editing work? | [Editing contract](ROUTE_EDITING_CONTRACT.md) |
| How do we run a live integrated check? | [Integration runbook](INTEGRATION_RUNBOOK.md) |
| How do we verify a source release or recover it? | [Recovery guide](RELEASE_BASELINE.md) |
| How do we conserve shared cloud resources? | [Local resource rules](../infra/README.md#local-development-resource-rules) |

## Implementation and operation

| Component | Guides |
|---|---|
| Java API | [Code map and setup](../api/README.md), [ingestion](../api/INGESTION.md), [routing](../api/ROUTES.md) |
| Media/editor backend | [Media](../api/MEDIA.md), [editing](../api/ROUTE_EDITING.md) |
| Agent | [Setup](../agent/README.md), [architecture and working notebook](../agent/ARCHITECTURE.md), [verification](../agent/VERIFY.md) |
| Frontend | [Setup and feature flags](../frontend/README.md) |
| Local dependencies/container | [Infrastructure](../infra/README.md), [Java container](../api/CONTAINER.md) |
| Automated integration | [Disposable fixture acceptance](../tests/integration/README.md) |

## Deferred proposal

[Availability research](ROUTE_AVAILABILITY_CONTRACT.md) retains the selected wire
proposal; [the internal core](../agent/AVAILABILITY.md) remains a separate agent-owned guide. Public chat activation remains
deferred. Other deferred directions are listed in CLAUDE.md. Read a proposal only
when working on that capability; it does not extend the current API.

## Updating documentation

Keep each current rule in its authoritative document and link from consumers.
Service guides own executable commands and implementation details. Update the shared
contract when behavior changes; keep examples synchronized with code and tests.
Record run-specific SHA/model/results in PR evidence rather than copying historical
test counts into every guide. Delete completed one-off plans after their remaining
invariants and operational instructions have been incorporated into current references.
