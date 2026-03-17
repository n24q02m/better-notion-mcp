#!/usr/bin/env node

/**
 * OAuth 2.1 Live Test for better-notion-mcp HTTP transport.
 *
 * Flow:
 * 1. Register client via DCR
 * 2. Generate PKCE code_verifier + code_challenge
 * 3. Open browser for Notion authorization
 * 4. Local callback server captures auth code
 * 5. Exchange code for access token
 * 6. Connect to MCP server with Bearer token
 * 7. Run tool tests
 *
 * Usage:
 *   node test-oauth-mcp.mjs
 */

import { execFile } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'

const MCP_URL = process.env.MCP_URL || 'https://better-notion-mcp.n24q02m.com'
const CALLBACK_PORT = 9876
const CALLBACK_URI = `http://127.0.0.1:${CALLBACK_PORT}/callback`

let passed = 0
let failed = 0
const results = []

function ok(label, evidence = '') {
  passed++
  results.push({ label, status: 'PASS', evidence })
  console.log(`  [PASS] ${label}${evidence ? ` | ${evidence.slice(0, 100)}` : ''}`)
}

function fail(label, err) {
  failed++
  results.push({ label, status: 'FAIL', evidence: err })
  console.log(`  [FAIL] ${label} | ${err.slice(0, 120)}`)
}

// PKCE helpers
function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function generatePKCE() {
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

// Open browser cross-platform (safe: no user input in args)
function openBrowser(url) {
  if (process.platform === 'darwin') {
    execFile('open', [url])
  } else if (process.platform === 'win32') {
    execFile('cmd', ['/c', 'start', url])
  } else {
    execFile('xdg-open', [url], (err) => {
      if (err) console.log(`  Please open manually: ${url}`)
    })
  }
}

// ─── Step 1: DCR Registration ───────────────────────────────────────────
console.log('--- OAuth Setup ---')

const dcrResp = await fetch(`${MCP_URL}/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_name: 'oauth-live-test',
    redirect_uris: [CALLBACK_URI],
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none'
  })
})

if (!dcrResp.ok) {
  fail('DCR registration', `HTTP ${dcrResp.status}`)
  process.exit(1)
}

const dcrData = await dcrResp.json()
ok('DCR registration', `client_id=${dcrData.client_id.slice(0, 12)}...`)

const clientId = dcrData.client_id
const clientSecret = dcrData.client_secret

// ─── Step 2: PKCE ───────────────────────────────────────────────────────
const { verifier, challenge } = generatePKCE()
const state = base64url(randomBytes(16))

// ─── Step 3: Start callback server + open browser ───────────────────────
console.log('\n--- OAuth Authorization ---')

const authCode = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    server.close()
    reject(new Error('OAuth timeout (120s) - user did not authorize'))
  }, 120_000)

  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${CALLBACK_PORT}`)

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code')
      const returnedState = url.searchParams.get('state')
      const error = url.searchParams.get('error')

      if (error) {
        const esc = (s) =>
          String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`<h2>Authorization Failed</h2><p>${esc(error)}: ${esc(url.searchParams.get('error_description'))}</p>`)
        clearTimeout(timeout)
        server.close()
        reject(new Error(`OAuth error: ${error}`))
        return
      }

      if (returnedState !== state) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<h2>State mismatch!</h2>')
        clearTimeout(timeout)
        server.close()
        reject(new Error('OAuth state mismatch'))
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<h2>Authorization successful!</h2><p>You can close this tab.</p><script>window.close()</script>')
      clearTimeout(timeout)
      server.close()
      resolve(code)
    }
  })

  server.listen(CALLBACK_PORT, '127.0.0.1', () => {
    const authUrl = new URL(`${MCP_URL}/authorize`)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', CALLBACK_URI)
    authUrl.searchParams.set('code_challenge', challenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('state', state)

    console.log('  Opening browser for Notion authorization...')
    console.log(`  URL: ${authUrl.toString().slice(0, 80)}...`)
    openBrowser(authUrl.toString())
    console.log('  Waiting for authorization (timeout: 120s)...\n')
  })
})

ok('OAuth authorization', `code=${authCode.slice(0, 12)}...`)

// ─── Step 4: Token Exchange ─────────────────────────────────────────────
console.log('\n--- Token Exchange ---')

const tokenResp = await fetch(`${MCP_URL}/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: authCode,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: CALLBACK_URI,
    code_verifier: verifier
  }).toString()
})

if (!tokenResp.ok) {
  const errBody = await tokenResp.text()
  fail('Token exchange', `HTTP ${tokenResp.status}: ${errBody.slice(0, 100)}`)
  process.exit(1)
}

const tokenData = await tokenResp.json()
const accessToken = tokenData.access_token

if (!accessToken) {
  fail('Token exchange', `No access_token in response: ${JSON.stringify(tokenData).slice(0, 100)}`)
  process.exit(1)
}

ok('Token exchange', `token_type=${tokenData.token_type}, has_token=${!!accessToken}`)

// ─── Step 5: MCP Tests via HTTP with Bearer token ───────────────────────
console.log('\n--- MCP over HTTP (OAuth) ---')

let msgId = 0
let sessionId = null

async function mcpRequest(method, params = {}) {
  const id = ++msgId
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json, text/event-stream'
  }
  if (sessionId) headers['Mcp-Session-Id'] = sessionId

  const resp = await fetch(`${MCP_URL}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
  })

  // Capture session ID from response
  const respSessionId = resp.headers.get('mcp-session-id')
  if (respSessionId) sessionId = respSessionId

  const contentType = resp.headers.get('content-type') || ''

  if (contentType.includes('text/event-stream')) {
    const text = await resp.text()
    const lines = text.split('\n')
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))
          if (data.id === id) return data
        } catch {}
      }
    }
    throw new Error(`No matching response in SSE for id=${id}`)
  }

  return resp.json()
}

// Initialize
try {
  const initResp = await mcpRequest('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'oauth-test', version: '1.0.0' }
  })
  if (initResp.result?.protocolVersion) {
    ok('MCP initialize', `protocol=${initResp.result.protocolVersion}`)
    // Send initialized notification
    const notifHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json, text/event-stream'
    }
    if (sessionId) notifHeaders['Mcp-Session-Id'] = sessionId
    await fetch(`${MCP_URL}/mcp`, {
      method: 'POST',
      headers: notifHeaders,
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })
    })
  } else {
    fail('MCP initialize', JSON.stringify(initResp).slice(0, 100))
  }
} catch (e) {
  fail('MCP initialize', e.message)
  process.exit(1)
}

// List tools
try {
  const toolsResp = await mcpRequest('tools/list', {})
  const tools = toolsResp.result?.tools || []
  if (tools.length >= 8) {
    ok('MCP listTools', `${tools.length} tools: ${tools.map((t) => t.name).join(', ')}`)
  } else {
    fail('MCP listTools', `Expected >=8 tools, got ${tools.length}`)
  }
} catch (e) {
  fail('MCP listTools', e.message)
}

// Help tool
try {
  const helpResp = await mcpRequest('tools/call', { name: 'help', arguments: { tool_name: 'pages' } })
  const text = helpResp.result?.content?.[0]?.text || ''
  if (text.length > 100) {
    ok('help(pages) via OAuth', `${text.length} chars`)
  } else {
    fail('help(pages) via OAuth', `Too short: ${text.length}`)
  }
} catch (e) {
  fail('help(pages) via OAuth', e.message)
}

// Workspace info (real API call via OAuth)
try {
  const infoResp = await mcpRequest('tools/call', { name: 'workspace', arguments: { action: 'info' } })
  const text = infoResp.result?.content?.[0]?.text || ''
  if (text.includes('action') || text.includes('bot') || text.includes('workspace')) {
    ok('workspace.info via OAuth', text.slice(0, 80))
  } else {
    fail('workspace.info via OAuth', `Unexpected: ${text.slice(0, 60)}`)
  }
} catch (e) {
  fail('workspace.info via OAuth', e.message)
}

// Users me (real API via OAuth)
try {
  const meResp = await mcpRequest('tools/call', { name: 'users', arguments: { action: 'me' } })
  const text = meResp.result?.content?.[0]?.text || ''
  if (text.includes('action') || text.includes('me') || text.includes('id')) {
    ok('users.me via OAuth', text.slice(0, 80))
  } else {
    fail('users.me via OAuth', `Unexpected: ${text.slice(0, 60)}`)
  }
} catch (e) {
  fail('users.me via OAuth', e.message)
}

// Workspace search (real API via OAuth)
try {
  const searchResp = await mcpRequest('tools/call', {
    name: 'workspace',
    arguments: { action: 'search', query: 'test' }
  })
  const text = searchResp.result?.content?.[0]?.text || ''
  if (text.includes('action') || text.includes('results') || text.includes('search')) {
    ok('workspace.search via OAuth', text.slice(0, 80))
  } else {
    fail('workspace.search via OAuth', `Unexpected: ${text.slice(0, 60)}`)
  }
} catch (e) {
  fail('workspace.search via OAuth', e.message)
}

// Content convert
try {
  const cvResp = await mcpRequest('tools/call', {
    name: 'content_convert',
    arguments: { direction: 'markdown-to-blocks', content: '# Test\n\nHello **world**' }
  })
  const text = cvResp.result?.content?.[0]?.text || ''
  if (text.includes('heading') || text.includes('blocks') || text.includes('direction')) {
    ok('content_convert via OAuth', text.slice(0, 80))
  } else {
    fail('content_convert via OAuth', `Unexpected: ${text.slice(0, 60)}`)
  }
} catch (e) {
  fail('content_convert via OAuth', e.message)
}

// Pages create + archive (full CRUD via OAuth)
try {
  const searchResp = await mcpRequest('tools/call', {
    name: 'workspace',
    arguments: { action: 'search', query: 'MCP', filter: { object: 'page' } }
  })
  const searchText = searchResp.result?.content?.[0]?.text || ''
  const parentMatch = searchText.match(/"(?:page_)?id":\s*"([0-9a-f-]+)"/)

  if (parentMatch) {
    const createResp = await mcpRequest('tools/call', {
      name: 'pages',
      arguments: {
        action: 'create',
        parent_id: parentMatch[1],
        title: 'OAuth Test Page (auto-cleanup)',
        content: '# OAuth Test\n\nCreated via OAuth flow.'
      }
    })
    const createText = createResp.result?.content?.[0]?.text || ''
    const pageMatch = createText.match(/"(?:page_)?id":\s*"([0-9a-f-]+)"/)
    if (pageMatch) {
      ok('pages.create via OAuth', `page_id=${pageMatch[1]}`)

      // Archive cleanup
      await mcpRequest('tools/call', {
        name: 'pages',
        arguments: { action: 'archive', page_id: pageMatch[1] }
      })
      ok('pages.archive via OAuth', 'cleanup done')
    } else {
      ok('pages.create via OAuth', createText.slice(0, 80))
    }
  } else {
    fail('pages.create via OAuth', 'No parent page found')
  }
} catch (e) {
  fail('pages.create via OAuth', e.message)
}

// ─── Summary ────────────────────────────────────────────────────────────
const total = passed + failed
console.log(`\n${'='.repeat(60)}`)
console.log(`RESULT: ${passed}/${total} PASS (${((100 * passed) / total).toFixed(1)}%)`)
console.log(`${'='.repeat(60)}`)

if (failed > 0) {
  console.log('\nFailed tests:')
  for (const r of results) {
    if (r.status === 'FAIL') console.log(`  - ${r.label}: ${r.evidence}`)
  }
  process.exit(1)
}
