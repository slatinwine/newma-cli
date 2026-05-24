#!/usr/bin/env python3
"""
Python Plugin Executor

Executes Markdown-based plugins by communicating with AI and returning results.
Communicates with TypeScript core via JSON over stdin/stdout.
"""

import sys
import json
import os
import re
from typing import Dict, Any, Optional, List
from pathlib import Path
import subprocess
import tempfile


class MarkdownPluginParser:
    """Parse Markdown plugin files with frontmatter"""

    def __init__(self, content: str):
        self.content = content
        self.frontmatter: Dict[str, Any] = {}
        self.body: str = ""
        self._parse()

    def _parse(self):
        """Parse frontmatter and body from markdown content"""
        # Check for YAML frontmatter
        if self.content.startswith('---'):
            # Find the end of frontmatter
            end_idx = self.content.find('---', 3)
            if end_idx != -1:
                frontmatter_text = self.content[3:end_idx].strip()
                self.body = self.content[end_idx + 3:].strip()
                self._parse_yaml_frontmatter(frontmatter_text)
            else:
                self.body = self.content
        else:
            self.body = self.content

        # Extract metadata from body if no frontmatter
        if not self.frontmatter:
            self._extract_metadata_from_body()

    def _parse_yaml_frontmatter(self, text: str):
        """Simple YAML frontmatter parser"""
        for line in text.split('\n'):
            if ':' in line:
                key, value = line.split(':', 1)
                self.frontmatter[key.strip()] = value.strip().strip('"').strip("'")

    def _extract_metadata_from_body(self):
        """Extract metadata from body (first heading)"""
        # First heading is the name
        heading_match = re.match(r'^#\s+(.+)$', self.body, re.MULTILINE)
        if heading_match:
            self.frontmatter['name'] = heading_match.group(1).strip()
            self.frontmatter['description'] = heading_match.group(1).strip()

    def get_name(self) -> str:
        """Get plugin name"""
        return self.frontmatter.get('name', 'unnamed-plugin')

    def get_description(self) -> str:
        """Get plugin description"""
        return self.frontmatter.get('description', '')

    def get_version(self) -> str:
        """Get plugin version"""
        return self.frontmatter.get('version', '1.0.0')

    def get_body(self) -> str:
        """Get plugin body (workflow instructions)"""
        return self.body


class AIExecutor:
    """Execute AI-driven workflows using OpenAI API"""

    def __init__(self, api_key: str, base_url: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key
        self.base_url = base_url or os.environ.get('OPENAI_BASE_URL', 'https://api.openai.com/v1')
        self.model = model or os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')
        self.endpoint = f"{self.base_url}/chat/completions"

    def execute_workflow(self, workflow: str, user_input: str, context: Dict[str, Any]) -> str:
        """Execute workflow with AI"""
        import urllib.request
        import urllib.error

        # Build system prompt
        system_prompt = f"""You are a helpful AI assistant executing a workflow plugin.

WORKFLOW INSTRUCTIONS:
{workflow}

USER INPUT:
{user_input}

CONTEXT:
{json.dumps(context, indent=2)}

Follow the workflow instructions step by step. Execute each step carefully and provide detailed output.
"""

        # Build request
        request_data = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_input}
            ],
            "temperature": 0.7
        }

        # Make API request
        req = urllib.request.Request(
            self.endpoint,
            data=json.dumps(request_data).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.api_key}'
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=120) as response:
                response_data = json.loads(response.read().decode('utf-8'))
                return response_data['choices'][0]['message']['content']
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8')
            raise Exception(f"API request failed: {e.code} - {error_body}")
        except urllib.error.URLError as e:
            raise Exception(f"Network error: {e.reason}")
        except Exception as e:
            raise Exception(f"AI execution failed: {str(e)}")


class PluginExecutor:
    """Main plugin executor"""

    def __init__(self, plugin_path: str):
        self.plugin_path = Path(plugin_path)
        self.parser: Optional[MarkdownPluginParser] = None
        self.ai_executor: Optional[AIExecutor] = None
        self._load_plugin()

    def _load_plugin(self):
        """Load and parse plugin file"""
        content = self.plugin_path.read_text(encoding='utf-8')
        self.parser = MarkdownPluginParser(content)

    def execute(self, user_input: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the plugin"""
        try:
            # Initialize AI executor
            api_key = context.get('apiKey') or os.environ.get('OPENAI_API_KEY')
            if not api_key:
                return {
                    'success': False,
                    'error': 'OPENAI_API_KEY not found in context or environment'
                }

            self.ai_executor = AIExecutor(
                api_key=api_key,
                base_url=context.get('baseUrl'),
                model=context.get('model')
            )

            # Execute workflow
            workflow = self.parser.get_body()
            result = self.ai_executor.execute_workflow(workflow, user_input, context)

            return {
                'success': True,
                'output': result,
                'plugin': {
                    'name': self.parser.get_name(),
                    'description': self.parser.get_description(),
                    'version': self.parser.get_version()
                }
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }


def main():
    """Main entry point for CLI usage"""
    if len(sys.argv) < 3:
        print("Usage: execute_plugin.py <plugin_file> <user_input> [context_json]", file=sys.stderr)
        print("\nExample:", file=sys.stderr)
        print("  execute_plugin.py plugins/code-review.md 'Review src/app.ts'", file=sys.stderr)
        sys.exit(1)

    plugin_file = sys.argv[1]
    user_input = sys.argv[2]
    context = {}

    if len(sys.argv) > 3:
        try:
            context = json.loads(sys.argv[3])
        except json.JSONDecodeError:
            print(f"Invalid JSON context: {sys.argv[3]}", file=sys.stderr)
            sys.exit(1)

    # Execute plugin
    executor = PluginExecutor(plugin_file)
    result = executor.execute(user_input, context)

    # Output result as JSON
    print(json.dumps(result, ensure_ascii=False, indent=2))


def stdin_mode():
    """Read commands from stdin (for IPC with TypeScript)"""
    for line in sys.stdin:
        try:
            command = json.loads(line.strip())
            cmd_type = command.get('type')

            if cmd_type == 'execute':
                executor = PluginExecutor(command['pluginPath'])
                result = executor.execute(
                    command['userInput'],
                    command.get('context', {})
                )
                print(json.dumps(result, ensure_ascii=False))
                sys.stdout.flush()

            elif cmd_type == 'info':
                executor = PluginExecutor(command['pluginPath'])
                info = {
                    'name': executor.parser.get_name(),
                    'description': executor.parser.get_description(),
                    'version': executor.parser.get_version()
                }
                print(json.dumps(info, ensure_ascii=False))
                sys.stdout.flush()

            elif cmd_type == 'exit':
                break

        except json.JSONDecodeError:
            print(json.dumps({'success': False, 'error': 'Invalid JSON command'}))
            sys.stdout.flush()
        except Exception as e:
            print(json.dumps({'success': False, 'error': str(e)}))
            sys.stdout.flush()


if __name__ == '__main__':
    # Check if running in stdin mode
    if len(sys.argv) > 1 and sys.argv[1] == '--stdin':
        stdin_mode()
    else:
        main()
