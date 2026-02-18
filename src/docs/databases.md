# Databases Tool - Full Documentation

## Overview
Database operations: create, get, query, create_page, update_page, delete_page, create_data_source, update_data_source, update_database.

## Architecture
- **Database** = container holding one or more data sources
- **Data Source** = has schema (properties) and rows (pages)

## Workflow
1. create → Creates database + initial data source
2. get → Retrieves data_source_id
3. query/create_page/update_page → Uses data_source_id (auto-fetched)

## Actions

### create
```json
{"action": "create", "parent_id": "xxx", "title": "Tasks", "properties": {"Status": {"select": {"options": [{"name": "Todo"}, {"name": "Done"}]}}}}
```

### get
```json
{"action": "get", "database_id": "xxx"}
```

### query
```json
{"action": "query", "database_id": "xxx", "filters": {"property": "Status", "select": {"equals": "Done"}}}
```

### create_page
```json
{"action": "create_page", "database_id": "xxx", "pages": [{"properties": {"Name": "Task 1", "Status": "Todo"}}]}
```

### update_page
```json
{"action": "update_page", "page_id": "yyy", "page_properties": {"Status": "Done"}}
```

### delete_page
```json
{"action": "delete_page", "page_ids": ["yyy", "zzz"]}
```

### update_database
```json
{"action": "update_database", "database_id": "xxx", "title": "Updated Title", "properties": {"Priority": {"select": {"options": [{"name": "High"}, {"name": "Low"}]}}}}
```

### create_data_source
```json
{"action": "create_data_source", "database_id": "xxx", "title": "Q2 Data", "properties": {"Status": {"select": {"options": [{"name": "Active"}]}}}}
```

### update_data_source
```json
{"action": "update_data_source", "data_source_id": "xxx", "title": "Renamed Source", "properties": {"Status": {"select": {"options": [{"name": "Active"}, {"name": "Archived"}]}}}}
```

## Parameters
- `database_id` - Database ID
- `data_source_id` - Data source ID
- `parent_id` - Parent page ID
- `title` - Title
- `properties` - Schema properties
- `filters` / `sorts` / `limit` - Query options
- `search` - Smart search across text fields
- `pages` - Array of pages for bulk operations
- `page_properties` - Properties to update
