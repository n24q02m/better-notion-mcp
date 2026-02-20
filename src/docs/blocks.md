# Blocks Tool - Full Documentation

## Overview
Block-level content: get, children, append, update, delete.

## Important
- **Page IDs are valid block IDs** (page is root block)
- Use for **precise edits** within pages
- For full page content, use pages tool instead

## Supported Block Types
The markdown converter supports these Notion block types:

| Block Type | Markdown Syntax |
|------------|----------------|
| Headings (1-3) | `# H1`, `## H2`, `### H3` |
| Paragraph | Plain text |
| Bulleted list | `- item` or `* item` |
| Numbered list | `1. item` |
| To-do / Checkbox | `- [ ] task` or `- [x] done` |
| Code block | `` ```language `` ... `` ``` `` |
| Quote | `> text` |
| Divider | `---` or `***` |
| Callout | `> [!NOTE] text`, `> [!TIP]`, `> [!WARNING]`, `> [!IMPORTANT]`, `> [!CAUTION]`, `> [!INFO]`, `> [!SUCCESS]`, `> [!ERROR]` |
| Toggle | `<details><summary>Title</summary>content</details>` |
| Table | Pipe-delimited `\| col1 \| col2 \|` with optional header separator |
| Image | `![alt text](url)` |
| Bookmark | `[bookmark](url)` |
| Embed | `[embed](url)` |
| Equation | `$$expression$$` (inline) or `$$\n...\n$$` (multi-line) |
| Columns | `:::columns` / `:::column` / `:::end` |
| Table of Contents | `[toc]` |
| Breadcrumb | `[breadcrumb]` |

## Rich Text Formatting
Inline formatting within any text content:
- **Bold**: `**text**`
- *Italic*: `*text*`
- `Code`: `` `text` ``
- ~~Strikethrough~~: `~~text~~`
- Links: `[text](url)`

## Actions

### get
```json
{"action": "get", "block_id": "xxx"}
```

### children
```json
{"action": "children", "block_id": "xxx"}
```
Returns markdown of child blocks.

### append
```json
{"action": "append", "block_id": "page-id", "content": "## New Section\nParagraph text"}
```

### update
```json
{"action": "update", "block_id": "block-id", "content": "Updated text"}
```

### delete
```json
{"action": "delete", "block_id": "block-id"}
```

## Parameters
- `block_id` - Block ID (required)
- `content` - Markdown content (for append/update)
