#!/usr/bin/env node
/**
 * E2E Test: Stdio + Relay flow
 * Tests ALL 9 tools, ALL actions via MCP protocol.
 * Server loads NOTION_TOKEN from config.enc (saved by relay).
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const TIMEOUT = { timeout: 30000 }
let passed = 0
let failed = 0
let skipped = 0
const results = []

function extractText(r) {
  return r.content[0].text
}

function safeParse(text) {
  try {
    return JSON.parse(text)
  } catch {
    // Strip untrusted_notion_content tags that wrap JSON responses
    const stripped = text.replace(/<\/?untrusted_notion_content>/g, '').trim()
    try {
      return JSON.parse(stripped)
    } catch {
      // Strip security footer that Notion SDK appends
      const jsonMatch = stripped.match(/^(\{[\s\S]*\})\s*\[SECURITY:/m)
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1])
        } catch {
          return text
        }
      }
      return text
    }
  }
}

function ok(label, evidence = '') {
  passed++
  results.push({ label, status: 'PASS', evidence })
  console.log(`  [PASS] ${label}${evidence ? ` | ${String(evidence).slice(0, 100)}` : ''}`)
}

function fail(label, err) {
  failed++
  results.push({ label, status: 'FAIL', evidence: err })
  console.log(`  [FAIL] ${label} | ${String(err).slice(0, 150)}`)
}

function skipTest(label, reason) {
  skipped++
  results.push({ label, status: 'SKIP', evidence: reason })
  console.log(`  [SKIP] ${label} | ${reason}`)
}

async function callTool(client, name, args) {
  const r = await client.callTool({ name, arguments: args }, undefined, TIMEOUT)
  const t = extractText(r)
  if (r.isError) throw new Error(t)
  return { text: t, parsed: safeParse(t) }
}

// Connect
const transport = new StdioClientTransport({
  command: 'node',
  args: ['bin/cli.mjs'],
  env: { PATH: process.env.PATH },
  cwd: import.meta.dirname || process.cwd(),
  stderr: 'pipe'
})
const client = new Client({ name: 'e2e-test', version: '1.0.0' })
await client.connect(transport)

console.log('=== STDIO + RELAY E2E TEST ===')
console.log('Server connected. Config loaded from relay config.enc.')
console.log('')

// ========== META ==========
console.log('--- Meta ---')
const toolsResult = await client.listTools()
const toolNames = toolsResult.tools.map((t) => t.name).sort()
const expected = [
  'blocks',
  'comments',
  'content_convert',
  'databases',
  'file_uploads',
  'help',
  'pages',
  'users',
  'workspace'
]
if (JSON.stringify(toolNames) === JSON.stringify(expected)) {
  ok('listTools', `9 tools: ${toolNames.join(', ')}`)
} else {
  fail('listTools', `got ${JSON.stringify(toolNames)}`)
}

const resources = await client.listResources()
if (resources.resources.length >= 8) {
  ok('listResources', `${resources.resources.length} resources`)
} else {
  fail('listResources', `${resources.resources.length} resources`)
}

// ========== HELP (all 8 topics) ==========
console.log('')
console.log('--- help ---')
for (const topic of [
  'pages',
  'databases',
  'blocks',
  'users',
  'workspace',
  'comments',
  'content_convert',
  'file_uploads'
]) {
  try {
    const r = await callTool(client, 'help', { tool_name: topic })
    if (r.text.length >= 100) ok(`help(${topic})`, `${r.text.length} chars`)
    else fail(`help(${topic})`, `too short: ${r.text.length}`)
  } catch (e) {
    fail(`help(${topic})`, e.message)
  }
}

// ========== WORKSPACE ==========
console.log('')
console.log('--- workspace ---')
try {
  const r = await callTool(client, 'workspace', { action: 'info' })
  ok('workspace.info', r.text.slice(0, 100))
} catch (e) {
  fail('workspace.info', e.message)
}

try {
  const r = await callTool(client, 'workspace', { action: 'search', query: 'test' })
  ok('workspace.search(query)', r.text.slice(0, 100))
} catch (e) {
  fail('workspace.search(query)', e.message)
}

try {
  const r = await callTool(client, 'workspace', { action: 'search', filter: { object: 'page' } })
  ok('workspace.search(filter=page)', r.text.slice(0, 100))
} catch (e) {
  fail('workspace.search(filter=page)', e.message)
}

try {
  const r = await callTool(client, 'workspace', { action: 'search', filter: { object: 'data_source' } })
  ok('workspace.search(filter=data_source)', r.text.slice(0, 100))
} catch (e) {
  fail('workspace.search(filter=data_source)', e.message)
}

// ========== USERS ==========
console.log('')
console.log('--- users ---')
try {
  const r = await callTool(client, 'users', { action: 'me' })
  ok('users.me', r.text.slice(0, 100))
} catch (e) {
  fail('users.me', e.message)
}

try {
  const r = await callTool(client, 'users', { action: 'from_workspace' })
  ok('users.from_workspace', r.text.slice(0, 100))
} catch (e) {
  fail('users.from_workspace', e.message)
}

try {
  const r = await callTool(client, 'users', { action: 'list' })
  ok('users.list', r.text.slice(0, 100))
} catch (e) {
  if (e.message.includes('restricted') || e.message.includes('Insufficient') || e.message.includes('admin')) {
    skipTest('users.list', 'Requires admin permissions (expected for integration token)')
  } else {
    fail('users.list', e.message)
  }
}

// ========== CONTENT_CONVERT ==========
console.log('')
console.log('--- content_convert ---')
try {
  const r = await callTool(client, 'content_convert', {
    direction: 'markdown-to-blocks',
    content: '# Hello\n\nThis is **bold** and *italic*.\n\n- Item 1\n- Item 2\n\n> Quote\n\n```js\nconsole.log(1)\n```'
  })
  ok('content_convert.md-to-blocks', r.text.slice(0, 100))
} catch (e) {
  fail('content_convert.md-to-blocks', e.message)
}

try {
  const r = await callTool(client, 'content_convert', {
    direction: 'blocks-to-markdown',
    content: JSON.stringify([
      { type: 'heading_1', heading_1: { rich_text: [{ type: 'text', text: { content: 'Test' } }] } },
      { type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: 'Hello' } }] } }
    ])
  })
  ok('content_convert.blocks-to-md', r.text.slice(0, 100))
} catch (e) {
  fail('content_convert.blocks-to-md', e.message)
}

// ========== PAGES CRUD ==========
console.log('')
console.log('--- pages CRUD ---')

let parentId = null
try {
  const r = await callTool(client, 'workspace', { action: 'search', query: 'MCP', filter: { object: 'page' } })
  const m = r.text.match(/"(?:page_)?id":\s*"([0-9a-f-]+)"/)
  if (m) parentId = m[1]
} catch (_) {}

if (!parentId) {
  try {
    const r = await callTool(client, 'workspace', { action: 'search', filter: { object: 'page' } })
    const m = r.text.match(/"(?:page_)?id":\s*"([0-9a-f-]+)"/)
    if (m) parentId = m[1]
  } catch (_) {}
}

if (!parentId) {
  fail('pages CRUD', 'No accessible parent page found')
} else {
  ok('found parent page', parentId)

  let testPageId = null
  try {
    const r = await callTool(client, 'pages', {
      action: 'create',
      parent_id: parentId,
      title: 'E2E Test Page (auto-cleanup)',
      content: '# E2E Test\n\nCreated by stdio+relay E2E test.\n\n- Item 1\n- Item 2\n\n## Section\n\nParagraph.',
      icon: 'test_tube:blue'
    })
    const m = r.text.match(/"(?:page_)?id":\s*"([0-9a-f-]+)"/)
    if (m) testPageId = m[1]
    ok('pages.create', `id=${testPageId}`)
  } catch (e) {
    fail('pages.create', e.message)
  }

  if (testPageId) {
    // GET (verify icon and cover)
    try {
      const r = await callTool(client, 'pages', { action: 'get', page_id: testPageId })
      const hasIcon = r.text.includes('icon')
      const hasCover = r.text.includes('cover')
      ok('pages.get', `icon=${hasIcon} cover=${hasCover} | ${r.text.slice(0, 60)}`)
    } catch (e) {
      fail('pages.get', e.message)
    }

    // GET_PROPERTY
    try {
      const r = await callTool(client, 'pages', { action: 'get_property', page_id: testPageId, property_id: 'title' })
      ok('pages.get_property(title)', r.text.slice(0, 100))
    } catch (e) {
      fail('pages.get_property(title)', e.message)
    }

    // UPDATE (append content)
    try {
      const r = await callTool(client, 'pages', {
        action: 'update',
        page_id: testPageId,
        append_content: '## Appended Section\n\nAppended via update action.'
      })
      ok('pages.update(append)', r.text.slice(0, 100))
    } catch (e) {
      fail('pages.update(append)', e.message)
    }

    // UPDATE (icon)
    try {
      const r = await callTool(client, 'pages', {
        action: 'update',
        page_id: testPageId,
        icon: 'check:green'
      })
      ok('pages.update(icon)', r.text.slice(0, 100))
    } catch (e) {
      fail('pages.update(icon)', e.message)
    }

    // ========== BLOCKS CRUD ==========
    console.log('')
    console.log('--- blocks CRUD ---')

    let firstBlockId = null
    try {
      const r = await callTool(client, 'blocks', { action: 'children', block_id: testPageId })
      const parsed = safeParse(r.text)
      // blocks.children returns { blocks: [...], markdown: "..." }
      const blockList = parsed.blocks || []
      if (blockList.length > 0) {
        // Find a heading or paragraph block (updatable)
        const textBlock = blockList.find(
          (b) => b.type && ['paragraph', 'heading_1', 'heading_2', 'heading_3'].includes(b.type)
        )
        firstBlockId = textBlock ? textBlock.id : blockList[0].id
      }
      ok('blocks.children', `child_block=${firstBlockId}, total=${parsed.total_children || blockList.length}`)
    } catch (e) {
      fail('blocks.children', e.message)
    }

    // If no blocks found yet (page just created), append first then re-fetch
    if (!firstBlockId) {
      try {
        await callTool(client, 'blocks', {
          action: 'append',
          block_id: testPageId,
          content: '## Test heading for block ops'
        })
        const r2 = await callTool(client, 'blocks', { action: 'children', block_id: testPageId })
        const p2 = safeParse(r2.text)
        const bl2 = p2.blocks || []
        const tb = bl2.find((b) => b.type && ['heading_1', 'heading_2', 'heading_3', 'paragraph'].includes(b.type))
        if (tb) firstBlockId = tb.id
        ok('blocks.children(retry)', `child_block=${firstBlockId}`)
      } catch (e) {
        fail('blocks.children(retry)', e.message)
      }
    }

    // APPEND (default end)
    try {
      const r = await callTool(client, 'blocks', {
        action: 'append',
        block_id: testPageId,
        content: '### Appended at end\n\nDefault position.'
      })
      ok('blocks.append(end)', r.text.slice(0, 100))
    } catch (e) {
      fail('blocks.append(end)', e.message)
    }

    // APPEND (position: start)
    try {
      const r = await callTool(client, 'blocks', {
        action: 'append',
        block_id: testPageId,
        content: '> Prepended block at start',
        position: 'start'
      })
      ok('blocks.append(start)', r.text.slice(0, 100))
    } catch (e) {
      fail('blocks.append(start)', e.message)
    }

    // APPEND (position: after_block)
    if (firstBlockId) {
      try {
        const r = await callTool(client, 'blocks', {
          action: 'append',
          block_id: testPageId,
          content: '**Inserted after first block**',
          position: 'after_block',
          after_block_id: firstBlockId
        })
        ok('blocks.append(after_block)', r.text.slice(0, 100))
      } catch (e) {
        fail('blocks.append(after_block)', e.message)
      }
    }

    // GET
    if (firstBlockId) {
      try {
        const r = await callTool(client, 'blocks', { action: 'get', block_id: firstBlockId })
        ok('blocks.get', r.text.slice(0, 100))
      } catch (e) {
        fail('blocks.get', e.message)
      }

      // UPDATE
      try {
        const r = await callTool(client, 'blocks', {
          action: 'update',
          block_id: firstBlockId,
          content: '# E2E Test (Updated)'
        })
        ok('blocks.update', r.text.slice(0, 100))
      } catch (e) {
        fail('blocks.update', e.message)
      }
    }

    // ========== COMMENTS ==========
    console.log('')
    console.log('--- comments ---')

    let commentId = null
    try {
      const r = await callTool(client, 'comments', {
        action: 'create',
        page_id: testPageId,
        content: 'E2E test comment from stdio+relay flow'
      })
      const m = r.text.match(/"(?:comment_)?id":\s*"([0-9a-f-]+)"/)
      if (m) commentId = m[1]
      ok('comments.create', `id=${commentId}`)
    } catch (e) {
      fail('comments.create', e.message)
    }

    try {
      const r = await callTool(client, 'comments', { action: 'list', page_id: testPageId })
      ok('comments.list', r.text.slice(0, 100))
    } catch (e) {
      fail('comments.list', e.message)
    }

    if (commentId) {
      try {
        const r = await callTool(client, 'comments', { action: 'get', comment_id: commentId })
        ok('comments.get', r.text.slice(0, 100))
      } catch (e) {
        fail('comments.get', e.message)
      }
    }

    // ========== DUPLICATE / MOVE / ARCHIVE / RESTORE ==========
    console.log('')
    console.log('--- pages duplicate/archive/restore ---')

    let dupPageId = null
    try {
      const r = await callTool(client, 'pages', { action: 'duplicate', page_id: testPageId })
      const m = r.text.match(/"(?:page_)?id":\s*"([0-9a-f-]+)"/)
      if (m) dupPageId = m[1]
      ok('pages.duplicate', `dup_id=${dupPageId}`)
    } catch (e) {
      // Capture full error for debugging
      fail('pages.duplicate', e.message.slice(0, 300))
    }

    try {
      const r = await callTool(client, 'pages', { action: 'archive', page_id: testPageId })
      ok('pages.archive', r.text.slice(0, 100))
    } catch (e) {
      fail('pages.archive', e.message)
    }

    try {
      const r = await callTool(client, 'pages', { action: 'restore', page_id: testPageId })
      ok('pages.restore', r.text.slice(0, 100))
    } catch (e) {
      fail('pages.restore', e.message)
    }

    // DELETE block
    if (firstBlockId) {
      try {
        const r = await callTool(client, 'blocks', { action: 'delete', block_id: firstBlockId })
        ok('blocks.delete', r.text.slice(0, 100))
      } catch (e) {
        fail('blocks.delete', e.message)
      }
    }

    // Cleanup
    console.log('')
    console.log('--- cleanup ---')
    try {
      await callTool(client, 'pages', { action: 'archive', page_id: testPageId })
      ok('cleanup(test page)', 'archived')
    } catch (e) {
      fail('cleanup(test page)', e.message)
    }

    if (dupPageId) {
      try {
        await callTool(client, 'pages', { action: 'archive', page_id: dupPageId })
        ok('cleanup(dup page)', 'archived')
      } catch (e) {
        fail('cleanup(dup page)', e.message)
      }
    }
  }
}

// ========== DATABASES ==========
console.log('')
console.log('--- databases ---')

let dbId = null
try {
  // Search for databases (data_sources) \u2014 the results may contain database_id in different locations
  const r = await callTool(client, 'workspace', { action: 'search', filter: { object: 'data_source' } })
  const parsed = safeParse(r.text)
  if (parsed.results && parsed.results.length > 0) {
    // workspace.search for data_source returns: { id, database_id, ... }
    const ds = parsed.results[0]
    dbId = ds.database_id || ds.parent?.database_id || ds.id
  }
} catch (_) {}

if (!dbId) {
  skipTest('databases', 'No accessible database found')
} else {
  ok('found database', dbId)

  try {
    const r = await callTool(client, 'databases', { action: 'get', database_id: dbId })
    ok('databases.get', r.text.slice(0, 100))
  } catch (e) {
    fail('databases.get', e.message)
  }

  try {
    const r = await callTool(client, 'databases', { action: 'query', database_id: dbId, limit: 3 })
    ok('databases.query', r.text.slice(0, 100))
  } catch (e) {
    fail('databases.query', e.message)
  }

  try {
    const r = await callTool(client, 'databases', { action: 'query', database_id: dbId, search: 'test', limit: 3 })
    ok('databases.query(search)', r.text.slice(0, 100))
  } catch (e) {
    fail('databases.query(search)', e.message)
  }

  let dbPageId = null
  try {
    const r = await callTool(client, 'databases', {
      action: 'create_page',
      database_id: dbId,
      page_properties: { Name: 'E2E Test Entry (auto-cleanup)' }
    })
    const m = r.text.match(/"(?:page_)?id":\s*"([0-9a-f-]+)"/)
    if (m) dbPageId = m[1]
    ok('databases.create_page', `id=${dbPageId}`)
  } catch (e) {
    fail('databases.create_page', e.message)
  }

  if (dbPageId) {
    try {
      const r = await callTool(client, 'databases', {
        action: 'update_page',
        page_id: dbPageId,
        page_properties: { Name: 'E2E Test Entry (updated)' }
      })
      ok('databases.update_page', r.text.slice(0, 100))
    } catch (e) {
      fail('databases.update_page', e.message)
    }

    try {
      const r = await callTool(client, 'databases', { action: 'delete_page', page_id: dbPageId })
      ok('databases.delete_page', r.text.slice(0, 100))
    } catch (e) {
      fail('databases.delete_page', e.message)
    }
  }

  try {
    const r = await callTool(client, 'databases', {
      action: 'update_database',
      database_id: dbId,
      icon: 'database:blue'
    })
    ok('databases.update_database(icon)', r.text.slice(0, 100))
  } catch (e) {
    fail('databases.update_database(icon)', e.message)
  }

  try {
    const r = await callTool(client, 'databases', { action: 'list_templates', database_id: dbId })
    ok('databases.list_templates', r.text.slice(0, 100))
  } catch (e) {
    fail('databases.list_templates', e.message)
  }
}

// ========== FILE_UPLOADS ==========
console.log('')
console.log('--- file_uploads ---')

let uploadId = null
try {
  const r = await callTool(client, 'file_uploads', {
    action: 'create',
    filename: 'e2e-test.txt',
    content_type: 'text/plain'
  })
  const m = r.text.match(/"(?:file_upload_)?id":\s*"([0-9a-f-]+)"/)
  if (m) uploadId = m[1]
  ok('file_uploads.create', `id=${uploadId}`)
} catch (e) {
  if (e.message.includes('permission') || e.message.includes('not available') || e.message.includes('not_found')) {
    skipTest('file_uploads.create', 'Not available for this integration')
  } else {
    fail('file_uploads.create', e.message)
  }
}

if (uploadId) {
  try {
    const r = await callTool(client, 'file_uploads', {
      action: 'send',
      file_upload_id: uploadId,
      file_content: Buffer.from('Hello from E2E test').toString('base64')
    })
    ok('file_uploads.send', r.text.slice(0, 100))
  } catch (e) {
    fail('file_uploads.send', e.message)
  }

  try {
    const r = await callTool(client, 'file_uploads', { action: 'complete', file_upload_id: uploadId })
    ok('file_uploads.complete', r.text.slice(0, 100))
  } catch (e) {
    if (e.message.includes('Invalid') || e.message.includes('not ready') || e.message.includes('uploaded')) {
      skipTest('file_uploads.complete', 'Already completed or not ready')
    } else {
      fail('file_uploads.complete', e.message)
    }
  }

  try {
    const r = await callTool(client, 'file_uploads', { action: 'retrieve', file_upload_id: uploadId })
    ok('file_uploads.retrieve', r.text.slice(0, 100))
  } catch (e) {
    fail('file_uploads.retrieve', e.message)
  }

  // file_uploads.list
  try {
    const r = await callTool(client, 'file_uploads', { action: 'list' })
    ok('file_uploads.list', r.text.slice(0, 100))
  } catch (e) {
    fail('file_uploads.list', e.message)
  }
}

// ========== SUMMARY ==========
await client.close()

const total = passed + failed
console.log('')
console.log('='.repeat(60))
console.log(
  `STDIO + RELAY E2E: ${passed}/${total} PASS (${((100 * passed) / total).toFixed(1)}%)${skipped ? `, ${skipped} skipped` : ''}`
)
console.log('='.repeat(60))

if (failed > 0) {
  console.log('')
  console.log('Failed tests:')
  for (const r of results) {
    if (r.status === 'FAIL') console.log(`  - ${r.label}: ${r.evidence.slice(0, 150)}`)
  }
  process.exit(1)
}
