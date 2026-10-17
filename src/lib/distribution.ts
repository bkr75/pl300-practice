/**
 * Split `requested` questions across domains proportionally to how many
 * questions each domain has available (which mirrors the official exam
 * weights for this bank), using the largest-remainder method.
 *
 * Guarantees:
 *  - the counts always sum to min(requested, total available)
 *  - a domain never receives more than it has available
 *  - each domain gets either floor(quota) or ceil(quota), where
 *    quota = requested * available / total
 *
 * Ties on the fractional part go to the domain with more questions available,
 * then to the earlier domain in `available`, so the result is deterministic.
 */
export function distribute(
  requested: number,
  available: Readonly<Record<string, number>>,
): Record<string, number> {
  const keys = Object.keys(available)
  const total = keys.reduce((sum, k) => sum + Math.max(0, available[k]), 0)
  const target = Math.max(0, Math.min(Math.floor(requested), total))
  const result: Record<string, number> = {}
  for (const k of keys) result[k] = 0
  if (target === 0 || total === 0) return result

  const quotas = keys.map((key, order) => {
    const avail = Math.max(0, available[key])
    const exact = (target * avail) / total
    const base = Math.floor(exact)
    return { key, order, avail, base, frac: exact - base }
  })

  let assigned = 0
  for (const q of quotas) {
    result[q.key] = q.base
    assigned += q.base
  }

  const byRemainder = quotas
    .filter((q) => q.base < q.avail)
    .sort((a, b) => b.frac - a.frac || b.avail - a.avail || a.order - b.order)

  // Hand out the remaining seats one at a time (a second pass only runs if
  // floating point error left more seats than domains with a positive fraction).
  while (assigned < target) {
    let progressed = false
    for (const q of byRemainder) {
      if (assigned >= target) break
      if (result[q.key] < q.avail) {
        result[q.key] += 1
        assigned += 1
        progressed = true
      }
    }
    if (!progressed) break
  }
  return result
}

/** "Prepare 8 · Model 8 · Visualize 8 · Manage 6" style summary. */
export function describeDistribution(
  counts: Readonly<Record<string, number>>,
  shortName: (domain: string) => string,
): string {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([domain, n]) => `${shortName(domain)} ${n}`)
    .join(' · ')
}
