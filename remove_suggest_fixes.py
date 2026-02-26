import re

file_path = 'src/tools/helpers/errors.ts'

with open(file_path, 'r') as f:
    content = f.read()

# Pattern to remove the function suggestFixes
# It handles the function body including nested braces if balanced, but regex is hard for nested structures.
# Instead, since we know the structure is specific here, we can use a simpler approach or just exact string replacement if we had the exact content.

# Let's try to identify the start and end indices.
start_marker = 'export function suggestFixes(error: NotionMCPError): string[] {'
end_marker = 'export function withErrorHandling'

start_index = content.find(start_marker)
if start_index == -1:
    print(f"Could not find start marker: {start_marker}")
    exit(1)

# Find the start of the next function
end_index = content.find(end_marker, start_index)
if end_index == -1:
    print(f"Could not find end marker: {end_marker}")
    exit(1)

# We want to remove everything from start_index up to (but not including) end_index,
# but we should keep the JSDoc for the next function if it exists.
# The JSDoc for withErrorHandling starts before 'export function withErrorHandling'.

# Let's look backwards from end_index to find the start of the JSDoc.
# The JSDoc likely starts with /** and ends before end_marker.
# But we are removing suggestFixes, so we should remove up to the start of the *next* function's documentation.

# Let's print the context around the end_index to be sure.
print(f"Context before end_marker:\n{content[end_index-100:end_index]}")

# Actually, let's just find the closing brace of suggestFixes.
# It ends with 'return suggestions\n}'
function_end_pattern = r'return suggestions\s*\n}'
match = re.search(function_end_pattern, content[start_index:])
if not match:
    print("Could not find function end")
    exit(1)

function_end_index = start_index + match.end()

# Now we have the range to delete: start_index to function_end_index
new_content = content[:start_index] + content[function_end_index:]

# Clean up extra newlines if necessary
# new_content = re.sub(r'\n{3,}', '\n\n', new_content)

with open(file_path, 'w') as f:
    f.write(new_content)

print("Successfully removed suggestFixes function.")
