/**
 * Shared types for the source-aware reporting surfaces: SourcePicker,
 * StudioBuilder, and the KPI-tile filter logic in clients-home.
 *
 * Mirrors the GET /api/reporting/[slug]/fields response shape.
 */

export interface FieldDef {
  name: string
  type: 'date' | 'number' | 'category'
}

export interface SourceCatalog {
  /** Unique id — `drive:<filename>` for Drive files, `<source_type>:<kind>`
   *  for external facts (e.g. `posthog:opt_ins`, `stripe:cash_collected`). */
  id: string
  label: string
  kind: 'drive' | 'external'
  row_count: number
  fields: FieldDef[]
}

/**
 * True when a KPI result's source_files array intersects the selected
 * source id. Handles the `drive:<filename>` prefix encoding.
 *
 * std_lifetime_* tiles are checked separately (they always show regardless
 * of source filter) — see clients-home.tsx.
 */
export function resultMatchesSource(
  resultSourceFiles: string[] | undefined,
  selectedSourceId: string | null
): boolean {
  if (!selectedSourceId) return true
  if (!resultSourceFiles || resultSourceFiles.length === 0) return false
  if (selectedSourceId.startsWith('drive:')) {
    const filename = selectedSourceId.slice('drive:'.length)
    return resultSourceFiles.includes(filename)
  }
  // External: source_files entries from evaluateExternalAgg are
  // `<source_type>:<kind>` — match exactly.
  return resultSourceFiles.includes(selectedSourceId)
}
