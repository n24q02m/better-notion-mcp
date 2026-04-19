import sys

with open('src/credential-state.test.ts', 'r') as f:
    content = f.read()

# We only want to replace 'url' with 'https://example.com' in specific contexts.
# The `url` is used mostly in mock objects or arguments passed to commands.

content = content.replace("relayUrl: 'url'", "relayUrl: 'https://example.com'")
content = content.replace("['url']", "['https://example.com']")
content = content.replace("'', 'url']", "'', 'https://example.com']")

with open('src/credential-state.test.ts', 'w') as f:
    f.write(content)
