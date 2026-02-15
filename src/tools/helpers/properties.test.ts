import { describe, expect, test } from 'vitest'
import { convertToNotionProperties } from './properties.js'

describe('properties helpers', () => {
  test('should convert string to select', () => {
    const props = convertToNotionProperties({ Status: 'Done' })
    expect(props).toEqual({ Status: { select: { name: 'Done' } } })
  })

  test('should convert number', () => {
    const props = convertToNotionProperties({ Count: 10 })
    expect(props).toEqual({ Count: { number: 10 } })
  })
})
