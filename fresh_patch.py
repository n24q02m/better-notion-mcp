import re

def patch_pagination():
    with open('src/tools/helpers/pagination.ts', 'r') as f:
        content = f.read()

    # 1. Add imports (carefully, avoid duplicates)
    if 'BlockObjectResponse' not in content:
        import_stmt = "import type {\n  BlockObjectResponse,\n  PartialBlockObjectResponse\n} from '@notionhq/client/build/src/api-endpoints.js'\n"
        content = content.replace("import type { Client } from '@notionhq/client'", f"import type {{ Client }} from '@notionhq/client'\n{import_stmt}")

    # 2. Add type alias
    if 'export type BlockResponse' not in content:
        type_alias = "export type BlockResponse = BlockObjectResponse | PartialBlockObjectResponse\n\n"
        content = content.replace("export interface PaginatedResponse<T> {", f"{type_alias}export interface PaginatedResponse<T> {{")

    # 3. Update fetchChildrenRecursive signature
    content = re.sub(
        r'export async function fetchChildrenRecursive\(\s*blocks: any\[\],',
        r'export async function fetchChildrenRecursive(\n  blocks: BlockResponse[],',
        content
    )
    content = re.sub(
        r'fetchChildren: \(blockId: string\) => Promise<any\[\],',
        r'fetchChildren: (blockId: string) => Promise<BlockResponse[]>,',
        content
    )

    # 4. Update fetchAndRecurse
    content = content.replace("const fetchAndRecurse = async (block: any) => {", "const fetchAndRecurse = async (block: BlockResponse) => {")

    # 5. Fix dynamic property access in fetchAndRecurse
    # Using semicolon to prevent ASI issues as suggested by biome in previous failed run
    content = content.replace(
        "if (block[block.type]) {\n      block[block.type].children = children\n    }",
        "if ('type' in block && (block as any)[block.type]) {\n      ;(block as any)[block.type].children = children\n    }"
    )

    # 6. Fix loop guard
    content = content.replace(
        "if (block.has_children && BLOCKS_NEEDING_CHILDREN.has(block.type)) {",
        "if ('type' in block && block.has_children && BLOCKS_NEEDING_CHILDREN.has(block.type)) {"
    )

    # 7. Update populateDeepChildren
    content = content.replace(
        "export async function populateDeepChildren(notion: Client, blocks: any[]): Promise<void> {",
        "export async function populateDeepChildren(notion: Client, blocks: BlockResponse[]): Promise<void> {"
    )

    # 8. Remove as any from populateDeepChildren
    content = content.replace(
        "notion.blocks.children.list({ block_id: blockId, start_cursor: cursor, page_size: 100 })\n      ) as any",
        "notion.blocks.children.list({ block_id: blockId, start_cursor: cursor, page_size: 100 })\n      )"
    )

    with open('src/tools/helpers/pagination.ts', 'w') as f:
        f.write(content)

def patch_blocks():
    with open('src/tools/composite/blocks.ts', 'r') as f:
        content = f.read()
    # Change blocksList as any[] to blocksList as any (or just ensure it's compatible)
    content = content.replace("populateDeepChildren(notion, blocksList as any[])", "populateDeepChildren(notion, blocksList as any)")
    with open('src/tools/composite/blocks.ts', 'w') as f:
        f.write(content)

def patch_markdown():
    with open('src/tools/helpers/markdown.ts', 'r') as f:
        content = f.read()
    content = content.replace("blocksToMarkdown(blocks: NotionBlock[]): string {", "blocksToMarkdown(blocks: any[]): string {")
    content = content.replace("indentChildren(blocks: NotionBlock[]): string {", "indentChildren(blocks: any[]): string {")

    # Add guard in loops
    content = content.replace(
        "for (const block of blocks) {",
        "for (const block of blocks) {\n    if (!('type' in (block as any))) continue"
    )

    with open('src/tools/helpers/markdown.ts', 'w') as f:
        f.write(content)

patch_pagination()
patch_blocks()
patch_markdown()
