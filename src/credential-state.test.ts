/**
 * Tests for credential state management.
 */

import { execFile } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tryOpenBrowser } from './credential-state.js'

vi.mock('node:child_process', () => ({
  execFile: vi.fn()
}))

describe('tryOpenBrowser', () => {
  const originalPlatform = process.platform

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  it('calls open on darwin', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    tryOpenBrowser('https://example.com')
    expect(execFile).toHaveBeenCalledWith('open', ['https://example.com'], expect.any(Function))
  })

  it('calls cmd on win32', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    tryOpenBrowser('https://example.com')
    expect(execFile).toHaveBeenCalledWith('cmd', ['/c', 'start', '', 'https://example.com'], expect.any(Function))
  })

  it('calls xdg-open on other platforms', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    tryOpenBrowser('https://example.com')
    expect(execFile).toHaveBeenCalledWith('xdg-open', ['https://example.com'], expect.any(Function))
  })

  it('should NOT call execFile for dangerous URLs', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })

    const dangerousUrls = [
      'file:///etc/passwd',
      'javascript:alert(1)',
      'https://example.com --flag',
      'https://example.com/ path with spaces',
      '-flag'
    ]

    for (const url of dangerousUrls) {
      tryOpenBrowser(url)
    }

    // This is expected to FAIL before the fix
    expect(execFile).not.toHaveBeenCalled()
  })
})
