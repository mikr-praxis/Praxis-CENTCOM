/**
 * Skeleton primitives — content-shaped loading placeholders.
 *
 * Use these instead of raw spinners on slow-fetch surfaces. The goal is for
 * the skeleton to occupy the same footprint the real content will, so the
 * layout doesn't shift the moment data arrives. Use a spinner only for
 * inline button states / micro-async (e.g. "Saving…").
 *
 * Primitives:
 *   <Skeleton />          - single grey rectangle (configurable className)
 *   <SkeletonText lines /> - several thin lines, like a paragraph
 *   <SkeletonCard />       - a card-sized block w/ title + 2 lines
 *   <SkeletonRow cols />   - a row of cells, like a table row
 *
 * Compositions (preset shapes used across the app):
 *   <SkeletonTileGrid n />     - n KPI tiles in a responsive grid
 *   <SkeletonChart />          - a chart-sized rectangle w/ axis hints
 *   <SkeletonList rows cols /> - a column of N rows × M cells
 */
import { clsx } from 'clsx'

/** Single pulsing rectangle. Pass className to size it. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={clsx(
        'animate-pulse rounded-md bg-slate-700/40',
        className
      )}
    />
  )
}

/** A short paragraph of pulsing lines. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={clsx('space-y-2', className)} role="status" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={clsx(
            'h-3',
            // last line a bit shorter, like a real paragraph
            i === lines - 1 ? 'w-3/5' : 'w-full'
          )}
        />
      ))}
    </div>
  )
}

/** A card-sized block: small title + two body lines. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 space-y-3',
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-2 w-1/2" />
    </div>
  )
}

/** A horizontal row of pulsing cells. */
export function SkeletonRow({
  cols = 4,
  className,
}: {
  cols?: number
  className?: string
}) {
  return (
    <div className={clsx('flex gap-3', className)} role="status" aria-label="Loading">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
  )
}

/* ──────────────────────── presets ──────────────────────── */

/** KPI tile grid — matches the layout in KPICardGrid. */
export function SkeletonTileGrid({ n = 6 }: { n?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {Array.from({ length: n }).map((_, i) => (
        <SkeletonCard key={i} className="h-28" />
      ))}
    </div>
  )
}

/** Chart-shaped block with an x-axis suggestion. */
export function SkeletonChart({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-slate-700/50 bg-slate-900/40 p-4',
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <Skeleton className="h-3 w-32 mb-4" />
      <Skeleton className="h-40 w-full mb-3" />
      <SkeletonRow cols={6} className="h-2 opacity-60" />
    </div>
  )
}

/** Vertical list of skeleton rows — like a table body before data arrives. */
export function SkeletonList({
  rows = 5,
  cols = 4,
  className,
}: {
  rows?: number
  cols?: number
  className?: string
}) {
  return (
    <div className={clsx('space-y-2', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} className="py-1" />
      ))}
    </div>
  )
}
