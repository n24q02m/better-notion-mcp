1. **Extract `setupProviderOverrides`**: Move the logic that overrides the provider's `authorize`, `exchangeAuthorizationCode`, and `exchangeRefreshToken` methods into a separate helper function to simplify `createNotionOAuthProvider`.
2. **Extract Cleanup Logic**: Extract the `setInterval` logic that cleans up expired tokens, binds, and caches into a separate function `startCleanupInterval`.
3. **Verify and test**: Ensure `bun run check` and `bun run test` pass after refactoring.
