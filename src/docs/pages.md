# Pages Tool - Full Documentation

## Overview
Page lifecycle: create, get, get_property, update, move, archive, restore, duplicate.

## Important
- **parent_id required** for create (cannot create workspace-level pages)
- Returns **markdown content** for get action
- **get_property** supports paginated properties (relation, rollup, rich_text, people)

## Actions

### create
```json
{"action": "create", "title": "Meeting Notes", "parent_id": "xxx", "content": "# Agenda\n- Item 1"}
```

### get
```json
{"action": "get", "page_id": "xxx"}
```
Returns all properties including: title, rich_text, select, multi_select, number, checkbox, url, email, phone_number, date, relation, rollup, people, files, formula, created_time, last_edited_time, created_by, last_edited_by, status, unique_id.

### get_property
Retrieve a single page property item with auto-pagination for large properties.
```json
{"action": "get_property", "page_id": "xxx", "property_id": "prop_id"}
```
Use this for paginated properties like relation, rollup, rich_text, or people that may exceed inline limits.

### update
```json
{"action": "update", "page_id": "xxx", "append_content": "\n## New Section"}
```

### move
Move a page to a new parent page.
```json
{"action": "move", "page_id": "xxx", "parent_id": "new_parent_id"}
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
- `property_id` - Property ID (required for get_property action)
- `icon` - Emoji icon
- `cover` - Cover image URL
- `archived` - Archive status (boolean, for update action)
