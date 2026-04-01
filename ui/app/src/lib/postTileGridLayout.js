/**
 * Column count from container width (px). Matches prior container-query breakpoints.
 */
export function columnCountFromContainerWidth(widthPx) {
  const w = Number(widthPx)
  if (!Number.isFinite(w) || w <= 0) return 1
  if (w >= 2000) return 7
  if (w >= 1400) return 6
  if (w >= 1040) return 5
  if (w >= 780) return 4
  if (w >= 560) return 3
  if (w >= 380) return 2
  return 1
}

/**
 * Row-major assignment: index i → column i % n.
 * Visually: first "row" is posts 0..n-1 left-to-right; next items stack under each column.
 * Each column is a vertical stack (masonry-style independent heights).
 *
 * @template T
 * @param {T[]} items
 * @param {number} columnCount
 * @returns {T[][]}
 */
export function distributePostsRoundRobin(items, columnCount) {
  const n = Math.max(1, Math.floor(columnCount))
  const cols = Array.from({ length: n }, () => [])
  for (let i = 0; i < items.length; i++) {
    cols[i % n].push(items[i])
  }
  return cols
}
