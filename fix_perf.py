import re

file_path = 'src/tools/composite/pages.ts'

with open(file_path, 'r') as f:
    content = f.read()

# Replace the inefficient .map().join('') with a for loop
old_code = r"    case 'title':\n    case 'rich_text':\n      value = allResults.map\(\(item: any\) => item\[propertyType\]\?\.plain_text \|\| ''\)\.join\(''\)\n      break"
new_code = """    case 'title':
    case 'rich_text': {
      let combinedText = ''
      for (const item of allResults as any[]) {
        combinedText += item[propertyType]?.plain_text || ''
      }
      value = combinedText
      break
    }"""

# Since we use re.DOTALL or similar might be tricky with newlines, let's do a literal search/replace if possible
# or just look for the specific line.

target_line = "value = allResults.map((item: any) => item[propertyType]?.plain_text || '').join('')"
replacement = """{
      let combinedText = ''
      for (const item of allResults as any[]) {
        combinedText += item[propertyType]?.plain_text || ''
      }
      value = combinedText
    }"""

lines = content.split('\n')
new_lines = []
skip = False
for line in lines:
    if target_line in line:
        # We need to handle the case where the next line is "break"
        # The line itself is: "      value = allResults.map((item: any) => item[propertyType]?.plain_text || '').join('')"
        indent = line[:line.find('value')]
        new_lines.append(f"{indent}case 'title':")
        new_lines.append(f"{indent}case 'rich_text': {{")
        new_lines.append(f"{indent}  let combinedText = ''")
        new_lines.append(f"{indent}  for (const item of allResults as any[]) {{")
        new_lines.append(f"{indent}    combinedText += item[propertyType]?.plain_text || ''")
        new_lines.append(f"{indent}  }}")
        new_lines.append(f"{indent}  value = combinedText")
        new_lines.append(f"{indent}  break")
        new_lines.append(f"{indent}}}")
        skip = True
    elif skip and "break" in line and "case 'title':" not in line and "case 'rich_text':" not in line:
        # We already added break, so skip the next break line if it matches
        skip = False
        continue
    elif "case 'title':" in line or "case 'rich_text':" in line:
        if any(target_line in l for l in lines[lines.index(line):lines.index(line)+5]):
             continue # skip these lines as we will rewrite them when we hit target_line
        else:
             new_lines.append(line)
    else:
        new_lines.append(line)

with open(file_path, 'w') as f:
    f.write('\n'.join(new_lines))
