import { describe, expect, it } from 'vitest'
import { readDocumentation } from './registry.js'

describe('Registry Documentation Helper', () => {
  it('should read existing documentation file', () => {
    // Use a known file like 'pages.md' which we verified exists in src/docs
    const content = readDocumentation('pages.md')
    expect(content).toBeTruthy()
    expect(typeof content).toBe('string')
    // Basic check to ensure we got some content
    expect(content.length).toBeGreaterThan(10)
  })

  it('should throw error when file does not exist', () => {
    expect(() => readDocumentation('does-not-exist-12345.md')).toThrow()
  })
})
