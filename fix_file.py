import os

file_path = 'src/credential-state.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if 'export function setState' in line:
        skip = True
        continue
    if skip:
        if '}' in line:
            skip = False
        continue
    new_lines.append(line)

with open(file_path, 'w', encoding='utf-8', newline='\n') as f:
    f.writelines(new_lines)

print("File cleaned.")
