import re

file_path = 'src/tools/registry.test.ts'

with open(file_path, 'r') as f:
    content = f.read()

# Fix the first error: `should route pages tool correctly`
# We need to construct a valid GetPageResult object or cast to any
mock_result_replacement = """
      const mockResult = {
        action: 'get',
        page_id: 'page-123',
        title: 'Test',
        url: 'https://notion.so/page-123',
        created_time: '2023-01-01T00:00:00.000Z',
        last_edited_time: '2023-01-02T00:00:00.000Z',
        archived: false,
        properties: {},
        content: '# Test Content',
        block_count: 5
      } as any
"""

content = re.sub(
    r"const mockResult = \{ action: 'get', page_id: 'page-123', title: 'Test' \}",
    mock_result_replacement.strip(),
    content
)

# Fix the second error: `should return well-formed success response structure`
# The mockResolvedValue({ ok: true }) is invalid because PagesResult doesn't have `ok`.
# We can cast it to any for the purpose of this test which just checks JSON output structure.
content = content.replace(
    "vi.mocked(pages).mockResolvedValue({ ok: true })",
    "vi.mocked(pages).mockResolvedValue({ ok: true } as any)"
)

with open(file_path, 'w') as f:
    f.write(content)
