import sys

path = 'src/tools/helpers/pagination.test.ts'
with open(path, 'r') as f:
    content = f.read()

content = content.replace('populateDeepChildren(mockNotion as any, blocks)', 'populateDeepChildren(mockNotion as any, blocks as any)')
content = content.replace('fetchChildrenRecursive(blocks, fetchChildren)', 'fetchChildrenRecursive(blocks as any, fetchChildren)')
content = content.replace('fetchChildrenRecursive(blocks, fetchChildren, 5)', 'fetchChildrenRecursive(blocks as any, fetchChildren, 5)')

with open(path, 'w') as f:
    f.write(content)
