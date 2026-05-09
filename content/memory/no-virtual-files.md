---
name: No Virtual / Synthetic / "Bullshit" Files
description: Hard rule for this codebase — never solve a problem by manufacturing a fake file, fake row, fake table, or any other synthetic data structure that pretends to be something it isn't. Set by Mikr 2026-05-08.
type: project
priority: hard-rule
originSessionId: configure-kpis-data-sources-WPZJk
---

## The rule

**Never** synthesize a "virtual file," "synthetic file," "fake row," "wrapper object pretending to be X," or any equivalent construct in this codebase. If the engine expects shape X and the data lives as shape Y, the right move is to **make the engine understand shape Y directly** — typed, validated, named for what it actually is — not to costume Y as X.

This applies to:
- Reporting engine sources (Drive files vs external facts vs API rows)
- Any DSL that addresses data by name — names must reflect the real type/origin
- Adapter layers that paper over schema mismatches with naming conventions
- "Just for v0" shims that the next person has to live with

## Why

Virtual-file patterns:
1. **Lie about provenance.** A reader sees `posthog:opt_ins` in a formula and thinks "file" — it isn't.
2. **Inherit unsafe lookup behavior** (e.g. prefix-matching on filenames silently colliding across providers).
3. **Hide perf cliffs** — they pull whole datasets into memory because the consumer was built for in-memory rows.
4. **Block honest evolution** — once shipped, removing the costume requires touching every consumer.

## What to do instead

- Add a typed discriminator to the DSL (e.g. `AggOp.source_type`) and a real evaluation branch.
- Query the source where it lives — SQL aggregates against the facts table, real API calls, etc. — instead of pulling rows and re-aggregating in JS.
- If the engine is purely synchronous and the new path is async, **pre-walk the formulas** in the route handler and pass precomputed values (or precomputed series) into the engine via context. Don't fake the rows.
- Keep names honest — `external_fact`, `posthog_query`, `stripe_charge` — not `posthog:opt_ins.csv` or anything ending in `.virtual`.

## Enforcement

Any PR that introduces a virtual/synthetic/wrapper-as-real construct should be rejected and rewritten with a real typed path. Cite this file when calling it out.
