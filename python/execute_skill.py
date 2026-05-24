#!/usr/bin/env python3
"""
Python Skill Executor
Executes Claude skills by parsing SKILL.md and calling AI
"""

import sys
import json
import os
import re
from typing import Dict, Any, Optional, List
from pathlib import Path
import urllib.request
import urllib.error


class SkillParser:
    """Parse SKILL.md files with frontmatter"""

    def __init__(self, content: str):
        self.content = content
        self.frontmatter: Dict[str, Any] = {}
        self.body: str = ""
        self._parse()

    def _parse(self):
        """Parse frontmatter and body"""
        if self.content.startswith('---'):
            end_idx = self.content.find('---', 3)
            if end_idx != -1:
                frontmatter_text = self.content[3:end_idx].strip()
                self.body = self.content[end_idx + 3:].strip()
                self._parse_yaml_frontmatter(frontmatter_text)
            else:
                self.body = self.content
        else:
            self.body = self.content

    def _parse_yaml_frontmatter(self, text: str):
        """Improved YAML parser that handles multiline lists"""
        lines = text.split('\n')
        i = 0

        while i < len(lines):
            line = lines[i]
            stripped = line.strip()

            # Skip empty lines and comments
            if not stripped or stripped.startswith('#'):
                i += 1
                continue

            # Check if this is a key with list values (next lines start with "-")
            if ':' in stripped and not stripped.startswith('-'):
                key, value = stripped.split(':', 1)
                key = key.strip()
                value = value.strip()

                # Check if next lines contain list items
                list_items = []
                j = i + 1
                while j < len(lines):
                    next_line = lines[j].strip()
                    if next_line.startswith('- '):
                        # List item
                        list_items.append(next_line[2:].strip().strip('"').strip("'"))
                        j += 1
                    elif next_line and not next_line.startswith('#'):
                        # Not a list item, stop collecting
                        break
                    else:
                        # Empty or comment, continue
                        j += 1

                # If we found list items, use them
                if list_items:
                    # If value is also non-empty, check if it's a list format
                    if value and value.startswith('[') and value.endswith(']'):
                        self.frontmatter[key] = [v.strip().strip('"').strip("'") for v in value[1:-1].split(',')]
                    else:
                        self.frontmatter[key] = list_items
                    i = j - 1  # Will be incremented to j
                else:
                    # No list items, parse as regular value
                    if value.startswith('[') and value.endswith(']'):
                        value = [v.strip().strip('"').strip("'") for v in value[1:-1].split(',')]
                    elif value.startswith('"') or value.startswith("'"):
                        value = value.strip('"').strip("'")

                    self.frontmatter[key] = value

            i += 1

    def get_metadata(self) -> Dict[str, Any]:
        """Get skill metadata"""
        return {
            'name': self.frontmatter.get('name', 'Unnamed Skill'),
            'description': self.frontmatter.get('description', ''),
            'type': self.frontmatter.get('type', 'knowledge'),
            'complexity': int(self.frontmatter.get('complexity', 5)),
            'tags': self.frontmatter.get('tags', []),
            'whenToUse': self.frontmatter.get('whenToUse', []),
            'triggers': self.frontmatter.get('triggers', []),
        }

    def get_body(self) -> str:
        """Get skill body content"""
        return self.body


class SkillExecutor:
    """Execute skill with AI"""

    def __init__(self, api_key: str, base_url: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key
        self.base_url = base_url or os.environ.get('OPENAI_BASE_URL', 'https://api.openai.com/v1')
        self.model = model or os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')
        self.endpoint = f"{self.base_url}/chat/completions"

    def should_trigger(self, skill: SkillParser, user_input: str) -> bool:
        """Check if skill should be triggered"""
        triggers = skill.get_metadata().get('triggers', [])
        user_input_lower = user_input.lower()

        for trigger in triggers:
            if trigger.lower() in user_input_lower:
                return True
        return False

    def execute(self, skill: SkillParser, user_input: str, context: Dict[str, Any]) -> str:
        """Execute skill with AI"""
        metadata = skill.get_metadata()
        skill_body = skill.get_body()

        # Build system prompt
        system_prompt = f"""You are a helpful AI assistant with access to specialized skills.

SKILL: {metadata['name']}
DESCRIPTION: {metadata['description']}
TYPE: {metadata['type']}

SKILL KNOWLEDGE:
{skill_body}

USER INPUT:
{user_input}

CONTEXT:
{json.dumps(context, indent=2)}

Use the skill knowledge to respond to the user's input effectively.
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


class SkillManager:
    """Manage skill discovery and execution"""

    def __init__(self, skill_directory: str):
        self.skill_directory = Path(skill_directory)
        self.skills: Dict[str, SkillParser] = {}
        self.executor: Optional[SkillExecutor] = None

    def discover_skills(self) -> List[str]:
        """Discover all skills in directory"""
        skill_paths = []

        for skill_path in self.skill_directory.rglob('SKILL.md'):
            skill_paths.append(str(skill_path))

            # Load skill
            try:
                content = skill_path.read_text(encoding='utf-8')
                parser = SkillParser(content)
                metadata = parser.get_metadata()
                self.skills[metadata['name']] = parser
            except Exception as e:
                print(f"Warning: Failed to load skill {skill_path}: {e}", file=sys.stderr)

        return skill_paths

    def find_matching_skill(self, user_input: str) -> Optional[SkillParser]:
        """Find skill that should be triggered"""
        user_input_lower = user_input.lower()

        for skill in self.skills.values():
            triggers = skill.get_metadata().get('triggers', [])
            for trigger in triggers:
                if trigger.lower() in user_input_lower:
                    return skill
        return None

    def execute_skill(self, skill_name: str, user_input: str, context: Dict[str, Any]) -> str:
        """Execute specific skill"""
        if skill_name not in self.skills:
            raise ValueError(f"Skill not found: {skill_name}")

        skill = self.skills[skill_name]

        if not self.executor:
            raise ValueError("Executor not initialized. Set API key first.")

        return self.executor.execute(skill, user_input, context)

    def set_executor(self, api_key: str, base_url: Optional[str] = None, model: Optional[str] = None):
        """Initialize AI executor"""
        self.executor = SkillExecutor(api_key, base_url, model)


def main():
    """Main entry point"""
    if len(sys.argv) < 3:
        print("Usage: execute_skill.py <command> [args]", file=sys.stderr)
        print("\nCommands:", file=sys.stderr)
        print("  discover <dir>     - List all skills in directory", file=sys.stderr)
        print("  execute <name> <input> [context] - Execute a skill", file=sys.stderr)
        print("  match <input>      - Find matching skill for input", file=sys.stderr)
        sys.exit(1)

    command = sys.argv[1]

    if command == 'discover':
        if len(sys.argv) < 3:
            print("Error: Missing directory argument", file=sys.stderr)
            sys.exit(1)

        manager = SkillManager(sys.argv[2])
        skills = manager.discover_skills()

        print(f"Found {len(skills)} skills:")
        for skill_name, skill in manager.skills.items():
            metadata = skill.get_metadata()
            print(f"  - {skill_name}: {metadata['description']}")

    elif command == 'execute':
        if len(sys.argv) < 4:
            print("Error: Missing skill name or input", file=sys.stderr)
            sys.exit(1)

        skill_name = sys.argv[2]
        user_input = sys.argv[3]
        context = {}

        if len(sys.argv) > 4:
            try:
                context = json.loads(sys.argv[4])
            except json.JSONDecodeError:
                print(f"Error: Invalid JSON context: {sys.argv[4]}", file=sys.stderr)
                sys.exit(1)

        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            print("Error: OPENAI_API_KEY not found in environment", file=sys.stderr)
            sys.exit(1)

        # Find skill directory
        skill_dir = os.environ.get('SKILL_DIR', '.kode/skills')
        manager = SkillManager(skill_dir)
        manager.discover_skills()
        manager.set_executor(api_key)

        try:
            result = manager.execute_skill(skill_name, user_input, context)
            print(result)
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)

    elif command == 'match':
        if len(sys.argv) < 3:
            print("Error: Missing input", file=sys.stderr)
            sys.exit(1)

        user_input = sys.argv[2]
        skill_dir = os.environ.get('SKILL_DIR', '.kode/skills')

        manager = SkillManager(skill_dir)
        manager.discover_skills()

        api_key = os.environ.get('OPENAI_API_KEY')
        if api_key:
            manager.set_executor(api_key)

        skill = manager.find_matching_skill(user_input)
        if skill:
            metadata = skill.get_metadata()
            print(json.dumps({
                'matched': True,
                'skill': metadata['name'],
                'description': metadata['description']
            }))
        else:
            print(json.dumps({'matched': False}))

    else:
        print(f"Error: Unknown command '{command}'", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
