import { Client } from '@notionhq/client'

const client = new Client({ auth: 'secret_123' })
console.log('Blocks keys:', Object.keys(client.blocks))
// @ts-expect-error
if (client.blocks.children) {
  // @ts-expect-error
  console.log('Blocks.children keys:', Object.keys(client.blocks.children))
}
