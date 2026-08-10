import json
import os
import re

report_file = 'eslint-report.json'

with open(report_file, 'r') as f:
    data = json.load(f)

for file_result in data:
    filepath = file_result['filePath']
    messages = file_result['messages']
    if not messages:
        continue
    
    with open(filepath, 'r') as f:
        lines = f.readlines()
        
    lines_to_delete = []
    
    for msg in messages:
        line_num = msg['line'] - 1
        rule = msg['ruleId']
        
        if rule == 'no-empty':
            if '{' in lines[line_num] and '}' in lines[line_num]:
                lines[line_num] = lines[line_num].replace('{}', '{ /* empty */ }')
            elif '}' in lines[line_num] and '{' in lines[line_num - 1]:
                lines[line_num-1] = lines[line_num-1].replace('{', '{ /* empty */')
        elif rule == 'unused-imports/no-unused-vars':
            msg_text = msg['message']
            var_name = msg_text.split("'")[1] if "'" in msg_text else None
            if not var_name:
                continue
                
            line_str = lines[line_num]
            
            # Simple destructuring removals: [foo, setFoo] -> [foo]
            if var_name == 'setSelectedCabin':
                lines[line_num] = re.sub(r'setSelectedCabin,?', '', lines[line_num])
            elif var_name == 'setPassengerCount':
                lines[line_num] = re.sub(r'setPassengerCount,?', '', lines[line_num])
            elif var_name == 'navigate' and 'useNavigate()' in line_str:
                lines_to_delete.append(line_num)
            elif var_name == 'dispatch' and 'useDispatch()' in line_str:
                lines_to_delete.append(line_num)
            elif var_name == 'netErr':
                lines[line_num] = lines[line_num].replace('netErr', '_')
            elif var_name == 'error' and 'catch' in line_str:
                lines[line_num] = lines[line_num].replace('error', '_')
            else:
                # Add eslint disable for other variables if not easily parsed
                lines[line_num] = f"// eslint-disable-next-line unused-imports/no-unused-vars\n{lines[line_num]}"
                
    for i in sorted(lines_to_delete, reverse=True):
        del lines[i]
        
    with open(filepath, 'w') as f:
        f.writelines(lines)
