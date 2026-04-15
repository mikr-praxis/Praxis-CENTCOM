@AGENTS.md

## Stack
- Next.js 16.2.2 / React 19 / TypeScript
- Supabase (Postgres + Realtime)
- Clerk v7 (auth)
- Tailwind CSS v4 — slate-950 dark theme, amber-400 accent
- Recharts for data viz
- Lucide React for icons
- clsx for conditional class merging

## Conventions
- Pages: Server component fetches with `auth()` + `createServerClient()`, passes data to `*Client` component
- Server actions: `actions/*.ts` with `'use server'`, auth guard, `revalidatePath()`
- Types: All Supabase row types in `lib/supabase/types.ts`
- Components: Feature components in `components/<feature>/`, shared UI in `components/ui/`
- Hooks: `hooks/use*.ts` with useState, useTransition, Supabase realtime subscriptions
- All tables: `user_id` text scoping (Clerk ID), uuid PK, `created_at` timestamptz
- Migrations: `supabase/migrations/NNN_name.sql` (sequential numbering)
- Mobile: Check `.claude/mobile-ux-checklist.md` before touching fixed/sticky/z-index elements

## Key Files
- `app/(app)/layout.tsx` — App shell with Sidebar + TopBar
- `components/layout/Sidebar.tsx` — Navigation links (add new routes here)
- `lib/supabase/types.ts` — All Supabase table types + Database type
- `lib/supabase/server.ts` — Server-side Supabase client factory
- `lib/supabase/client.ts` — Browser-side Supabase client singleton
- `middleware.ts` — Clerk auth middleware (protects non-public routes)
- `scripts/seed.ts` — Database seeding script
