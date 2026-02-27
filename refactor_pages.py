import re

file_path = 'src/tools/composite/pages.ts'

with open(file_path, 'r') as f:
    content = f.read()

# Define interfaces
interfaces = """
export interface CreatePageResult {
  action: 'create'
  page_id: string
  url: string
  created: true
}

export interface GetPageResult {
  action: 'get'
  page_id: string
  url: string
  created_time: string
  last_edited_time: string
  archived: boolean
  properties: Record<string, any>
  content: string
  block_count: number
}

export interface GetPagePropertyResult {
  action: 'get_property'
  page_id: string
  property_id: string
  type: string
  value: any
}

export interface UpdatePageResult {
  action: 'update'
  page_id: string
  updated: true
}

export interface MovePageResult {
  action: 'move'
  page_id: string
  new_parent_id: string
  moved: true
}

export interface ArchivePageResult {
  action: 'archive' | 'restore'
  processed: number
  results: Array<{ page_id: string; archived: boolean }>
}

export interface DuplicatePageResult {
  action: 'duplicate'
  processed: number
  results: Array<{ original_id: string; duplicate_id: string; url: string }>
}

export type PagesResult =
  | CreatePageResult
  | GetPageResult
  | GetPagePropertyResult
  | UpdatePageResult
  | MovePageResult
  | ArchivePageResult
  | DuplicatePageResult
"""

# Insert interfaces after imports
# Find the last import
import_end = 0
for match in re.finditer(r'^import .*', content, re.MULTILINE):
    import_end = match.end()

content = content[:import_end+1] + "\n" + interfaces + content[import_end+1:]

# Update pages function signature
content = content.replace(
    "export async function pages(notion: Client, input: PagesInput): Promise<any> {",
    "export async function pages(notion: Client, input: PagesInput): Promise<PagesResult> {"
)

# Update helper function signatures
content = content.replace(
    "async function createPage(notion: Client, input: PagesInput): Promise<any> {",
    "async function createPage(notion: Client, input: PagesInput): Promise<CreatePageResult> {"
)

content = content.replace(
    "async function getPage(notion: Client, input: PagesInput): Promise<any> {",
    "async function getPage(notion: Client, input: PagesInput): Promise<GetPageResult> {"
)

content = content.replace(
    "async function getPageProperty(notion: Client, input: PagesInput): Promise<any> {",
    "async function getPageProperty(notion: Client, input: PagesInput): Promise<GetPagePropertyResult> {"
)

content = content.replace(
    "async function updatePage(notion: Client, input: PagesInput): Promise<any> {",
    "async function updatePage(notion: Client, input: PagesInput): Promise<UpdatePageResult> {"
)

content = content.replace(
    "async function movePage(notion: Client, input: PagesInput): Promise<any> {",
    "async function movePage(notion: Client, input: PagesInput): Promise<MovePageResult> {"
)

content = content.replace(
    "async function archivePage(notion: Client, input: PagesInput): Promise<any> {",
    "async function archivePage(notion: Client, input: PagesInput): Promise<ArchivePageResult> {"
)

content = content.replace(
    "async function duplicatePage(notion: Client, input: PagesInput): Promise<any> {",
    "async function duplicatePage(notion: Client, input: PagesInput): Promise<DuplicatePageResult> {"
)

with open(file_path, 'w') as f:
    f.write(content)
