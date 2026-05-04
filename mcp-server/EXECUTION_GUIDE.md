# MCP Server - Command Execution Guide

## FIXED: Execution Now Working! ✓

Your MCP server can now **execute actual Viz commands** on the engine.

## New Execution Tools

### 1. `execute_viz_command`
Execute a command on a specific Viz engine.

**Parameters:**
- `engineId` - Engine identifier (from `get_engine_status`)
- `command` - Command to execute (space-separated, e.g., `CMain ABOUT`)

**Example:**
```
User: "Send the CONTINUE command to CStage"
Claude: [calls execute_viz_command("engine-1", "CStage CONTINUE")]
Response: [OK] Command executed
```

### 2. `get_engine_status`
Check which Viz engines are available and connected.

**Parameters:**
- `engineId` (optional) - Check specific engine, or all if not provided

**Example:**
```
Claude: [calls get_engine_status()]
Response:
  - Viz Engine 1 (engine-1): [CONNECTED]
  - Viz Engine 2 (engine-2): [DISABLED]
```

## Command Format

**Important:** Use **space-separated** format, NOT dot-separated:

```
CORRECT:   CStage CONTINUE
WRONG:     CStage.CONTINUE

CORRECT:   CMain ALLOCATE 100
WRONG:     CMain.ALLOCATE(100)

CORRECT:   CCamera GET
WRONG:     CCamera.GET
```

## Total MCP Tools: 11

**Information Tools (8):**
1. `list_viz_classes` - Browse command classes
2. `get_class_commands` - Show commands in class
3. `get_command_details` - Get command info
4. `search_commands` - Search commands
5. `get_class_hierarchy` - View hierarchy
6. `list_data_types` - Browse scripting types
7. `get_data_type_info` - Get type details
8. `search_scripting` - Search scripting

**Execution Tools (3) - NEW:**
9. `execute_viz_command` - Send command to engine
10. `get_engine_status` - Check engine status

## Usage Workflow

### 1. Check Engines
```
User: "What Viz engines are available?"
Claude: [calls get_engine_status()]
```

### 2. Get Command Info
```
User: "What does the CONTINUE command do?"
Claude: [calls search_commands("continue")]
→ Shows CStage.CONTINUE command details
```

### 3. Execute Command
```
User: "Continue the animation"
Claude: [calls execute_viz_command("engine-1", "CStage CONTINUE")]
→ Sends command to Viz engine
```

## Example Commands

### Animation Control
```
CStage CONTINUE              # Continue animation
CStage PAUSE                 # Pause animation
CStage STOP                  # Stop animation
```

### Camera Control
```
CVCamera GET                 # Get camera info
CVCamera RESET               # Reset camera
```

### Container Operations
```
CStage ADD Container1        # Add new container
CStage DELETE_CONTAINER      # Delete container
```

### Stage Queries
```
CStage GET DIRECTOR_TREE     # Get director tree
CStage GET ALL              # Get all info
```

## Engine Configuration

Engines are configured in `config.js`:
```json
{
  "engine": [
    {
      "id": "engine-1",
      "name": "Viz Engine 1",
      "host": "127.0.0.1",
      "port": 6100,
      "enabled": true
    }
  ]
}
```

## Advanced: Command With Arguments

For commands with arguments, include them space-separated:

```
CMain ALLOCATE 100           # Allocate 100MB memory
CStage SEARCH_KEYFRAME name  # Search for keyframe
```

## Error Handling

If a command fails:
```
[ERROR] Connection refused: Cannot reach engine
[ERROR] Command not found: CInvalid.COMMAND
[ERROR] Connection timed out (5s)
```

Check:
1. Engine is running: `get_engine_status()`
2. Engine address in `config.js`
3. Command format (space-separated)
4. Command exists in documentation: `search_commands()`

## Integration Example

**Scenario: Batch operations**
```
User: "Continue animation and get stage info"

Claude:
1. [calls execute_viz_command("engine-1", "CStage CONTINUE")]
   → Command executed
   
2. [calls execute_viz_command("engine-1", "CStage GET")]
   → Gets stage info
   
3. Summarizes results for user
```

## Performance

- Connection: <100ms
- Command execution: depends on Viz engine
- Response timeout: 5 seconds

## Security Notes

- Commands are executed directly on the Viz engine
- No validation - ensure Claude understands command safety
- Use command documentation tools first to understand what commands do
- Consider restricting sensitive engines with `"enabled": false`

## Testing

Test connection with:
```bash
python mcp-server/viz_engine_client.py
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Engine not found" | Check engine ID with `get_engine_status()` |
| "Connection refused" | Verify Viz engine is running on configured host:port |
| "Invalid command" | Use space-separated format, not dots |
| "Command not found" | Check command exists with `search_commands()` |

## Next Steps

1. ✓ MCP server running with execution support
2. Ask Claude to help with Viz engine control
3. Use documentation tools to learn commands
4. Execute commands safely

---

**Ready to go!** Claude can now both query and execute Viz commands.
