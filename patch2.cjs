const fs = require('fs')
const path = require('path')

const filePath = path.resolve('src/tools/helpers/pagination.ts')
let code = fs.readFileSync(filePath, 'utf8')

const searchRegex =
  /const childrenResults = await processBatches\(blocksNeedingChildren, \(b\) => fetchChildren\(b\.id\), \{\n {4}batchSize: 1,\n {4}concurrency: 5\n {2}\}\)\n\n {2}const recursivePromises: Promise<void>\[\] = \[\]\n\n {2}for \(let j = 0; j < blocksNeedingChildren\.length; j\+\+\) \{\n {4}const block = blocksNeedingChildren\[j\]\n {4}const children = childrenResults\[j\]\n {4}\/\/ Attach children to the correct property based on block type\n {4}if \(block\[block\.type\]\) \{\n {6}block\[block\.type\]\.children = children\n {4}\}\n {4}\/\/ Recurse into children in parallel\n {4}recursivePromises\.push\(fetchChildrenRecursive\(children, fetchChildren, depth \+ 1\)\)\n {2}\}\n\n {2}await Promise\.all\(recursivePromises\)/

const replacement = `const childrenResults = await processBatches(blocksNeedingChildren, (b) => fetchChildren(b.id), {
    batchSize: 1,
    concurrency: 5
  })

  // We can't completely parallelize the recursive calls across all children branches simultaneously
  // because that would lead to an explosion in concurrency, bypassing the Notion API rate limit.
  // Instead, we await each branch's resolution before moving to the next.
  for (let j = 0; j < blocksNeedingChildren.length; j++) {
    const block = blocksNeedingChildren[j]
    const children = childrenResults[j]
    // Attach children to the correct property based on block type
    if (block[block.type]) {
      block[block.type].children = children
    }
    // Recurse into children sequentially to respect rate limits globally per tree level
    await fetchChildrenRecursive(children, fetchChildren, depth + 1)
  }`

if (!searchRegex.test(code)) {
  console.error('Could not find the target codeblock to replace.')
  process.exit(1)
}

code = code.replace(searchRegex, replacement)

fs.writeFileSync(filePath, code)
console.log('Successfully patched src/tools/helpers/pagination.ts')
