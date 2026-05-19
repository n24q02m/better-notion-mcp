with open("src/tools/registry.test.ts", "r") as f:
    content = f.read()

content = content.replace(
    "expect(result.content[0].text).toBe(JSON.stringify(mockResult, null, 2))\n    })\n\n    it('should route help tool and read documentation file', async () => {",
    "expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))\n      expect(result.content[0].text).toContain('<untrusted_notion_content>')\n    })\n\n    it('should route help tool and read documentation file', async () => {"
)

with open("src/tools/registry.test.ts", "w") as f:
    f.write(content)
