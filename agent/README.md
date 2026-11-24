# trego. AI agent

Python understands a walking request, finds and verifies places, and asks Java to
save them and calculate a route. Java owns routing and PostgreSQL; the frontend
owns the map. A model response alone never proves that a place or route is correct.

<a id="source-grounded-place-discovery"></a>

## Read and work here

1. [ARCHITECTURE.md](ARCHITECTURE.md): responsibilities, data flow, safeguards,
   open questions and the replacement plan. This is our single working notebook.
2. [VERIFY.md](VERIFY.md): checks without team keys, provider probes, diagnostics
   and the limits of each kind of evidence.
3. [Accepted handoff](../docs/API_CONTRACT.md) and [root decisions](../CLAUDE.md):
   authoritative shared contracts. The notebook cannot override them.

The [availability core](AVAILABILITY.md) is implemented internally but disconnected
from chat/startup. Older agent guide paths are short compatibility links; their
superseded reports remain in Git history. Do not add another report for each task.

## Install and run the existing service

Python 3.11+ is required; CI uses 3.12. From `agent/`:

```powershell
uv sync --frozen --extra test
uv run --frozen uvicorn gopstop_agent.main:app --app-dir src --host 127.0.0.1 --port 8000 --log-config logging.json
```

Without uv, use `python -m venv .venv`, then
`.venv\Scripts\python.exe -m pip install -e ".[test]"` on Windows. Run commands
through that environment's Python. Prefer uv's frozen lock for reproducibility.

Settings read the private repository-root `.env` and process environment. See
[.env.example](../.env.example) and [config.py](src/gopstop_agent/config.py).
Do not publish keys or point experiments at team storage by accident.

- `AGENT_CHAT_ENABLED=false` is the default: it saves an exchange and returns a
  placeholder, rather than researching places. Storage is still required.
- Enabled chat needs `EXA_API_KEY`, the selected model key and Valkey. Explicitly
  set `AGENT_LLM_PROVIDER=groq` and `GROQ_API_KEY`, or `anthropic` and
  `ANTHROPIC_API_KEY`; the source default is Anthropic, the example selects Groq.
- Groq's allowlist is `openai/gpt-oss-20b`, `openai/gpt-oss-120b` and
  `qwen/qwen3.8-27b`. Choose with `AGENT_GROQ_MODEL`; compare profiles separately.
  Anthropic uses `AGENT_ANTHROPIC_MODEL`. Configuration is not a live access check.
- `AGENT_VALKEY_URL` falls back to `SPRING_DATA_REDIS_URL`, then local port 6379.
  `AGENT_API_BASE_URL` defaults to `http://localhost:8080` for real Java handoff.
- Nominatim uses `AGENT_NOMINATIM_BASE_URL` and an identifying
  `AGENT_NOMINATIM_USER_AGENT`; the configured public endpoint needs no API key.
- Browser CORS defaults to `http://localhost:5173`. Set `AGENT_CORS_ORIGINS` to
  a JSON list containing the frontend's actual origin, then restart the agent.

Follow [verification](VERIFY.md) before enabling real chat. Startup validates
configuration, not provider access, API migrations or route correctness.
The local Agent Lab exists in separate, uncommitted development work; its launcher
and payload inspector are not included in this documentation-only change.

## Stable boundary

`POST /api/chat` accepts only `{sessionId, message}`: nonblank strings, at most
128 and 4000 characters respectively. It returns `{reply, places, routeId?}`.
Only a validated saved-route readback permits `routeId`. Clarification has no
route ID. Unknown fields/invalid input return 422; overlapping turns in one
session return 409; dependency failures 502; cache/storage failures 503;
deadlines 504. Never replay an uncertain write automatically.

Current routing is walking. Preferences do not change ORS geometry. Cycling,
transit, day planning, embeddings and uploads are deferred; public availability
research also needs owner agreement. Local simulation cannot certify any of them.
