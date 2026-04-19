import sys

with open('src/credential-state.ts', 'r') as f:
    content = f.read()

# Add import
import_stmt = "import { isSafeWebUrl } from './tools/helpers/security.js'\n"
content = content.replace("import { RELAY_SCHEMA } from './relay-schema.js'", "import { RELAY_SCHEMA } from './relay-schema.js'\n" + import_stmt)

# Update tryOpenBrowser
old_func = """function tryOpenBrowser(url: string): void {
  const platform = process.platform

  if (platform === 'darwin') {
    execFile('open', [url], () => {})
  } else if (platform === 'win32') {
    execFile('cmd', ['/c', 'start', '', url], () => {})
  } else {
    execFile('xdg-open', [url], () => {})
  }
}"""

new_func = """export function tryOpenBrowser(url: string): void {
  if (!isSafeWebUrl(url)) return

  const platform = process.platform

  if (platform === 'darwin') {
    execFile('open', [url], () => {})
  } else if (platform === 'win32') {
    execFile('cmd', ['/c', 'start', '', url], () => {})
  } else {
    execFile('xdg-open', [url], () => {})
  }
}"""

content = content.replace(old_func, new_func)

with open('src/credential-state.ts', 'w') as f:
    f.write(content)
