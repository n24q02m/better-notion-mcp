# Pages Tool - Full Documentation

## Overview
Page lifecycle: create, get, update, archive, restore, duplicate.

## Important
- **parent_id required** for create (cannot create workspace-level pages)
- Returns **markdown content** for get action

## Actions

### create
```json
{"action": "create", "title": "Meeting Notes", "parent_id": "xxx", "content": "# Agenda\n- Item 1"}
```

### get
```json
{"action": "get", "page_id": "xxx"}
```

### update
```json
{"action": "update", "page_id": "xxx", "append_content": "\n## New Section"}
```

### archive
```json
{"action": "archive", "page_ids": ["xxx", "yyy"]}
```

### restore
```json
{"action": "restore", "page_id": "xxx"}
```

### duplicate
```json
{"action": "duplicate", "page_id": "xxx"}
```

## Parameters
- `page_id` - Page ID (required for most actions)
- `page_ids` - Multiple page IDs for batch operations
- `title` - Page title
- `content` - Markdown content
- `append_content` - Markdown to append
- `prepend_content` - [Deprecated] Not supported by Notion API. Use blocks tool to insert at specific position
- `parent_id` - Parent page or database ID
- `properties` - Page properties (for database pages)
- `icon` - Emoji icon
- `cover` - Cover image URL
- `archived` - Archive status (boolean, for update action)
