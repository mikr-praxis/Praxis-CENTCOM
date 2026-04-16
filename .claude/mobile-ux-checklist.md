# Mobile UX Checklist — CentCom

**Rule #1: Never ship a feature that breaks mobile.**

Every commit that touches layout, positioning, or interactive elements MUST be checked against this list before pushing.

## Fixed/Floating Elements

- Any `fixed` or `sticky` positioned element MUST include `hidden md:block` (or equivalent) unless it's been explicitly designed and tested for mobile
- Never use `z-50` on a floating element without confirming it doesn't overlap form inputs, buttons, or navigation on small screens
- The mobile bottom nav is `h-16` — any fixed bottom element must account for this
- `bottom-4 right-4` on mobile = directly over the bottom-right corner where submit buttons often land

## Forms on Mobile

- Submit buttons inside grid layouts MUST be full-width on mobile: `w-full sm:w-auto`
- If a form has 4+ fields in a grid, the submit button should either be pulled out of the grid on mobile or given `col-span-full`
- `grid-cols-1` on mobile means every field stacks — the submit button ends up below the fold. Consider reordering or making key fields span wider: `sm:col-span-2 lg:col-span-1`
- Always test that the submit button is visible without scrolling when the form first opens

## Viewport & iOS

- Use Next.js `export const viewport: Viewport` — NOT `metadata.viewport` or a manual `<meta>` tag
- Include `maximumScale: 1` to prevent iOS auto-zoom on input focus (16px font minimum also helps)
- Never duplicate viewport config in multiple places — single source of truth in `app/layout.tsx`

## Before Every Push

1. Does this commit add or move any `fixed` / `absolute` / `sticky` element? → Check mobile
2. Does this commit change a form layout or button position? → Check mobile
3. Does this commit add `z-*` classes? → Check what's underneath on mobile
4. Does this commit touch `pb-*` or `mb-*` on the main content area? → Check bottom nav overlap

## Mistakes Made (Log)

- **2026-04-05**: DeployStatus widget at `fixed bottom-4 right-4 z-50` with no mobile hiding — covered the task form submit button on phones, completely blocking task creation. Fixed by adding `hidden md:block`.
- **2026-04-05**: Task form "Add Task" button was 5th item in single-column grid on mobile, easy to miss and covered by floating widget. Fixed with `w-full sm:w-auto`.
- **2026-04-05**: Viewport meta was duplicated in both `metadata.other` and a manual `<head>` tag. Cleaned up to single `export const viewport` approach.
