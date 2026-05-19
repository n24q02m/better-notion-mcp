import re

with open("src/tools/registry.test.ts", "r") as f:
    content = f.read()

# For tools that return <untrusted_notion_content>, they should use toContain
pattern = r"expect\(result\.content\[0\]\.text\)\.toBe\(JSON\.stringify\((mockResult), null, 2\)\)"
replacement = r"expect(result.content[0].text).toContain(JSON.stringify(\1, null, 2))"

content = re.sub(pattern, replacement, content)

with open("src/tools/registry.test.ts", "w") as f:
    f.write(content)
