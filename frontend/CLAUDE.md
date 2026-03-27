@../../CLAUDE.md
@AGENTS.md

## Frontend Module — Mateusz Only

This is the demo UI for the Process-to-Automation Copilot. It talks to the FastAPI backend at `http://localhost:8000`.

### Stack
- Next.js 16 (App Router, Server Components default)
- shadcn/ui + Tailwind CSS
- Recharts or Plotly.js for process visualization
- bpmn-js for BPMN diagram rendering

### Pages
- `/` — Upload page: drag-and-drop CSV upload, calls `POST /api/upload`
- `/process/[id]` — Process view: shows discovered process map, variants, statistics
- `/process/[id]/analyze` — Analysis view: AI recommendations, bottlenecks, BPMN preview

### Key Rules
- All data comes from the FastAPI backend, not from Next.js API routes
- Use Server Components for data fetching, Client Components for interactive charts
- Dark mode default (zinc/neutral palette, one accent color)
- Geist Sans for text, Geist Mono for data/metrics
