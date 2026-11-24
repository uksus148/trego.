import type { LatLon, NewPlace } from '../types'

// Demo scenario (mock mode only): Štrbské Pleso → Skok waterfall → Popradské pleso, a July hike.
// Rysy was dropped: ORS foot-hiking cannot match it (issue #49, code 2010); see api/ROUTES.md.
// Coordinates follow the OSM objects the live agent selects; real data comes from the backend.

export const DEMO_START: LatLon & { name: string } = { name: 'Štrbské Pleso', lat: 49.1191, lon: 20.0627 }

/** Synthetic UUIDs keep the mock route editor on the same wire contract as the real API. */
export const DEMO_START_PLACE: NewPlace & { id: string; source: string } = {
  id: '00000000-0000-4000-8000-000000000001',
  ...DEMO_START,
  tags: ['lake'],
  source: 'https://en.wikipedia.org/wiki/%C5%A0trbsk%C3%A9_Pleso',
}

const DEMO_FINISH: NewPlace & { id: string; source: string } = {
  id: '00000000-0000-4000-8000-000000000004',
  name: 'Popradské pleso',
  lat: 49.1534,
  lon: 20.0796,
  tags: ['lake'],
  source: 'https://en.wikipedia.org/wiki/Popradsk%C3%A9_pleso',
}

/** Stops in visit order; the last one is the finish (the mock route uses all but the last as stops). */
export const DEMO_PLACES: (NewPlace & { id: string; source: string })[] = [
  {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Skok Waterfall',
    lat: 49.1531,
    lon: 20.0453,
    tags: ['waterfall'],
    source: 'https://en.wikipedia.org/wiki/Skok_Waterfall',
  },
  DEMO_FINISH,
]

export const DEMO_END: LatLon = { lat: DEMO_FINISH.lat, lon: DEMO_FINISH.lon }
export const DEMO_ASCENT_M = 741
export const DEMO_PROMPT =
  'Plan a summer hike in July from Štrbské Pleso to Popradské pleso via the Skok waterfall. I love wild scenery.'
