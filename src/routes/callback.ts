import { randomBytes } from 'node:crypto'
import type express from 'express'

const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token'

export interface CallbackRouteDeps {
  app: express.Express
  pendingAuths: Map<string, any>
  authCodes: Map<string, any>
  callbackUrl: string
  notionBasicAuth: string
}

export function setupCallbackRoute({ app, pendingAuths, authCodes, callbackUrl, notionBasicAuth }: CallbackRouteDeps) {
  app.get('/callback', async (req, res) => {
    const { code, state, error } = req.query as Record<string, string>

    if (error) {
      res.status(400).json({ error: 'oauth_error', error_description: error })
      return
    }

    if (!code || !state) {
      res.status(400).json({ error: 'invalid_request', error_description: 'Missing code or state' })
      return
    }

    // Look up the pending auth
    const pending = pendingAuths.get(state)
    if (!pending) {
      res.status(400).json({ error: 'invalid_state', error_description: 'Unknown or expired state' })
      return
    }
    pendingAuths.delete(state)

    try {
      // Exchange Notion's auth code for a Notion token
      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl
      })

      const tokenResponse = await globalThis.fetch(NOTION_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${notionBasicAuth}`
        },
        body: tokenParams.toString()
      })

      if (!tokenResponse.ok) {
        await tokenResponse.body?.cancel()
        console.error('Notion token exchange failed:', tokenResponse.status)
        res
          .status(502)
          .json({ error: 'token_exchange_failed', error_description: 'Failed to exchange code with Notion' })
        return
      }

      const tokenData = (await tokenResponse.json()) as {
        access_token: string
        token_type: string
        expires_in?: number
        refresh_token?: string
      }

      // Issue our own auth code and store the Notion token + PKCE challenge for verification
      const ourAuthCode = randomBytes(32).toString('hex')
      authCodes.set(ourAuthCode, {
        notionAccessToken: tokenData.access_token,
        notionRefreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        codeChallenge: pending.codeChallenge,
        codeChallengeMethod: pending.codeChallengeMethod,
        clientId: pending.clientId,
        createdAt: Date.now()
      })

      // Redirect back to the MCP client's original redirect_uri
      const clientRedirect = new URL(pending.clientRedirectUri)

      // Prevent XSS and Open Redirect vulnerabilities via unsafe protocols
      const protocol = clientRedirect.protocol.toLowerCase()
      if (['javascript:', 'data:', 'vbscript:', 'file:'].includes(protocol)) {
        res.status(400).json({ error: 'invalid_request', error_description: 'Unsafe redirect URI' })
        return
      }

      clientRedirect.searchParams.set('code', ourAuthCode)
      if (pending.clientState) {
        clientRedirect.searchParams.set('state', pending.clientState)
      }

      res.redirect(clientRedirect.toString())
    } catch (err) {
      console.error('Callback handler error:', err)
      res.status(500).json({ error: 'server_error', error_description: 'Internal server error' })
    }
  })
}
