import re

file_path = 'src/tools/composite/pages.test.ts'

with open(file_path, 'r') as f:
    content = f.read()

# Import the new result types
content = content.replace(
    "import { pages } from './pages'",
    "import { pages, CreatePageResult, GetPageResult, GetPagePropertyResult, UpdatePageResult, MovePageResult, ArchivePageResult, DuplicatePageResult } from './pages'"
)

# Fix create tests
content = re.sub(
    r"(const result = await pages\(.*?, \{\s*action: 'create'.*?\}\))",
    r"\1 as CreatePageResult",
    content, flags=re.DOTALL
)

# Fix get tests
content = re.sub(
    r"(const result = await pages\(.*?, \{\s*action: 'get'.*?\}\))",
    r"\1 as GetPageResult",
    content, flags=re.DOTALL
)

# Fix get_property tests
content = re.sub(
    r"(const result = await pages\(.*?, \{\s*action: 'get_property'.*?\}\))",
    r"\1 as GetPagePropertyResult",
    content, flags=re.DOTALL
)

# Fix update tests
content = re.sub(
    r"(const result = await pages\(.*?, \{\s*action: 'update'.*?\}\))",
    r"\1 as UpdatePageResult",
    content, flags=re.DOTALL
)

# Fix move tests
content = re.sub(
    r"(const result = await pages\(.*?, \{\s*action: 'move'.*?\}\))",
    r"\1 as MovePageResult",
    content, flags=re.DOTALL
)

# Fix archive/restore tests
content = re.sub(
    r"(const result = await pages\(.*?, \{\s*action: 'archive'.*?\}\))",
    r"\1 as ArchivePageResult",
    content, flags=re.DOTALL
)

content = re.sub(
    r"(const result = await pages\(.*?, \{\s*action: 'restore'.*?\}\))",
    r"\1 as ArchivePageResult",
    content, flags=re.DOTALL
)

# Fix duplicate tests
content = re.sub(
    r"(const result = await pages\(.*?, \{\s*action: 'duplicate'.*?\}\))",
    r"\1 as DuplicatePageResult",
    content, flags=re.DOTALL
)

with open(file_path, 'w') as f:
    f.write(content)

# Fix src/tools/composite/pages.ts
pages_path = 'src/tools/composite/pages.ts'
with open(pages_path, 'r') as f:
    pages_content = f.read()

# Fix the archivePage return type issue
pages_content = pages_content.replace(
    "action: input.action,",
    "action: input.action as 'archive' | 'restore',"
)

with open(pages_path, 'w') as f:
    f.write(pages_content)
