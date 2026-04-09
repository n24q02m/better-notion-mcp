import { resolveConfig } from '@n24q02m/mcp-relay-core/storage'

async function test() {
  try {
    const config = await resolveConfig('better-notion-mcp', ['NOTION_TOKEN'])
    console.log(config)
  } catch (e) {
    console.error(e)
  }
}

test()
