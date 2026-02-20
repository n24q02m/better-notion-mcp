# Comments Tool - Full Documentation

## Overview
Comments: list, get, create.

## Threading
- Use `page_id` for new discussion
- Use `discussion_id` (from list) for replies

## Actions

### list
```json
{"action": "list", "page_id": "xxx"}
```

### get
Retrieve a single comment by its ID.
```json
{"action": "get", "comment_id": "xxx"}
```

### create (new discussion)
```json
{"action": "create", "page_id": "xxx", "content": "Great work!"}
```

### create (reply)
```json
{"action": "create", "discussion_id": "thread-id", "content": "I agree"}
```

## Parameters
- `page_id` - Page ID
- `comment_id` - Comment ID (for get action)
- `discussion_id` - Discussion ID (for replies)
- `content` - Comment content
