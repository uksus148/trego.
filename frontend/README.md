# trego. Frontend

React 19 + TypeScript + Vite + Tailwind 4 + MapLibre (OpenFreeMap tiles, no key needed).

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # vitest
npm run build
```

Configuration comes from the root `.env` (copy `/.env.example`):

- `VITE_USE_MOCKS=true` (default) — the app runs fully in the browser with the Tatras demo route and synthetic local illustrations.
- `VITE_USE_MOCKS=false` — calls the real services at `VITE_API_BASE_URL` and `VITE_AGENT_BASE_URL`.
- `VITE_ENABLE_ROUTE_EDITOR=true` — opt in to the real route editor only after the matching Java API endpoint and optional binding fields are deployed. It defaults off in real-service mode; mock mode enables it automatically.

The mock route and editing-context registries are in memory. Reloading a mock-created route cannot restore it; real-route reload is handled by the API using only the active route ID in tab-scoped session storage.

Where things live:

- `src/types.ts` — the API contract shared with `api` and `agent` (mirrors docs/API_CONTRACT.md).
- `src/api/` — real client and in-browser mock.
- `src/components/` — map, chat, manual planning, route editor, and photos along the route.

## MapLibre and Vite integration notes

MapLibre 6 with Vite requires an explicit worker URL; keep the worker setup in
`src/components/MapView.tsx` when changing bundling. MapLibre CSS overrides
Tailwind's `absolute` utility on the map element, so keep the map inside its
positioned wrapper rather than relying on that utility for the canvas container.
