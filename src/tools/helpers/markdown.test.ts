import { describe, it, expect } from 'vitest'
import { parseRichText } from './markdown'

describe('parseRichText', () => {
  it('parses simple text', () => {
    const result = parseRichText('hello world')
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('hello world')
  })

  it('parses simple link', () => {
    const result = parseRichText('[link](url)')
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('link')
    expect(result[0].text.link?.url).toBe('url')
  })

  it('parses nested brackets in link text', () => {
    // Current implementation behavior: [ a [ b ](c) ] -> Link " a [ b " to "c", then " ]"
    const result = parseRichText('[ a [ b ](c) ]')
    expect(result).toHaveLength(2)
    expect(result[0].text.content).toBe(' a [ b ')
    expect(result[0].text.link?.url).toBe('c')
    expect(result[1].text.content).toBe(' ]')
  })

  it('parses invalid link as text', () => {
    const result = parseRichText('[ not a link ]')
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('[ not a link ]')
  })

  it('handles deeply nested invalid brackets without crashing', () => {
    const text = '[[[[[[[[[[ text ]]]]]]]]]]'
    const start = performance.now()
    const result = parseRichText(text)
    const end = performance.now()
    expect(result).toBeDefined()
    expect(end - start).toBeLessThan(1000) // Should be very fast
  })

  it('handles large input with quadratic complexity vulnerability', () => {
    const n = 200000
    const text = '['.repeat(n)
    const start = performance.now()
    parseRichText(text)
    const end = performance.now()
    // With N=50000, O(N^2) would be > 1s easily.
    // We expect < 200ms for linear time.
    expect(end - start).toBeLessThan(100)
  })
})

it('handles invalid link followed by valid link', () => {
  // Regression test for [Link 1] plain text [Link 2](url)
  const text = '[Link 1] plain text [Link 2](url)'
  const result = parseRichText(text)
  // Should be: "[Link 1] plain text ", "Link 2" (link)
  // Actually, parseRichText returns array of RichText.
  // So 1st item: text "[Link 1] plain text "
  // 2nd item: link "Link 2"
  expect(result).toHaveLength(2)
  expect(result[0].text.content).toBe('[Link 1] plain text ')
  expect(result[1].text.content).toBe('Link 2')
  expect(result[1].text.link?.url).toBe('url')
})
