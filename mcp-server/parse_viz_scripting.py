#!/usr/bin/env python3
"""
Parser for Viz Scripting documentation HTML files.
Extracts data types, properties, and methods.
Generates a JSON schema for MCP server consumption.
"""

import json
import re
from pathlib import Path
from typing import Dict, List, Any


def parse_scripting_html_file(filepath: str) -> Dict[str, Any]:
    """Parse a single scripting HTML file and extract data type info."""
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

    # Extract description
    desc_match = re.search(r'<h3>Description</h3>\s*([^<]*)', content)
    description = desc_match.group(1).strip() if desc_match else None

    # Extract base type
    base_type_match = re.search(r'<h3>Base type</h3>\s*<a href="DataType([^"]+)\.html">([^<]+)</a>', content)
    base_type = base_type_match.group(2) if base_type_match else None

    # Extract properties
    properties = []
    prop_pattern = r'<tr><td><b>([^<]+)</b>\s+As\s+<a href="([^"]+)">([^<]+)</a>\s*(?:<i>(\[read-only\])?</i>)?\s*</td><td>([^<]*(?:<[^>]*>[^<]*)*)</td></tr>'

    for match in re.finditer(prop_pattern, content, re.DOTALL):
        prop_name = match.group(1).strip()
        prop_type_file = match.group(2)
        prop_type = match.group(3).strip()
        read_only = '[read-only]' in (match.group(4) or '')
        prop_desc = match.group(5).strip().replace('<i>', '').replace('</i>', '').replace('<br>', ' ').replace('\n', ' ')

        properties.append({
            'name': prop_name,
            'type': prop_type,
            'readOnly': read_only,
            'description': prop_desc if prop_desc else None
        })

    # Extract member procedures (methods)
    methods = []
    # Match: Sub/Function methodName(...) As ReturnType
    method_pattern = r'<tr><td>(Sub|Function)\s+<b>([^<]+)</b>\(([^)]*)\)(?:\s+As\s+<a href="([^"]+)">([^<]+)</a>)?\s*</td><td>([^<]*(?:<[^>]*>[^<]*)*)</td></tr>'

    for match in re.finditer(method_pattern, content, re.DOTALL):
        method_type = match.group(1)  # Sub or Function
        method_name = match.group(2).strip()
        params_str = match.group(3).strip()
        return_type_file = match.group(4)
        return_type = match.group(5) if match.group(5) else None
        method_desc = match.group(6).strip().replace('<i>', '').replace('</i>', '').replace('<br>', ' ').replace('\n', ' ')

        # Parse parameters
        params = []
        if params_str:
            # Split by comma but be careful with nested types
            for param in params_str.split(','):
                param = param.strip()
                if param:
                    # Format: name As Type or [out] name As Type
                    param_match = re.match(r'(?:\[out\]\s+)?([^ ]+)\s+As\s+<a[^>]*>([^<]+)</a>', param)
                    if param_match:
                        params.append({
                            'name': param_match.group(1),
                            'type': param_match.group(2)
                        })
                    else:
                        # Try without links
                        param_match = re.match(r'(?:\[out\]\s+)?([^ ]+)\s+As\s+([^ <]+)', param)
                        if param_match:
                            params.append({
                                'name': param_match.group(1),
                                'type': param_match.group(2)
                            })

        methods.append({
            'name': method_name,
            'type': method_type,
            'parameters': params,
            'returnType': return_type,
            'description': method_desc if method_desc else None
        })

    return {
        'dataTypeName': title,
        'baseType': base_type,
        'description': description,
        'properties': properties,
        'methods': methods,
        'filePath': filepath
    }


def parse_all_scripting_docs(doc_dir: str) -> Dict[str, Any]:
    """Parse all scripting documentation files."""
    doc_path = Path(doc_dir)
    data_types = {}
    reference_docs = {}

    # Find all DataType*.html files
    datatype_files = sorted(doc_path.glob('DataType*.html'))
    print(f"Found {len(datatype_files)} data type files")

    for i, filepath in enumerate(datatype_files):
        if i % 10 == 0:
            print(f"Processing {i}/{len(datatype_files)}: {filepath.name}")

        try:
            data = parse_scripting_html_file(str(filepath))
            data_types[data['dataTypeName']] = data
        except Exception as e:
            print(f"Error parsing {filepath.name}: {e}")

    # Find reference documentation files
    ref_files = [
        'ScriptRef.html',
        'ScriptIntroduction.html',
        'GlobalProcedures.html',
        'ScriptCallbacks.html',
        'ScriptDataSharing.html',
        'ScriptExamples.html'
    ]

    for ref_file in ref_files:
        ref_path = doc_path / ref_file
        if ref_path.exists():
            reference_docs[ref_file] = str(ref_path)
            print(f"Found reference: {ref_file}")

    return {
        'version': 'Viz Scripting Documentation',
        'totalDataTypes': len(data_types),
        'dataTypes': data_types,
        'referenceDocuments': reference_docs
    }


def main():
    """Main entry point."""
    doc_dir = 'viz-script-doc-webhelp'
    output_file = 'mcp-server/viz_scripting.json'

    print("Parsing Viz scripting documentation...")
    data = parse_all_scripting_docs(doc_dir)

    # Save to JSON
    from pathlib import Path
    import os
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"[OK] Parsed {data['totalDataTypes']} data types")
    print(f"[OK] Saved to {output_file}")

    # Print summary
    total_methods = sum(
        len(dt.get('methods', []))
        for dt in data['dataTypes'].values()
    )
    total_properties = sum(
        len(dt.get('properties', []))
        for dt in data['dataTypes'].values()
    )
    print(f"[OK] Total methods: {total_methods}")
    print(f"[OK] Total properties: {total_properties}")


if __name__ == '__main__':
    main()
