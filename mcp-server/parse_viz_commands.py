#!/usr/bin/env python3
"""
Parser for Viz command documentation HTML files.
Extracts class names, commands, arguments, and descriptions.
Generates a JSON schema for MCP server consumption.
"""

import json
import os
import re
from pathlib import Path
from html.parser import HTMLParser
from typing import Dict, List, Optional, Any


class VizCommandParser(HTMLParser):
    """Parse Viz command HTML documentation."""

    def __init__(self):
        super().__init__()
        self.reset_state()

    def reset_state(self):
        self.in_table = False
        self.in_tr = False
        self.in_th = False
        self.in_td = False
        self.table_type = None  # 'commands' or 'properties'
        self.current_row = []
        self.current_cell = []
        self.tables = {'commands': [], 'properties': []}
        self.title = ""
        self.inherits = None
        self.derived_classes = []
        self.in_header = False
        self.header_text = []

    def handle_starttag(self, tag, attrs):
        if tag == 'title':
            self.in_header = True
        elif tag == 'table':
            self.in_table = True
            self.current_row = []
        elif tag == 'tr' and self.in_table:
            self.in_tr = True
            self.current_row = []
        elif tag == 'th' and self.in_tr:
            self.in_th = True
            self.current_cell = []
        elif tag == 'td' and self.in_tr:
            self.in_td = True
            self.current_cell = []
        elif tag == 'a' and self.in_td:
            # Extract link text (class names)
            pass
        elif tag == 'h2':
            # Look for Commands or Properties headers
            pass
        elif tag == 'i' and (self.in_th or self.in_td):
            # Type indicators
            pass

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_header = False
        elif tag == 'table':
            self.in_table = False
            if self.current_row:
                self.current_row = []
        elif tag == 'tr' and self.in_tr:
            self.in_tr = False
            if self.current_row:
                if self.table_type == 'commands' and len(self.current_row) >= 2:
                    self.tables['commands'].append(self.current_row)
                elif self.table_type == 'properties' and len(self.current_row) >= 2:
                    self.tables['properties'].append(self.current_row)
                self.current_row = []
        elif tag == 'th' and self.in_th:
            self.in_th = False
            self.current_row.append(''.join(self.current_cell).strip())
            self.current_cell = []
        elif tag == 'td' and self.in_td:
            self.in_td = False
            self.current_row.append(''.join(self.current_cell).strip())
            self.current_cell = []

    def handle_data(self, data):
        if self.in_header:
            self.header_text.append(data.strip())
        elif self.in_th or self.in_td:
            self.current_cell.append(data)
        elif '<a name' in data or 'Commands' in data:
            if 'Commands' in data:
                self.table_type = 'commands'
            elif 'Properties' in data:
                self.table_type = 'properties'


def parse_html_file(filepath: str) -> Dict[str, Any]:
    """Parse a single HTML file and extract command data."""
    # Try multiple encodings
    encodings = ['utf-8', 'windows-1252', 'latin-1', 'cp1252']
    content = None

    for encoding in encodings:
        try:
            with open(filepath, 'r', encoding=encoding, errors='ignore') as f:
                content = f.read()
            break
        except Exception:
            continue

    if content is None:
        raise ValueError(f"Could not read file with any encoding: {filepath}")

    # Extract title
    title_match = re.search(r'<title>([^<]+)</title>', content)
    title = title_match.group(1) if title_match else 'Unknown'

    # Extract parent class
    inherits_match = re.search(r"Inherits: <a href='class_([^']+)\.html'>([^<]+)</a>", content)
    inherits = inherits_match.group(2) if inherits_match else None

    # Extract derived classes
    derived = []
    derived_matches = re.findall(r"<a href='class_([^']+)\.html'>([^<]+)</a>", content)
    # Filter out navigation links and self-references
    for match in derived_matches:
        if match[1] != title and match[1] not in ['Top locations', 'Class index', 'Commands', 'Properties']:
            derived.append(match[1])

    # Extract commands
    commands = []
    command_pattern = r'<tr>\s*<th>([A-Z_]+)</th>\s*<td>(.*?)</td>\s*<td>(.*?)</td>\s*</tr>'

    for match in re.finditer(command_pattern, content, re.DOTALL):
        cmd_name = match.group(1)
        args_raw = match.group(2)
        description = match.group(3).replace('&nbsp;', ' ').replace('  ', ' ').strip()

        # Parse arguments
        args = parse_arguments(args_raw)

        commands.append({
            'name': cmd_name,
            'arguments': args,
            'description': description if description and description != '·' else None
        })

    return {
        'className': title,
        'inherits': inherits,
        'derivedClasses': derived,
        'commands': commands,
        'filePath': filepath
    }


def parse_arguments(args_html: str) -> List[Dict[str, Any]]:
    """Parse HTML argument specification."""
    if '·' in args_html or not args_html.strip():
        return []

    args = []

    # Split by <br> tags
    arg_chunks = re.split(r'<br\s*/?>', args_html)

    for chunk in arg_chunks:
        chunk = chunk.strip()
        if not chunk:
            continue

        # Extract type
        type_match = re.search(r'<i>([^<]+)</i>', chunk)
        arg_type = type_match.group(1) if type_match else 'Unknown'

        # Remove type from chunk
        chunk = re.sub(r'<i>[^<]+</i>', '', chunk)

        # Extract name, default, and enum values
        name_match = re.search(r'&nbsp;([^=<]+)', chunk)
        name = name_match.group(1).strip() if name_match else None

        # Extract default value
        default_match = re.search(r'=\s*([^ <&]+)', chunk)
        default = default_match.group(1) if default_match else None

        # Extract enum values
        enum_values = []
        enum_matches = re.findall(r'([A-Z_]+)\s*\(\d+\)', chunk)
        if enum_matches:
            enum_values = enum_matches

        if name:
            arg_entry = {
                'name': name,
                'type': arg_type,
                'default': default
            }
            if enum_values:
                arg_entry['enumValues'] = enum_values
            args.append(arg_entry)

    return args


def parse_all_commands(doc_dir: str) -> Dict[str, Any]:
    """Parse all HTML files in the documentation directory."""
    doc_path = Path(doc_dir)
    classes = {}

    # Find all class_*.html files
    html_files = sorted(doc_path.glob('class_*.html'))

    print(f"Found {len(html_files)} HTML files")

    for i, filepath in enumerate(html_files):
        if i % 10 == 0:
            print(f"Processing {i}/{len(html_files)}: {filepath.name}")

        try:
            data = parse_html_file(str(filepath))
            classes[data['className']] = data
        except Exception as e:
            print(f"Error parsing {filepath.name}: {e}")

    return {
        'version': 'Viz 5.3.1.60000',
        'totalClasses': len(classes),
        'classes': classes
    }


def main():
    """Main entry point."""
    doc_dir = 'viz-cmd-doc-webhelp'
    output_file = 'mcp-server/viz_commands.json'

    print("Parsing Viz command documentation...")
    data = parse_all_commands(doc_dir)

    # Save to JSON
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"[OK] Parsed {data['totalClasses']} classes")
    print(f"[OK] Saved to {output_file}")

    # Print summary
    total_commands = sum(len(cls['commands']) for cls in data['classes'].values())
    print(f"[OK] Total commands: {total_commands}")


if __name__ == '__main__':
    main()
