#!/usr/bin/env python3
"""
Test MCP server command execution without timeouts.
Debug script for timeout issues.
"""

import time
from viz_engine_client import VizEngineClient


def test_execution():
    """Test command execution with timing."""
    print("Initializing Viz Engine client...")
    start = time.time()
    client = VizEngineClient()
    print(f"  Initialized in {time.time() - start:.2f}s")

    # List engines
    print("\n1. Listing engines...")
    start = time.time()
    engines = client.list_engines()
    print(f"  Found {len(engines)} engine(s) in {time.time() - start:.2f}s")
    for e in engines:
        if e['enabled']:
            print(f"    - {e['name']} ({e['id']}): {e['host']}:{e['port']}")

    # Test connection
    print("\n2. Testing connection...")
    start = time.time()
    connected, msg = client.get_status("engine-1")
    print(f"  Status check took {time.time() - start:.2f}s")
    print(f"  Result: {msg}")

    # Test simple command
    print("\n3. Executing simple command (CMain ABOUT)...")
    print("  (This may take a few seconds...)")
    start = time.time()
    success, response = client.send_command("engine-1", "CMain ABOUT", timeout=15)
    elapsed = time.time() - start
    print(f"  Command took {elapsed:.2f}s")
    print(f"  Success: {success}")
    print(f"  Response: {response[:100]}..." if len(response) > 100 else f"  Response: {response}")

    # Test quick command
    print("\n4. Executing quick command (CStage GET)...")
    print("  (This should be faster...)")
    start = time.time()
    success, response = client.send_command("engine-1", "CStage GET", timeout=15)
    elapsed = time.time() - start
    print(f"  Command took {elapsed:.2f}s")
    print(f"  Success: {success}")
    print(f"  Response: {response[:100]}..." if len(response) > 100 else f"  Response: {response}")


if __name__ == "__main__":
    try:
        test_execution()
        print("\n✓ All tests completed successfully!")
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
