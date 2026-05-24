import React from 'react';
import { Box, Text } from 'ink';

interface MarkdownViewProps {
  content: string;
  indent?: number;
}

// Simple markdown parser for terminal rendering
function parseMarkdown(markdown: string): React.ReactNode[] {
  const lines = markdown.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block detection
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim() || 'text';
      const codeLines: string[] = [];
      i++;

      // Find closing ```
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }

      nodes.push(
        <Box key={`code-${i}`} flexDirection="column" marginBottom={1}>
          <Box borderStyle="single" borderColor="#F39C12" paddingX={1}>
            <Text color="#F39C12" bold>
              {lang}
            </Text>
          </Box>
          <Box borderStyle="single" borderColor="#95A5A6" paddingX={1}>
            <Text dimColor>{codeLines.join('\n')}</Text>
          </Box>
        </Box>
      );
      i++;
      continue;
    }

    // Table detection (| separated)
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableLines: string[] = [line];
      i++;

      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }

      nodes.push(renderTable(tableLines));
      continue;
    }

    // Headers (# ## ###)
    if (line.startsWith('#')) {
      const match = line.match(/^(#+)\s+(.*)/);
      if (match) {
        const level = match[1].length;
        const text = match[2];
        const color = level === 1 ? '#E74C3C' : level === 2 ? '#E67E22' : '#3498DB';
        nodes.push(
          <Box key={`header-${i}`} marginBottom={1}>
            <Text color={color} bold>
              {'#'.repeat(level)} {parseInline(text)}
            </Text>
          </Box>
        );
      }
      i++;
      continue;
    }

    // Lists (- * or numbered)
    if (line.trim().match(/^[-*]\s+/) || line.trim().match(/^\d+\.\s+/)) {
      nodes.push(
        <Box key={`list-${i}`}>
          <Text color="#27AE60">• {parseInline(line.trim().replace(/^[-*]\s+|^\d+\.\s+/, ''))}</Text>
        </Box>
      );
      i++;
      continue;
    }

    // Regular paragraph with inline formatting
    if (line.trim()) {
      nodes.push(
        <Box key={`p-${i}`} marginBottom={1}>
          <Text>{parseInline(line)}</Text>
        </Box>
      );
    }

    i++;
  }

  return nodes;
}

// Parse inline markdown (bold, italic, code)
function parseInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Code (inline)
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(<Text key={key++} color="#F39C12">{codeMatch[1]}</Text>);
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      parts.push(<Text key={key++} bold>{boldMatch[1]}</Text>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      parts.push(<Text key={key++} italic>{italicMatch[1]}</Text>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Links [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      parts.push(
        <Text key={key++} color="#3498DB" underline>
          {linkMatch[1]}
        </Text>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Regular text
    const nextFormat =
      remaining.indexOf('`') !== -1
        ? remaining.indexOf('`')
        : remaining.indexOf('**') !== -1
        ? remaining.indexOf('**')
        : remaining.indexOf('*') !== -1
        ? remaining.indexOf('*')
        : remaining.indexOf('[') !== -1
        ? remaining.indexOf('[')
        : remaining.length;

    if (nextFormat > 0) {
      parts.push(remaining.slice(0, nextFormat));
      remaining = remaining.slice(nextFormat);
    } else {
      parts.push(remaining);
      break;
    }
  }

  return <>{parts}</>;
}

// Render table
function renderTable(lines: string[]): React.ReactNode {
  const rows = lines.map(line =>
    line
      .split('|')
      .map(cell => cell.trim())
      .filter((_, i, arr) => i > 0 && i < arr.length - 1)
  );

  // Calculate column widths
  const colWidths: number[] = [];
  rows.forEach(row => {
    row.forEach((cell, i) => {
      colWidths[i] = Math.max(colWidths[i] || 0, cell.length);
    });
  });

  return (
    <Box flexDirection="column" marginBottom={1}>
      {rows.map((row, rowIndex) => {
        const isHeader = rowIndex === 0;
        const isSeparator = rowIndex === 1 && row.every(cell => /^-+$/.test(cell));

        if (isSeparator) return null;

        return (
          <Box key={`row-${rowIndex}`}>
            {row.map((cell, colIndex) => (
              <Box
                key={`cell-${colIndex}`}
                width={colWidths[colIndex] + 2}
                borderStyle={rowIndex === 0 ? 'double' : 'single'}
                borderColor={isHeader ? '#3498DB' : '#95A5A6'}
                paddingX={1}
              >
                <Text bold={isHeader}>{cell}</Text>
              </Box>
            ))}
          </Box>
        );
      })}
    </Box>
  );
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, indent = 0 }) => {
  const nodes = parseMarkdown(content);

  return (
    <Box marginLeft={indent} flexDirection="column">
      {nodes}
    </Box>
  );
};
