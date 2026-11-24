# Forja Works | Pulse v4 Glass demo

Frontend-only demo for Caio Pazini and Joyce at Forja Works, built on the Pulse Harbour template. Demo day is Tuesday 24 November 2026 (Europe/Dublin). Every name, amount and date is illustrative and the workspace is marked "Demo data". Nothing is sent, charged or synced.

## Forja layer

| Area | Where |
| --- | --- |
| Seeded state, one source of truth | `src/forja/seed.ts`, `src/forja/types.ts` |
| Mutations (idempotent, role-gated, persisted to localStorage) | `src/forja/store.ts` |
| Derived roll-ups: gates, capacity, costing, exceptions, briefing, portal payload | `src/forja/derive.ts` |
| Screens for Estimates, Jobs, Workshop, Purchasing, Job Costing, Dashboard, Work, Activity, Agents, Settings, Records tabs | `src/forja/views/` |
| Client portal, workshop TV, phone view (standalone layouts) | `#/portal/FW-263/programme`, `#/tv`, `#/phone` |
| Deep links | `#/Jobs/live/FW-261`, `#/Workshop/capacity`, `#/Purchasing/shortages/FW-262` ... |

Reset the seeded Tuesday from Settings, Experience, Reset demo.

---

# Pulse — Harbour

React build of the **Pulse v5 Harbour** design from Claude Design, the operations dashboard mocked up for Kilbride Group.

Every page, theme and interaction from the design is here. Screens were checked against the original mockup and match pixel for pixel at 1440×900 and 1024×720.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
```

## What's in it

| Area | Where |
| --- | --- |
| Pages: Home (Helios chat), Agents, Dashboard, Work, Records, Activity, Settings | `src/views/pages/` |
| Overlays: ⌘K palette, agent studio, Helios mini chat, work viewer, new record, background gallery | `src/views/overlays/` |
| App frame: sidebar, top bar, notifications | `src/views/AppShell.tsx` |
| State and behaviour | `src/logic/PulseLogic.js` |
| Demo data (Kilbride Group) | `src/logic/data.js` |
| Agent avatar | `src/components/AgentFace.tsx` |
| Theme tokens (Harbour, light and 11 more), animations | `src/styles/pulse.css` |

## How it fits together

- **`PulseLogic`** holds all state. Its `renderVals()` returns one flat object `v`.
- **Views** are plain React components that render from `v`.
- **`LogicHost`** (`src/runtime/logic.tsx`) mounts the logic and re-renders on `setState`.
- **Backgrounds** live in `src/App.tsx`:
  - `dashboardBackdrop`: the colour of the Dashboard KPI background
  - `kpiBackdropOn`: whether that background shows
  - `recordsBackdrop`: the colour of the Records wash (`""` uses the theme gradient)
- **Customising for a client:** read `CLAUDE.md` first. It lists the layout rules every copy keeps.

## Updating from Claude Design

Export the new version, replace the file in `design/`, then run:

```bash
npm run import-design
```

This regenerates:

- `src/views/`
- `src/styles/pulse.css`
- `src/styles/interactions.css`
- `src/logic/`

`AgentFace` is hand-written and left alone. Commit before running, because it overwrites hand edits to those files.

## Fixed from the mockup

In the mockup, the work viewer's wrapper `<div>` was never closed. As a result, the ⌘K palette, agent studio, new record dialog and background gallery could only appear while the work viewer was open. They now open on their own. The fix is applied in `tools/import-design.mjs`.
