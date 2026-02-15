import { describe, expect, test } from 'vitest'
import { bold, splitText, text } from './richtext.js'

describe('richtext helpers', () => {
  test('should create text item', () => {
    const item = text('hello')
    expect(item.text.content).toBe('hello')
    expect(item.annotations.bold).toBe(false)
  })

  test('should create bold item', () => {
    const item = bold('hello')
    expect(item.annotations.bold).toBe(true)
  })

  test('should split text', () => {
    const chunks = splitText('hello world', 5)
    expect(chunks).toHaveLength(3)
    expect(chunks[0].text.content).toBe('hello')
    expect(chunks[1].text.content).toBe(' worl')
    expect(chunks[2].text.content).toBe('d')
  })
})
