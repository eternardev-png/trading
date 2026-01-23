# -*- coding: utf-8 -*-
import codecs
import re

file_path = r"c:\Users\User\Desktop\Project's Antigravity\Work\AlgoResearch Lab\frontend\src\components\ChartPane.jsx"

# Read file
with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Replace broken patterns with proper symbols using regex
# Pattern for broken eye icons
content = re.sub(r"рџ'Ѓ", "\u25CF", content)  # ● filled circle
content = re.sub(r"рџ'ЃвЂЌрџ—Ё", "\u25CB", content)  # ○ empty circle

# Pattern for broken gear
content = re.sub(r"вљ™", "\u2699", content)  # ⚙ gear

# Pattern for broken arrows
content = re.sub(r"в†'", "\u25B2", content)  # ▲ up triangle
content = re.sub(r"в†"", "\u25BC", content)  # ▼ down triangle

# Write back with UTF-8 BOM
with open(file_path, 'w', encoding='utf-8-sig') as f:
    f.write(content)

print("Icons fixed successfully!")
