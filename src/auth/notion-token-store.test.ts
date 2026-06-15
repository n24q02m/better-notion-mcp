import { describe, expect, it } from 'vitest'
import { NotionTokenStore, type NotionTokenStoreLike } from './notion-token-store.js'

describe('NotionTokenStore', () => {
  it('saves and retrieves token by sub', () => {
    const store = new NotionTokenStore()
    store.save('user-123', 'secret_abc')
    expect(store.get('user-123')).toBe('secret_abc')
  })

  it('returns undefined for unknown sub', () => {
    const store = new NotionTokenStore()
    expect(store.get('ghost')).toBeUndefined()
  })

  it('overwrites existing token', () => {
    const store = new NotionTokenStore()
    store.save('u1', 'old')
    store.save('u1', 'new')
    expect(store.get('u1')).toBe('new')
  })
})

describe('NotionTokenStoreLike interface', () => {
  it('NotionTokenStore satisfies the interchangeable store interface', () => {
    const store: NotionTokenStoreLike = new NotionTokenStore()
    store.save('u', 't')
    expect(store.get('u')).toBe('t')
    store.clear('u')
    expect(store.get('u')).toBeUndefined()
  })
})
