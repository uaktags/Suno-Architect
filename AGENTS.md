# AGENTS.md - Suno-Architect

## Stack (Use These Assumptions)
- Runtime/package manager: `bun` (preferred)
- Frontend: `Vite` + `React` + `TypeScript`
- Styling: `Tailwind CSS` (v4 via `@tailwindcss/vite`)
- Drag/drop: `@dnd-kit`
- Offline storage: `IndexedDB` via `idb`
- Deploy target: `Cloudflare Workers` + static assets via `Wrangler`

## Commands (Bun First)
- Install: `bun install`
- Dev: `bun run dev`
- Build: `bun run build`
- Preview: `bun run preview`

## Deployment Notes (Wrangler)
- `wrangler.toml` is configured to build with Bun (`[build].command = "bun run build"`).
- Worker entrypoint: `functions/_worker.ts`
- Static assets served from: `dist` via Wrangler `[assets]`
- Deploy command (when ready): `bunx wrangler deploy`
  - Alternative: `wrangler deploy` if Wrangler is installed globally

## AI Editing Guidance
- Prefer updating existing patterns/components instead of introducing parallel abstractions.
- Validate changes with `bun run build` before finishing.
- If changing offline album/track features, check both:
  - `src/services/offlineDb.ts`
  - corresponding UI section(s) under `src/components`
