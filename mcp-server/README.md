# Viz Control Hub MCP Server

A Model Context Protocol (MCP) server for controlling and querying the Viz engine command interface.

## Overview

This MCP server provides Claude with access to:
- All Viz command classes (274 classes)
- Command definitions and arguments (609 total commands)
- Command search and documentation
- Class hierarchy and inheritance information

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                viz-cmd-doc-webhelp/                │
│         (Viz 5.3.1 HTML Documentation)            │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
        ┌─────────────────────┐
        │ parse_viz_commands  │
        │       .py           │
        └──────────┬──────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │ viz_commands.json    │
        │ (274 classes, 609    │
        │  commands)           │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │    server.py         │
        │  (MCP Server)        │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Claude / IDE        │
        │  (Requests Tools)    │
        └──────────────────────┘
```

## Components

### 1. **parse_viz_commands.py**
Python script that:
- Scans all HTML files in `viz-cmd-doc-webhelp/`
- Extracts class names, commands, arguments, descriptions
- Generates `viz_commands.json` with complete command catalog

**Run:**
```bash
python parse_viz_commands.py
```

**Output:**
- Parsed 274 classes
- Total 609 commands
- Generated `viz_commands.json`

### 2. **viz_commands.json**
Complete structured database of all Viz commands:
```json
{
  "version": "Viz 5.3.1.60000",
  "totalClasses": 274,
  "classes": {
    "CMain": {
      "className": "CMain",
      "inherits": "OBJECTBASE",
      "commands": [
        {
          "name": "ABOUT",
          "arguments": [],
          "description": null
        },
        ...
      ]
    }
  }
}
```

### 3. **server.py**
MCP server that provides 5 tools:

#### Tool: `list_viz_classes`
List all available Viz command classes
- Optional filter by class name
- Returns class names, parent classes, command counts

#### Tool: `get_class_commands`
Get all commands for a specific Viz class
- Shows command names and descriptions
- Lists number of arguments each command takes

#### Tool: `get_command_details`
Get detailed information about a specific command
- Shows all arguments with types and defaults
- Includes enum options for enumerated arguments
- Shows description/usage information

#### Tool: `search_commands`
Search for commands by keyword
- Searches in command names and descriptions
- Case-insensitive
- Returns matching commands with class context

#### Tool: `get_class_hierarchy`
Get inheritance information for a class
- Shows parent class
- Lists derived classes
- Useful for understanding class relationships

## Setup

### Option A: Claude Desktop (Recommended)

1. **Install dependencies:**
```bash
cd mcp-server
pip install -r requirements.txt
```

2. **Add to Claude Desktop config** (`~/.claude/config.json` or `%APPDATA%\Claude\config.json`):

```json
{
  "mcpServers": {
    "viz-commands": {
      "command": "python",
      "args": [
        "path/to/server.py"
      ],
      "env": {
        "PYTHONPATH": "path/to/mcp-server"
      }
    }
  }
}
```

3. **Restart Claude Desktop**

### Option B: VS Code / IDE Extension

Configure in IDE settings to use the MCP server URL or stdio transport.

### Option C: Direct Testing

```bash
cd mcp-server
python server.py
```

## Usage Examples

### Example 1: Find camera commands
```
User: What commands are available for CVCamera?
Claude: [calls get_class_commands("CVCamera")]
Result: Lists all CVCamera commands like GET, SET, etc.
```

### Example 2: Search for animation commands
```
User: What commands can control animation?
Claude: [calls search_commands("animation")]
Result: Shows all commands with "animation" in name or description
```

### Example 3: Get command details
```
User: How do I use the CONTINUE command on CStage?
Claude: [calls get_command_details("CStage", "CONTINUE")]
Result: Shows all arguments, enum options, and description
```

### Example 4: Understand class relationships
```
User: What's the parent class of CVCamera?
Claude: [calls get_class_hierarchy("CVCamera")]
Result: Shows inheritance chain and derived classes
```

## Data Format

### Command Object
```python
{
    "name": "GET",              # Command name
    "arguments": [
        {
            "name": "param1",
            "type": "String",
            "default": "value",
            "enumValues": ["OPTION1", "OPTION2"]
        }
    ],
    "description": "Description of command"
}
```

### Argument Types
- `String` - Text parameter
- `Int` - Integer parameter
- `Float` - Floating point parameter
- `Bool` - Boolean parameter
- `Enum` - Enumerated choice
- `PObject` - Object reference
- `Timecode` - Time value
- `ArgList` - List of arguments
- And others specific to Viz

## Performance

- **Parse time:** ~5 seconds for 274 files
- **JSON size:** ~500KB
- **Startup time:** <1 second
- **Tool response time:** <100ms

## Maintenance

### Updating when Viz documentation changes:

1. Replace `viz-cmd-doc-webhelp/` with new HTML files
2. Run `parse_viz_commands.py` to regenerate JSON
3. MCP server automatically uses updated JSON

### Adding custom tools:

Edit `server.py` to add new tools that leverage the `viz_commands.json` data. Examples:
- Generate Viz script templates
- Validate command syntax
- Create command documentation
- Build command chains

## Troubleshooting

### "viz_commands.json not found"
Run `python parse_viz_commands.py` first

### Encoding errors during parsing
Parser automatically tries multiple encodings (UTF-8, Windows-1252, Latin-1)

### MCP connection fails
Ensure Python path is correct and dependencies are installed

## Future Enhancements

- [ ] Command execution simulator (dry-run)
- [ ] Generate Viz script code from Claude suggestions
- [ ] Real-time command validation
- [ ] Command performance/compatibility tips
- [ ] Integration with Viz server for live execution
