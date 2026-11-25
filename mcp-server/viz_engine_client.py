#!/usr/bin/env python3
"""
Viz Engine TCP Client for command execution.
Mimics the Node.js engineService functionality.
"""

import json
import socket
import sys
from pathlib import Path
from typing import Dict, Optional, Tuple


class VizEngineClient:
    """TCP client for Viz Engine command execution."""

    def __init__(self, config_path: str = "config.js"):
        """Initialize with config file path."""
        self.config = self._load_config(config_path)
        self.engines = {e['id']: e for e in self.config.get('engine', [])}

    def _load_config(self, config_path: str) -> Dict:
        """Load config from config.js file."""
        config_file = Path(config_path)

        if not config_file.exists():
            # Try relative to mcp-server directory (one level up)
            config_file = Path(__file__).parent.parent / config_path

        # Settings now live in config.json at the repo root (config.js is a
        # JS loader that adds secrets from .env and can't be parsed as JSON).
        if config_file.name == "config.js" or not config_file.exists():
            config_file = Path(__file__).parent.parent / "config.json"

        if not config_file.exists():
            raise FileNotFoundError(f"Config file not found: {config_path} (tried: {config_file})")

        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse {config_file.name}: {e}")

    def get_engine_config(self, engine_id: str) -> Optional[Dict]:
        """Get engine configuration."""
        engine = self.engines.get(engine_id)
        if not engine:
            raise ValueError(f"Engine '{engine_id}' not found in config")
        if not engine.get('enabled', True):
            raise ValueError(f"Engine '{engine_id}' is disabled")
        return engine

    def list_engines(self) -> list:
        """List all available engines."""
        return [
            {
                'id': e['id'],
                'name': e.get('name', e['id']),
                'host': e['host'],
                'port': e['port'],
                'enabled': e.get('enabled', True)
            }
            for e in self.config.get('engine', [])
        ]

    def send_command(self, engine_id: str, command: str, timeout: int = 10) -> Tuple[bool, str]:
        """
        Send command to Viz Engine via TCP socket.

        Args:
            engine_id: Engine identifier
            command: Viz command (e.g., "CStage CONTINUE")
            timeout: Connection timeout in seconds (default: 10)

        Returns:
            Tuple of (success, response)
        """
        try:
            engine = self.get_engine_config(engine_id)
        except ValueError as e:
            return False, str(e)

        host = engine['host']
        port = engine['port']

        try:
            # Create TCP socket
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as client:
                client.settimeout(timeout)

                # Connect to Viz Engine
                client.connect((host, port))

                # Send command with null terminator
                client.sendall((command + "\0").encode('utf-8'))

                # Receive response
                response = b''
                while True:
                    try:
                        chunk = client.recv(4096)
                        if not chunk:
                            break
                        response += chunk
                        # Check if we got null terminator
                        if b'\0' in response:
                            break
                    except socket.timeout:
                        break

                # Decode and clean response
                response_str = response.decode('utf-8', errors='ignore').replace('\0', '').strip()

                if not response_str:
                    return True, "Command sent (no response)"

                return True, response_str

        except socket.timeout:
            return False, f"Connection timed out to {host}:{port}"
        except ConnectionRefusedError:
            return False, f"Connection refused to {host}:{port}. Is Viz Engine running?"
        except Exception as e:
            return False, f"Error: {str(e)}"

    def get_status(self, engine_id: str) -> Tuple[bool, str]:
        """
        Check if engine is connected.

        Returns:
            Tuple of (connected, status_message)
        """
        try:
            engine = self.get_engine_config(engine_id)
        except ValueError as e:
            return False, str(e)

        host = engine['host']
        port = engine['port']
        timeout = 3

        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as client:
                client.settimeout(timeout)
                client.connect((host, port))
                return True, f"Connected to {host}:{port}"
        except:
            return False, f"Cannot connect to {host}:{port}"


def main():
    """Test the Viz Engine client."""
    try:
        client = VizEngineClient("../../config.js")

        print("Available Engines:")
        for engine in client.list_engines():
            print(f"  - {engine['name']} ({engine['id']}): {engine['host']}:{engine['port']} {'[enabled]' if engine['enabled'] else '[disabled]'}")

        # Test connection to first enabled engine
        engines = [e for e in client.list_engines() if e['enabled']]
        if engines:
            engine_id = engines[0]['id']
            print(f"\nTesting connection to {engine_id}...")
            connected, status = client.get_status(engine_id)
            print(f"  {status}")

    except Exception as e:
        print(f"Error: {e}")


if __name__ == '__main__':
    main()
