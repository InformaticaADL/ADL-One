
import re

def check_balance(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    stack = []
    
    # We are looking for main structure: admin-container
    # And specifically where it closes.
    
    for i, line in enumerate(lines):
        # Remove comments crudely
        clean_line = re.sub(r'{/\*.*?\*/}', '', line)
        
        # Find all tags
        tags = re.finditer(r'</?(\w+)[^>]*>', clean_line)
        
        for match in tags:
            tag_str = match.group(0)
            tag_name = match.group(1)
            
            if tag_name not in ['div', 'form', 'button', 'span', 'strong', 'p', 'h1', 'h2', 'h3', 'h4', 'label', 'input', 'select', 'textarea', 'option']:
                continue
                
            # Self closing
            if tag_str.endswith('/>'):
                continue
            if tag_name in ['input', 'img', 'br', 'hr']: # void tags
                continue
                
            if tag_str.startswith('</'):
                if not stack:
                    print(f"Error: Unexpected closing tag <{tag_name}> at line {i+1}")
                    return
                last = stack.pop()
                if last['name'] != tag_name:
                    print(f"Error: Mismatched tag at line {i+1}. Expected closing </{last['name']}> (opened at {last['line']}), found </{tag_name}>")
                    # return # Don't return, keep going to find more context?
            else:
                stack.append({'name': tag_name, 'line': i+1})
                
    if stack:
        print(f"Error: Unclosed tags remaining: {stack}")
    else:
        print("Structure seems balanced")

check_balance(r'c:\Users\rdiaz\Desktop\PrAdl\ADL-One\frontend-adlone\src\features\medio-ambiente\pages\SolicitudesMaPage.tsx')
