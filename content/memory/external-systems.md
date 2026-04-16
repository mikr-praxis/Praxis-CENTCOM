---
name: External Systems
description: URLs and identifiers for Vercel, GitHub, Supabase, and other external services
type: reference
originSessionId: 153d7d76-ae1f-470b-94ca-62a7f0119b80
---
- **Vercel:** project `praxis-centcom`, team `mscott-8907s-projects`, URL `praxis-centcom.vercel.app`
- **GitHub:** repo `mikr-praxis/Praxis-CENTCOM`
- **Supabase:** referenced via `NEXT_PUBLIC_SUPABASE_URL` env var (check Vercel for actual value)
- **Clerk:** auth provider, `@clerk/nextjs` v7 — sign-in/sign-up at catch-all routes
- **Cloudflare:** DNS proxy (free tier)
- **GCP:** project `unified-atom-492422-n5`, service account for Calendar API
- **PostHog:** analytics, keys in `NEXT_PUBLIC_POSTHOG_HOST` and `NEXT_PUBLIC_POSTHOG_KEY`
