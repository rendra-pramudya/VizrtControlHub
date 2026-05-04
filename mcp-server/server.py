#!/usr/bin/env python3
"""
MCP Server for Viz Command Control Hub.
Provides tools for Claude to interact with Viz engine commands.
"""

import json
import sys
from pathlib import Path
from typing import List

from mcp.server import Server
from mcp.types import (
    Tool,
    TextContent,
)

# Import the Viz Engine client
from viz_engine_client import VizEngineClient


# Initialize server
server = Server("viz-commands")


class VizCommandsHandler:
    """Handler for Viz commands database."""

    def __init__(self):
        self.commands_data = {}
        self.scripting_data = {}
        self.engine_client = None
        self.load_commands()
        self.load_scripting()
        self.load_engine_client()

    def load_commands(self):
        """Load commands from viz_commands.json."""
        json_path = Path(__file__).parent / "viz_commands.json"

        if not json_path.exists():
            raise FileNotFoundError(
                f"viz_commands.json not found at {json_path}. "
                "Please run parse_viz_commands.py first."
            )

        with open(json_path, 'r', encoding='utf-8') as f:
            self.commands_data = json.load(f)

        total_commands = sum(
            len(cls.get('commands', []))
            for cls in self.commands_data.get('classes', {}).values()
        )
        print(
            f"Loaded {self.commands_data['totalClasses']} Viz classes "
            f"({total_commands} commands)",
            file=sys.stderr
        )

    def load_scripting(self):
        """Load scripting documentation from viz_scripting.json."""
        json_path = Path(__file__).parent / "viz_scripting.json"

        if not json_path.exists():
            print(
                f"Warning: viz_scripting.json not found at {json_path}. "
                "Run parse_viz_scripting.py first.",
                file=sys.stderr
            )
            return

        with open(json_path, 'r', encoding='utf-8') as f:
            self.scripting_data = json.load(f)

        total_methods = sum(
            len(dt.get('methods', []))
            for dt in self.scripting_data.get('dataTypes', {}).values()
        )
        total_properties = sum(
            len(dt.get('properties', []))
            for dt in self.scripting_data.get('dataTypes', {}).values()
        )
        print(
            f"Loaded {self.scripting_data.get('totalDataTypes', 0)} Viz data types "
            f"({total_methods} methods, {total_properties} properties)",
            file=sys.stderr
        )

    def load_engine_client(self):
        """Load Viz Engine client for command execution."""
        try:
            self.engine_client = VizEngineClient()
            engines = self.engine_client.list_engines()
            enabled = sum(1 for e in engines if e['enabled'])
            print(
                f"Loaded {len(engines)} engine config(s) ({enabled} enabled)",
                file=sys.stderr
            )
        except Exception as e:
            print(f"Warning: Could not load engine client: {e}", file=sys.stderr)
            self.engine_client = None

    def execute_command(self, engine_id: str, command: str) -> str:
        """Execute a command on Viz Engine with longer timeout."""
        if not self.engine_client:
            return "Engine client not available. Check configuration."

        try:
            # Use longer timeout (15 seconds) for command execution
            success, response = self.engine_client.send_command(
                engine_id,
                command,
                timeout=15
            )
            if success:
                return f"[OK] {response}"
            else:
                return f"[ERROR] {response}"
        except Exception as e:
            return f"[ERROR] {str(e)}"

    def get_engine_status(self, engine_id: str = None) -> str:
        """Get status of one or all engines."""
        if not self.engine_client:
            return "Engine client not available."

        engines = self.engine_client.list_engines()

        if engine_id:
            # Get status of specific engine
            engine = next((e for e in engines if e['id'] == engine_id), None)
            if not engine:
                return f"Engine '{engine_id}' not found"

            connected, status = self.engine_client.get_status(engine_id)
            return f"{'[CONNECTED]' if connected else '[DISCONNECTED]'} {engine['name']}: {status}"
        else:
            # Get status of all engines
            result = "Engine Status:\n\n"
            for engine in engines:
                if not engine['enabled']:
                    result += f"- {engine['name']} ({engine['id']}): [DISABLED]\n"
                else:
                    connected, status = self.engine_client.get_status(engine['id'])
                    result += f"- {engine['name']} ({engine['id']}): {'[CONNECTED]' if connected else '[DISCONNECTED]'}\n"
            return result

    def list_classes(self, filter_str: str = None) -> str:
        """List available classes."""
        classes = self.commands_data.get('classes', {})

        if filter_str:
            filter_str = filter_str.lower()
            filtered = [
                name for name in sorted(classes.keys())
                if filter_str in name.lower()
            ]
        else:
            filtered = sorted(classes.keys())

        result = f"Found {len(filtered)} Viz classes:\n\n"
        for name in filtered[:100]:  # Limit to 100 for readability
            cls_data = classes[name]
            cmd_count = len(cls_data.get('commands', []))
            inherits = cls_data.get('inherits', 'N/A')
            result += f"- {name} (inherits: {inherits}, {cmd_count} commands)\n"

        if len(filtered) > 100:
            result += f"\n... and {len(filtered) - 100} more classes"

        return result

    def get_class_commands(self, class_name: str) -> str:
        """Get commands for a class."""
        classes = self.commands_data.get('classes', {})

        # Case-insensitive lookup
        cls_data = None
        actual_name = None
        for name, data in classes.items():
            if name.lower() == class_name.lower():
                cls_data = data
                actual_name = name
                break

        if not cls_data:
            return f"Class '{class_name}' not found"

        commands = cls_data.get('commands', [])
        result = f"Commands for {actual_name}:\n"
        result += f"Inherits from: {cls_data.get('inherits', 'N/A')}\n"
        result += f"Total commands: {len(commands)}\n\n"

        for cmd in commands:
            result += f"- {cmd['name']}"
            if cmd.get('description'):
                result += f": {cmd['description']}"
            if cmd.get('arguments'):
                result += f"\n  Arguments: {len(cmd['arguments'])} arg(s)"
            result += "\n"

        return result

    def get_command_details(self, class_name: str, command_name: str) -> str:
        """Get detailed command information."""
        classes = self.commands_data.get('classes', {})

        # Case-insensitive class lookup
        cls_data = None
        for name, data in classes.items():
            if name.lower() == class_name.lower():
                cls_data = data
                break

        if not cls_data:
            return f"Class '{class_name}' not found"

        commands = cls_data.get('commands', [])
        command = None
        for cmd in commands:
            if cmd['name'].lower() == command_name.lower():
                command = cmd
                break

        if not command:
            return f"Command '{command_name}' not found in class '{class_name}'"

        result = f"Command: {class_name}.{command['name']}\n"
        result += f"Description: {command.get('description', 'N/A')}\n\n"

        args_list = command.get('arguments', [])
        if args_list:
            result += "Arguments:\n"
            for i, arg in enumerate(args_list, 1):
                result += f"{i}. {arg['name']}\n"
                result += f"   Type: {arg['type']}\n"
                if arg.get('default'):
                    result += f"   Default: {arg['default']}\n"
                if arg.get('enumValues'):
                    result += f"   Options: {', '.join(arg['enumValues'])}\n"
        else:
            result += "No arguments required.\n"

        return result

    def search_commands(self, keyword: str, limit: int = 20) -> str:
        """Search commands by keyword."""
        keyword = keyword.lower()

        if not keyword:
            return "Search keyword required"

        results = []
        classes = self.commands_data.get('classes', {})

        for class_name, cls_data in classes.items():
            for cmd in cls_data.get('commands', []):
                if (keyword in cmd['name'].lower() or
                    keyword in (cmd.get('description', '') or '').lower()):
                    results.append({
                        'class': class_name,
                        'command': cmd['name'],
                        'description': cmd.get('description', ''),
                        'argCount': len(cmd.get('arguments', []))
                    })

        if not results:
            return f"No commands found matching '{keyword}'"

        results = results[:limit]
        result = f"Found {len(results)} commands matching '{keyword}':\n\n"
        for match in results:
            result += f"- {match['class']}.{match['command']}"
            if match['description']:
                result += f": {match['description']}"
            result += f" ({match['argCount']} args)\n"

        return result

    def get_class_hierarchy(self, class_name: str) -> str:
        """Get class hierarchy information."""
        classes = self.commands_data.get('classes', {})

        # Case-insensitive lookup
        cls_data = None
        actual_name = None
        for name, data in classes.items():
            if name.lower() == class_name.lower():
                cls_data = data
                actual_name = name
                break

        if not cls_data:
            return f"Class '{class_name}' not found"

        result = f"Class Hierarchy for {actual_name}:\n\n"
        result += f"Parent: {cls_data.get('inherits', 'None')}\n"

        derived = cls_data.get('derivedClasses', [])
        if derived:
            result += f"\nDerived classes ({len(derived)}):\n"
            for derived_name in sorted(derived)[:20]:
                result += f"  - {derived_name}\n"
            if len(derived) > 20:
                result += f"  ... and {len(derived) - 20} more\n"
        else:
            result += "\nNo known derived classes.\n"

        return result

    def list_data_types(self, filter_str: str = None) -> str:
        """List available data types."""
        data_types = self.scripting_data.get('dataTypes', {})

        if not data_types:
            return "No scripting data loaded. Run parse_viz_scripting.py first."

        if filter_str:
            filter_str = filter_str.lower()
            filtered = [
                name for name in sorted(data_types.keys())
                if filter_str in name.lower()
            ]
        else:
            filtered = sorted(data_types.keys())

        result = f"Found {len(filtered)} Viz data types:\n\n"
        for name in filtered[:100]:  # Limit to 100 for readability
            dt_data = data_types[name]
            methods = len(dt_data.get('methods', []))
            properties = len(dt_data.get('properties', []))
            base = dt_data.get('baseType', 'N/A')
            result += f"- {name} (base: {base}, {methods} methods, {properties} properties)\n"

        if len(filtered) > 100:
            result += f"\n... and {len(filtered) - 100} more data types"

        return result

    def get_data_type_info(self, type_name: str) -> str:
        """Get detailed information about a data type."""
        data_types = self.scripting_data.get('dataTypes', {})

        if not data_types:
            return "No scripting data loaded."

        # Case-insensitive lookup
        dt_data = None
        actual_name = None
        for name, data in data_types.items():
            if name.lower() == type_name.lower():
                dt_data = data
                actual_name = name
                break

        if not dt_data:
            return f"Data type '{type_name}' not found"

        result = f"Data Type: {actual_name}\n"
        result += f"Base Type: {dt_data.get('baseType', 'N/A')}\n\n"

        if dt_data.get('description'):
            result += f"Description: {dt_data['description']}\n\n"

        # Properties
        properties = dt_data.get('properties', [])
        if properties:
            result += f"Properties ({len(properties)}):\n"
            for prop in properties:
                result += f"- {prop['name']} As {prop['type']}"
                if prop.get('readOnly'):
                    result += " [read-only]"
                if prop.get('description'):
                    result += f": {prop['description']}"
                result += "\n"
            result += "\n"

        # Methods
        methods = dt_data.get('methods', [])
        if methods:
            result += f"Methods ({len(methods)}):\n"
            for method in methods:
                result += f"- {method['type']} {method['name']}("
                if method['parameters']:
                    result += ", ".join(f"{p['name']} As {p['type']}" for p in method['parameters'])
                result += ")"
                if method.get('returnType'):
                    result += f" As {method['returnType']}"
                if method.get('description'):
                    result += f": {method['description']}"
                result += "\n"

        return result

    def search_scripting(self, keyword: str, limit: int = 20) -> str:
        """Search scripting documentation by keyword."""
        keyword = keyword.lower()

        if not keyword:
            return "Search keyword required"

        data_types = self.scripting_data.get('dataTypes', {})

        if not data_types:
            return "No scripting data loaded."

        results = []

        for type_name, dt_data in data_types.items():
            # Search in type name
            if keyword in type_name.lower():
                results.append({
                    'type': 'dataType',
                    'name': type_name,
                    'context': f"{dt_data.get('description', 'Data type')}",
                    'relevance': 3
                })

            # Search in description
            desc = dt_data.get('description', '').lower()
            if keyword in desc:
                results.append({
                    'type': 'dataType',
                    'name': type_name,
                    'context': f"{dt_data.get('description', '')}",
                    'relevance': 2
                })

            # Search in methods
            for method in dt_data.get('methods', []):
                if keyword in method['name'].lower():
                    results.append({
                        'type': 'method',
                        'name': f"{type_name}.{method['name']}",
                        'context': method.get('description', ''),
                        'relevance': 3
                    })

            # Search in properties
            for prop in dt_data.get('properties', []):
                if keyword in prop['name'].lower():
                    results.append({
                        'type': 'property',
                        'name': f"{type_name}.{prop['name']}",
                        'context': prop.get('description', ''),
                        'relevance': 2
                    })

        if not results:
            return f"No matches found for '{keyword}' in scripting documentation"

        # Sort by relevance and limit
        results = sorted(results, key=lambda x: x['relevance'], reverse=True)[:limit]

        result = f"Found {len(results)} matches for '{keyword}':\n\n"
        for match in results:
            result += f"- [{match['type']}] {match['name']}"
            if match['context']:
                result += f": {match['context']}"
            result += "\n"

        return result


# Initialize handler
handler = VizCommandsHandler()


@server.list_tools()
def list_tools() -> List[Tool]:
    """Return available tools."""
    return [
        Tool(
            name="list_viz_classes",
            description="List all available Viz command classes",
            inputSchema={
                "type": "object",
                "properties": {
                    "filter": {
                        "type": "string",
                        "description": "Optional filter by class name (case-insensitive)"
                    }
                }
            }
        ),
        Tool(
            name="get_class_commands",
            description="Get all commands for a specific Viz class",
            inputSchema={
                "type": "object",
                "properties": {
                    "className": {
                        "type": "string",
                        "description": "Name of the Viz class (e.g., 'CMain', 'CStage', 'CVCamera')"
                    }
                },
                "required": ["className"]
            }
        ),
        Tool(
            name="get_command_details",
            description="Get detailed information about a specific command including arguments",
            inputSchema={
                "type": "object",
                "properties": {
                    "className": {
                        "type": "string",
                        "description": "Name of the Viz class"
                    },
                    "commandName": {
                        "type": "string",
                        "description": "Name of the command (e.g., 'GET', 'SET', 'ADD')"
                    }
                },
                "required": ["className", "commandName"]
            }
        ),
        Tool(
            name="search_commands",
            description="Search for commands by keyword (searches in command names and descriptions)",
            inputSchema={
                "type": "object",
                "properties": {
                    "keyword": {
                        "type": "string",
                        "description": "Search keyword (case-insensitive)"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max results to return (default: 20)",
                        "default": 20
                    }
                },
                "required": ["keyword"]
            }
        ),
        Tool(
            name="get_class_hierarchy",
            description="Get inheritance information for a Viz class",
            inputSchema={
                "type": "object",
                "properties": {
                    "className": {
                        "type": "string",
                        "description": "Name of the Viz class"
                    }
                },
                "required": ["className"]
            }
        ),
        Tool(
            name="list_data_types",
            description="List all available Viz scripting data types",
            inputSchema={
                "type": "object",
                "properties": {
                    "filter": {
                        "type": "string",
                        "description": "Optional filter by data type name (case-insensitive)"
                    }
                }
            }
        ),
        Tool(
            name="get_data_type_info",
            description="Get detailed information about a Viz scripting data type (properties and methods)",
            inputSchema={
                "type": "object",
                "properties": {
                    "typeName": {
                        "type": "string",
                        "description": "Name of the data type (e.g., 'Stage', 'Director', 'Container')"
                    }
                },
                "required": ["typeName"]
            }
        ),
        Tool(
            name="search_scripting",
            description="Search Viz scripting documentation by keyword (searches data types, methods, and properties)",
            inputSchema={
                "type": "object",
                "properties": {
                    "keyword": {
                        "type": "string",
                        "description": "Search keyword (case-insensitive)"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max results to return (default: 20)",
                        "default": 20
                    }
                },
                "required": ["keyword"]
            }
        ),
        Tool(
            name="execute_viz_command",
            description="Execute a Viz engine command on the specified engine",
            inputSchema={
                "type": "object",
                "properties": {
                    "engineId": {
                        "type": "string",
                        "description": "Engine ID (e.g., 'engine-1'). Get list with get_engine_status"
                    },
                    "command": {
                        "type": "string",
                        "description": "Viz command to execute (e.g., 'CStage.CONTINUE', 'CMain.ABOUT')"
                    }
                },
                "required": ["engineId", "command"]
            }
        ),
        Tool(
            name="get_engine_status",
            description="Check connection status of Viz engines",
            inputSchema={
                "type": "object",
                "properties": {
                    "engineId": {
                        "type": "string",
                        "description": "Optional specific engine ID. If not provided, shows all engines"
                    }
                }
            }
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> List[TextContent]:
    """Handle tool calls."""
    try:
        if name == "list_viz_classes":
            result = handler.list_classes(arguments.get('filter'))
        elif name == "get_class_commands":
            result = handler.get_class_commands(arguments['className'])
        elif name == "get_command_details":
            result = handler.get_command_details(
                arguments['className'],
                arguments['commandName']
            )
        elif name == "search_commands":
            result = handler.search_commands(
                arguments['keyword'],
                arguments.get('limit', 20)
            )
        elif name == "get_class_hierarchy":
            result = handler.get_class_hierarchy(arguments['className'])
        elif name == "list_data_types":
            result = handler.list_data_types(arguments.get('filter'))
        elif name == "get_data_type_info":
            result = handler.get_data_type_info(arguments['typeName'])
        elif name == "search_scripting":
            result = handler.search_scripting(
                arguments['keyword'],
                arguments.get('limit', 20)
            )
        elif name == "execute_viz_command":
            result = handler.execute_command(
                arguments['engineId'],
                arguments['command']
            )
        elif name == "get_engine_status":
            result = handler.get_engine_status(arguments.get('engineId'))
        else:
            result = f"Unknown tool: {name}"

        return [TextContent(type="text", text=result)]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]


if __name__ == "__main__":
    import asyncio
    from mcp.server import stdio

    async def main():
        async with stdio.stdio_server(server) as (read_stream, write_stream):
            await server.run(read_stream, write_stream)

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
