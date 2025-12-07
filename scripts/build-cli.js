import * as esbuild from 'esbuild'
import { chmod } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function build() {
  await esbuild.build({
    entryPoints: [join(__dirname, 'start-server.ts')],
    bundle: true,
    minify: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    outfile: 'bin/cli.mjs',
    banner: {
      js: "#!/usr/bin/env node\nimport { createRequire } from 'module';const require = createRequire(import.meta.url);"
    },
    external: ['util', '@notionhq/client', '@modelcontextprotocol/sdk']
  })

  // Make the output file executable
  await chmod('./bin/cli.mjs', 0o755)

  console.log('CLI built successfully: bin/cli.mjs')
}

build().catch((err) => {
  console.error('Build failed:', err)
  process.exit(1)
})
