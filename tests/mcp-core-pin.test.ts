import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('mcp-core dependency pin', () => {
  it('depends on a release shipping the CfKv + EdDSA seam (>=1.18.0-beta.5)', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as {
      dependencies: Record<string, string>
    }
    const core = pkg.dependencies['@n24q02m/mcp-core']
    expect(core).toBeDefined()
    // Parse the version floor (strip a leading ^/>=/~ range operator). Compare as
    // a version rather than asserting a literal substring, so a future floor bump
    // within 1.18.x (e.g. beta.6) or a stable 1.18.0 release does not break this
    // test (the brittleness that turned imagine's pin test red on the b5->b6 bump).
    const m = /(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?/.exec(core ?? '')
    expect(m).not.toBeNull()
    const maj = Number(m![1])
    const min = Number(m![2])
    const pat = Number(m![3])
    const beta = m![4] === undefined ? Number.NaN : Number(m![4])
    // floor must be >= 1.18.0-beta.5: a stable >=1.18.0, OR a 1.18.0 beta >=5.
    const atLeast =
      maj > 1 ||
      (maj === 1 && min > 18) ||
      (maj === 1 && min === 18 && pat > 0) ||
      (maj === 1 && min === 18 && pat === 0 && (Number.isNaN(beta) || beta >= 5))
    expect(atLeast).toBe(true)
  })
})
