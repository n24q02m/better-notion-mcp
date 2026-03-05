#!/usr/bin/env node
/**
 * Phase 5 Live Comprehensive Test for better-notion-mcp.
 *
 * Spawns the server via MCP SDK Client (StdioClientTransport),
 * communicates over JSON-RPC stdio, and tests all accessible operations.
 *
 * Usage:
 *   node test-live-mcp.mjs                    # Meta + help + error tests (no token needed uses fake)
 *   NOTION_TOKEN=ntn_xxx node test-live-mcp.mjs  # Full test with real Notion API
 *
 * Without NOTION_TOKEN: tests listTools, listResources, help (all 9), error paths
 * With NOTION_TOKEN: also tests actual Notion API operations
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const TIMEOUT = { timeout: 30000 }

// Use real token if available, otherwise fake one (server needs it to start)
const NOTION_TOKEN = process.env.NOTION_TOKEN || 'ntn_fake_token_for_testing'
const HAS_REAL_TOKEN = process.env.NOTION_TOKEN ? true : false

let passed = 0
let failed = 0
let skipped = 0
const results = []

function parse(r) {
  if (r.isError) throw new Error(r.content[0].text)
  return r.content[0].text
}

function ok(label, evidence = '') {
  passed++
  results.push({ label, status: 'PASS', evidence })
  console.log(`  [PASS] ${label}` + (evidence ? ` | ${evidence.slice(0, 80)}` : ''))
}

function fail(label, err) {
  failed++
  results.push({ label, status: 'FAIL', evidence: err })
  console.log(`  [FAIL] ${label} | ${err.slice(0, 120)}`)
}

function skip(label, reason) {
  skipped++
  results.push({ label, status: 'SKIP', evidence: reason })
  console.log(`  [SKIP] ${label} | ${reason}`)
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
const transport = new StdioClientTransport({
  command: 'node',
  args: ['bin/cli.mjs'],
  env: { NOTION_TOKEN, PATH: process.env.PATH },
  cwd: import.meta.dirname || process.cwd()
})

const client = new Client({ name: 'live-test', version: '1.0.0' })
await client.connect(transport)
console.log(`Server connected. NOTION_TOKEN: ${HAS_REAL_TOKEN ? 'real' : 'fake (limited tests)'}\n`)

// ---------------------------------------------------------------------------
// Meta tests
// ---------------------------------------------------------------------------
console.log('--- Meta ---')

const toolsResult = await client.listTools()
const toolNames = toolsResult.tools.map((t) => t.name).sort()
const expectedTools = [
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
if (JSON.stringify(toolNames) === JSON.stringify(expectedTools)) {
  ok('listTools', `tools=${JSON.stringify(toolNames)}`)
} else {
  fail('listTools', `Expected ${JSON.stringify(expectedTools)}, got ${JSON.stringify(toolNames)}`)
}

const resourcesResult = await client.listResources()
const resourceUris = resourcesResult.resources.map((r) => r.uri).sort()
if (resourceUris.length >= 8) {
  ok('listResources', `${resourceUris.length} resources: ${resourceUris[0]}...`)
} else {
  fail('listResources', `Expected >=8 resources, got ${resourceUris.length}`)
}

// ---------------------------------------------------------------------------
// Help tool (no API needed - reads local markdown docs)
// ---------------------------------------------------------------------------
console.log('\n--- help ---')

const helpTopics = ['pages', 'databases', 'blocks', 'users', 'workspace', 'comments', 'content_convert', 'file_uploads']

for (const topic of helpTopics) {
  try {
    const r = await client.callTool({ name: 'help', arguments: { tool_name: topic } }, undefined, TIMEOUT)
    const t = parse(r)
    if (t.length >= 100) {
      ok(`help(${topic})`, `${t.length} chars`)
    } else {
      fail(`help(${topic})`, `Too short: ${t.length} chars`)
    }
  } catch (e) {
    fail(`help(${topic})`, e.message)
  }
}

// ---------------------------------------------------------------------------
// Error paths (no API needed - validation happens before API call)
// ---------------------------------------------------------------------------
console.log('\n--- Error paths ---')

// pages: missing action
try {
  const r = await client.callTool({ name: 'pages', arguments: {} }, undefined, TIMEOUT)
  const t = parse(r)
  if (t.toLowerCase().includes('error') || t.toLowerCase().includes('action')) {
    ok('pages(no action)', t.slice(0, 80))
  } else {
    fail('pages(no action)', `Expected error: ${t.slice(0, 60)}`)
  }
} catch (e) {
  ok('pages(no action)', `Error: ${e.message.slice(0, 60)}`)
}

// pages: invalid action
try {
  const r = await client.callTool({ name: 'pages', arguments: { action: 'nonexistent' } }, undefined, TIMEOUT)
  const t = parse(r)
  if (t.toLowerCase().includes('error') || t.toLowerCase().includes('unknown') || t.toLowerCase().includes('invalid')) {
    ok('pages(invalid action)', t.slice(0, 80))
  } else {
    fail('pages(invalid action)', `Expected error: ${t.slice(0, 60)}`)
  }
} catch (e) {
  ok('pages(invalid action)', `Error: ${e.message.slice(0, 60)}`)
}

// databases: missing action
try {
  const r = await client.callTool({ name: 'databases', arguments: {} }, undefined, TIMEOUT)
  const t = parse(r)
  if (t.toLowerCase().includes('error') || t.toLowerCase().includes('action')) {
    ok('databases(no action)', t.slice(0, 80))
  } else {
    fail('databases(no action)', `Expected error: ${t.slice(0, 60)}`)
  }
} catch (e) {
  ok('databases(no action)', `Error: ${e.message.slice(0, 60)}`)
}

// blocks: missing action
try {
  const r = await client.callTool({ name: 'blocks', arguments: {} }, undefined, TIMEOUT)
  const t = parse(r)
  if (t.toLowerCase().includes('error') || t.toLowerCase().includes('action')) {
    ok('blocks(no action)', t.slice(0, 80))
  } else {
    fail('blocks(no action)', `Expected error: ${t.slice(0, 60)}`)
  }
} catch (e) {
  ok('blocks(no action)', `Error: ${e.message.slice(0, 60)}`)
}

// users: missing action
try {
  const r = await client.callTool({ name: 'users', arguments: {} }, undefined, TIMEOUT)
  const t = parse(r)
  if (t.toLowerCase().includes('error') || t.toLowerCase().includes('action')) {
    ok('users(no action)', t.slice(0, 80))
  } else {
    fail('users(no action)', `Expected error: ${t.slice(0, 60)}`)
  }
} catch (e) {
  ok('users(no action)', `Error: ${e.message.slice(0, 60)}`)
}

// workspace: missing action
try {
  const r = await client.callTool({ name: 'workspace', arguments: {} }, undefined, TIMEOUT)
  const t = parse(r)
  if (t.toLowerCase().includes('error') || t.toLowerCase().includes('action')) {
    ok('workspace(no action)', t.slice(0, 80))
  } else {
    fail('workspace(no action)', `Expected error: ${t.slice(0, 60)}`)
  }
} catch (e) {
  ok('workspace(no action)', `Error: ${e.message.slice(0, 60)}`)
}

// comments: missing action
try {
  const r = await client.callTool({ name: 'comments', arguments: {} }, undefined, TIMEOUT)
  const t = parse(r)
  if (t.toLowerCase().includes('error') || t.toLowerCase().includes('action')) {
    ok('comments(no action)', t.slice(0, 80))
  } else {
    fail('comments(no action)', `Expected error: ${t.slice(0, 60)}`)
  }
} catch (e) {
  ok('comments(no action)', `Error: ${e.message.slice(0, 60)}`)
}

// content_convert: missing action
try {
  const r = await client.callTool({ name: 'content_convert', arguments: {} }, undefined, TIMEOUT)
  const t = parse(r)
  if (t.toLowerCase().includes('error') || t.toLowerCase().includes('action')) {
    ok('content_convert(no action)', t.slice(0, 80))
  } else {
    fail('content_convert(no action)', `Expected error: ${t.slice(0, 60)}`)
  }
} catch (e) {
  ok('content_convert(no action)', `Error: ${e.message.slice(0, 60)}`)
}

// file_uploads: missing action
try {
  const r = await client.callTool({ name: 'file_uploads', arguments: {} }, undefined, TIMEOUT)
  const t = parse(r)
  if (t.toLowerCase().includes('error') || t.toLowerCase().includes('action')) {
    ok('file_uploads(no action)', t.slice(0, 80))
  } else {
    fail('file_uploads(no action)', `Expected error: ${t.slice(0, 60)}`)
  }
} catch (e) {
  ok('file_uploads(no action)', `Error: ${e.message.slice(0, 60)}`)
}

// help: invalid tool_name
try {
  const r = await client.callTool({ name: 'help', arguments: { tool_name: 'nonexistent' } }, undefined, TIMEOUT)
  const t = parse(r)
  if (
    t.toLowerCase().includes('error') ||
    t.toLowerCase().includes('not found') ||
    t.toLowerCase().includes('unknown')
  ) {
    ok('help(invalid tool)', t.slice(0, 80))
  } else {
    fail('help(invalid tool)', `Expected error: ${t.slice(0, 60)}`)
  }
} catch (e) {
  ok('help(invalid tool)', `Error: ${e.message.slice(0, 60)}`)
}

// ---------------------------------------------------------------------------
// API tests (only with real token)
// ---------------------------------------------------------------------------
if (HAS_REAL_TOKEN) {
  console.log('\n--- API tests (real token) ---')

  // workspace.info
  try {
    const r = await client.callTool({ name: 'workspace', arguments: { action: 'info' } }, undefined, TIMEOUT)
    const t = parse(r)
    ok('workspace.info', t.slice(0, 80))
  } catch (e) {
    fail('workspace.info', e.message)
  }

  // workspace.search
  try {
    const r = await client.callTool(
      { name: 'workspace', arguments: { action: 'search', query: 'test' } },
      undefined,
      TIMEOUT
    )
    const t = parse(r)
    ok('workspace.search', t.slice(0, 80))
  } catch (e) {
    fail('workspace.search', e.message)
  }

  // users.list
  try {
    const r = await client.callTool({ name: 'users', arguments: { action: 'list' } }, undefined, TIMEOUT)
    const t = parse(r)
    ok('users.list', t.slice(0, 80))
  } catch (e) {
    fail('users.list', e.message)
  }

  // users.me
  try {
    const r = await client.callTool({ name: 'users', arguments: { action: 'me' } }, undefined, TIMEOUT)
    const t = parse(r)
    ok('users.me', t.slice(0, 80))
  } catch (e) {
    fail('users.me', e.message)
  }

  // content_convert: markdown-to-blocks
  try {
    const r = await client.callTool(
      {
        name: 'content_convert',
        arguments: {
          action: 'markdown-to-blocks',
          markdown: '# Hello\n\nThis is a **test**.'
        }
      },
      undefined,
      TIMEOUT
    )
    const t = parse(r)
    ok('content_convert.md-to-blocks', t.slice(0, 80))
  } catch (e) {
    fail('content_convert.md-to-blocks', e.message)
  }
} else {
  console.log('\n--- API tests (SKIPPED - no NOTION_TOKEN) ---')
  const apiTests = ['workspace.info', 'workspace.search', 'users.list', 'users.me', 'content_convert.md-to-blocks']
  for (const t of apiTests) {
    skip(t, 'Requires NOTION_TOKEN')
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
await client.close()

const total = passed + failed
console.log(`\n${'='.repeat(60)}`)
console.log(
  `RESULT: ${passed}/${total} PASS (${((100 * passed) / total).toFixed(1)}%)${skipped ? `, ${skipped} skipped` : ''}`
)
console.log(`${'='.repeat(60)}`)

if (failed > 0) {
  console.log('\nFailed tests:')
  for (const r of results) {
    if (r.status === 'FAIL') {
      console.log(`  - ${r.label}: ${r.evidence}`)
    }
  }
  process.exit(1)
}
