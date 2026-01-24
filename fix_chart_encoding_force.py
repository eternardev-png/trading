import os

file_path = r"c:\Users\User\Desktop\Project's Antigravity\Work\AlgoResearch Lab\frontend\src\components\ChartPane.jsx"

with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Define replacements (mojibake -> target)
# We use partial strings to be safe
replacements = [
    ('title="Ð Ð°Ñ Ñ‚Ñ€Ð¾Ð¹ÐºÐ¸"', 'title="Настройки"'),
    ('title="Ð Ð°Ñ Ñ‚Ñ€Ð¾Ð¹ÐºÐ¸ Ð³Ñ€Ð°Ñ„Ð¸ÐºÐ°"', 'title="Настройки графика"'),
    ('>âš™<', ">{'\\u2699'}<"),
    ('>âš™ï¸ <', ">{'\\u2699\\uFE0F'}<"),
    # Add any others that might have been missed or half-fixed
    ('вљ™', "{'\\u2699'}"),
]

new_content = content
for old, new in replacements:
    new_content = new_content.replace(old, new)

# Also generic safety net for the specific lines if exact match fails
# We know the line numbers from previous steps (approximate)
lines = new_content.split('\n')
for i, line in enumerate(lines):
    # Line 1006 approx
    if 'className="action-btn"' in line and 'title=' in line and 'Настройки' not in line and 'settings' not in line.lower():
        # This is likely the garbage line if it hasn't been fixed
        if 'Ð' in line or 'Ñ' in line:
             lines[i] = '                                            <button className="action-btn" title="Настройки">{\'\\u2699\'}</button>'
    
    # Line 1050 approx
    if 'title=' in line and 'РќР°С' in line: # Original Russian encoding garbage often looks like this too
         lines[i] = lines[i].replace('РќР°СЃС‚СЂРѕР№РєРё РіСЂР°С„РёРєР°', 'Настройки графика')
         
    if 'title=' in line and 'Ð Ð°Ñ' in line:
         lines[i] = lines[i].replace('Ð Ð°Ñ Ñ‚Ñ€Ð¾Ð¹ÐºÐ¸ Ð³Ñ€Ð°Ñ„Ð¸ÐºÐ°', 'Настройки графика')

new_content = '\n'.join(lines)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Fixed encoding issues.")
