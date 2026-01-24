import os

file_path = r"c:\Users\User\Desktop\Project's Antigravity\Work\AlgoResearch Lab\frontend\src\components\ChartPane.jsx"

with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    # Fix 1: Settings button in indicator row (approx line 1006)
    if 'className="action-btn"' in line and 'title=' in line and 'Ð' in line:
        # Reconstruct the line entirely
        new_line = '                                            <button className="action-btn" title="Настройки">{\'\\u2699\'}</button>\n'
        new_lines.append(new_line)
        print("Fixed Settings button line")
        continue

    # Fix 2: Chart Settings button title (approx line 1050)
    if 'className="chart-control-btn"' in line:
        # The title is usually on the next line or same line. 
        # But in the file view, it was split.
        pass
    
    if 'onClick={() => setShowSettings(true)}' in line:
        new_lines.append(line)
        continue

    if 'title="Ð' in line and 'res' not in line: # 'res' check just to be safe, though unlikely collision
         # This is likely the "Настройки графика" line
         new_line = '                        title="Настройки графика"\n'
         new_lines.append(new_line)
         print("Fixed Chart Settings title")
         continue
         
    # Fix 3: Gear emoji (approx line 1052)
    if 'âš™ï¸' in line or ('â' in line and 'ï¸' in line):
        new_line = '                        {\'\\u2699\\uFE0F\'}\n'
        new_lines.append(new_line)
        print("Fixed Gear Emoji")
        continue

    new_lines.append(line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Finished line-based repairs.")
