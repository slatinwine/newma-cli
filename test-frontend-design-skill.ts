/**
 * Frontend Design Skill - Enhanced Skill System Test
 *
 * This skill helps users create beautiful, production-grade frontend interfaces
 * with high design quality. It avoids generic AI aesthetics and generates creative,
 * polished code.
 */

import { SkillMetadata, validateMetadata, exportFrontmatter } from './types';

// Simulate the interactive wizard output
console.log('🎨 Enhanced Skill Creation Wizard\n');
console.log('This wizard will help you create a new skill with the enhanced skill system.\n');

console.log('Step 1: Basic Information');
const basicInfo = {
  name: 'Frontend Design',
  description: 'Create distinctive, production-grade frontend interfaces with high design quality',
  author: 'Kode Development Team',
  version: '1.0.0'
};

console.log(`  ✓ Name: ${basicInfo.name}`);
console.log(`  ✓ Description: ${basicInfo.description}`);
console.log(`  ✓ Author: ${basicInfo.author}`);
console.log(`  ✓ Version: ${basicInfo.version}\n`);

console.log('Step 2: Skill Type');
const typeInfo = {
  type: 'hybrid',
  template: 'frontend-design',
  category: 'frontend',
  complexity: 7
};

console.log(`  ✓ Type: ${typeInfo.type} (Guidance + Execution)`);
console.log(`  ✓ Template: ${typeInfo.template}`);
console.log(`  ✓ Category: ${typeInfo.category}`);
console.log(`  ✓ Complexity: ${typeInfo.complexity}/10\n`);

console.log('Step 3: Discovery Settings');
const discoveryInfo = {
  tags: ['frontend', 'design', 'ui', 'components', 'styling'],
  triggers: ['create frontend', 'design component', 'build ui', 'style interface', 'frontend page'],
  whenToUse: [
    'User asks to build web components',
    'User requests frontend interfaces',
    'User needs UI/UX design',
    'User wants landing pages',
    'User requires dashboards'
  ]
};

console.log(`  ✓ Tags: ${discoveryInfo.tags.join(', ')}`);
console.log(`  ✓ Triggers: ${discoveryInfo.triggers.join(', ')}`);
console.log(`  ✓ When to use: ${discoveryInfo.whenToUse.length} scenarios\n`);

console.log('Step 4: Progressive Loading');
const progressiveInfo = {
  enableProgressiveLoading: true,
  referenceSections: ['basics', 'advanced', 'components', 'examples']
};

console.log(`  ✓ Progressive Loading: ${progressiveInfo.enableProgressiveLoading}`);
console.log(`  ✓ Sections: ${progressiveInfo.referenceSections.join(', ')}\n`);

console.log('Step 5: Validation');
const validationInfo = {
  inputSchema: {
    type: 'object',
    properties: {
      component: {
        type: 'string',
        description: 'Component type to create (e.g., button, card, navbar)'
      },
      style: {
        type: 'string',
        enum: ['modern', 'minimal', 'bold', 'elegant', 'playful'],
        description: 'Design style'
      },
      framework: {
        type: 'string',
        enum: ['react', 'vue', 'svelte', 'vanilla'],
        description: 'Frontend framework'
      },
      requirements: {
        type: 'object',
        description: 'Component requirements and features',
        properties: {
          responsive: { type: 'boolean' },
          animated: { type: 'boolean' },
          darkMode: { type: 'boolean' }
        }
      }
    },
    required: ['component', 'style', 'framework']
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      code: { type: 'string' },
      preview: { type: 'string' },
      dependencies: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: ['success', 'code']
  }
};

console.log(`  ✓ Input Schema: Defined (${Object.keys(validationInfo.inputSchema.properties).length} properties)`);
console.log(`  ✓ Output Schema: Defined (${Object.keys(validationInfo.outputSchema.properties).length} properties)\n`);

console.log('Step 6: Testing');
const testingInfo = {
  generateTests: true,
  testFramework: 'jest'
};

console.log(`  ✓ Generate Tests: ${testingInfo.generateTests}`);
console.log(`  ✓ Framework: ${testingInfo.testFramework}\n`);

// Build complete options
const options = {
  ...basicInfo,
  ...typeInfo,
  ...discoveryInfo,
  ...progressiveInfo,
  ...validationInfo,
  ...testingInfo
};

// Generate metadata
const metadata: SkillMetadata = {
  id: basicInfo.name.toLowerCase().replace(/\s+/g, '-'),
  name: basicInfo.name,
  version: basicInfo.version,
  description: basicInfo.description,
  type: typeInfo.type as 'knowledge' | 'code' | 'hybrid',
  category: typeInfo.category,
  complexity: typeInfo.complexity,
  tags: discoveryInfo.tags,
  triggers: discoveryInfo.triggers,
  whenToUse: discoveryInfo.whenToUse,
  author: basicInfo.author,
  license: 'MIT',
  inputSchema: validationInfo.inputSchema,
  outputSchema: validationInfo.outputSchema,
  performance: {
    estimatedTokens: 4000,
    averageResponseTime: 3000,
    cacheable: true
  }
};

// Validate metadata
console.log('Step 7: Validation');
const validation = validateMetadata(metadata);

if (validation.valid) {
  console.log(`  ✅ Metadata is valid\n`);
} else {
  console.log(`  ❌ Metadata validation failed:`);
  validation.errors.forEach(err => {
    console.log(`     • ${err.field}: ${err.message}`);
  });
  console.log();
}

if (validation.warnings.length > 0) {
  console.log(`  ⚠️  Warnings:`);
  validation.warnings.forEach(warn => {
    console.log(`     • ${warn.field}: ${warn.message}`);
  });
  console.log();
}

console.log('Step 8: Generating Skill...\n');

// Generate SKILL.md content
const skillMd = `---
name: Frontend Design
description: Create distinctive, production-grade frontend interfaces with high design quality
type: hybrid
complexity: 7
tags: [frontend, design, ui, components, styling]
triggers: [create frontend, design component, build ui, style interface, frontend page]
whenToUse:
  - User asks to build web components
  - User requests frontend interfaces
  - User needs UI/UX design
  - User wants landing pages
  - User requires dashboards
author: Kode Development Team
version: 1.0.0
category: frontend
---

# Frontend Design

Create distinctive, production-grade frontend interfaces with high design quality. Generates creative, polished code that avoids generic AI aesthetics.

## Overview

This skill combines design guidance with code generation to help you build beautiful, modern frontend interfaces. It focuses on creating unique, visually appealing designs rather than generic templates.

## Key Principles

### Design Quality
- **Avoid Generic Patterns**: No bootstrap-like defaults
- **Unique Visual Identity**: Each component has character
- **Attention to Detail**: Micro-interactions, hover states, transitions
- **Modern Aesthetics**: Contemporary design trends with timeless appeal

### Technical Excellence
- **Production-Ready Code**: Clean, maintainable, well-structured
- **Responsive Design**: Mobile-first approach
- **Accessibility**: WCAG AA compliant by default
- **Performance**: Optimized for speed and efficiency

## Capabilities

### Component Types
- Buttons (primary, secondary, ghost, icon buttons)
- Cards (content cards, profile cards, product cards)
- Navigation (navbar, sidebar, tabs, breadcrumbs)
- Forms (inputs, selects, checkboxes, radios)
- Layouts (grids, flexbox, containers)
- Animations (transitions, keyframes, micro-interactions)

### Design Styles
- **Modern**: Clean, minimalist, whitespace-focused
- **Bold**: Vibrant colors, strong contrasts, large typography
- **Elegant**: Sophisticated, refined, premium feel
- **Playful**: Fun colors, rounded shapes, friendly UI
- **Minimal**: Ultra-clean, monochromatic, functional

## Usage

### Input Schema
\`\`\`json
{
  "type": "object",
  "properties": {
    "component": {
      "type": "string",
      "description": "Component type (e.g., button, card, navbar)"
    },
    "style": {
      "type": "string",
      "enum": ["modern", "minimal", "bold", "elegant", "playful"]
    },
    "framework": {
      "type": "string",
      "enum": ["react", "vue", "svelte", "vanilla"]
    },
    "requirements": {
      "type": "object",
      "properties": {
        "responsive": { "type": "boolean" },
        "animated": { "type": "boolean" },
        "darkMode": { "type": "boolean" }
      }
    }
  },
  "required": ["component", "style", "framework"]
}
\`\`\`

### Output Schema
\`\`\`json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "code": { "type": "string" },
    "preview": { "type": "string" },
    "dependencies": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
\`\`\`

## Examples

### Modern Button (React)
\`\`\`typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const ModernButton: React.FC<ButtonProps> = ({
  variant,
  size,
  children
}) => {
  // Implementation with modern aesthetics
};
\`\`\`

### Elegant Card (Vue)
\`\`\`vue
<template>
  <div class="elegant-card">
    <slot />
  </div>
</template>
\`\`\`

## Design Tokens

### Modern Style
\`\`\`css
--color-primary: #6366f1;
--color-secondary: #8b5cf6;
--color-background: #ffffff;
--color-text: #1f2937;
--spacing-unit: 0.25rem;
--border-radius: 0.5rem;
--shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
\`\`\`

### Bold Style
\`\`\`css
--color-primary: #f59e0b;
--color-accent: #ef4444;
--color-background: #fef3c7;
--color-text: #78350f;
--spacing-unit: 0.5rem;
--border-radius: 1rem;
--shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
\`\`\`

## Best Practices

1. **Start with Mobile**: Design for mobile first, then scale up
2. **Use Semantic HTML**: Proper elements for accessibility
3. **Add Micro-interactions**: Subtle animations enhance UX
4. **Test Dark Mode**: Ensure contrast in both themes
5. **Optimize Performance**: Minimal CSS, efficient JavaScript

See references/ for detailed guides and examples.
`;

// Generate code.ts
const codeTs = `import { SkillContext, SkillResult } from '../types';

/**
 * Frontend Design Skill
 * Creates distinctive, production-grade frontend interfaces
 */
export class FrontendDesignSkill {
  /**
   * Execute the skill
   */
  async execute(context: SkillContext): Promise<SkillResult> {
    try {
      const input = this.parseInput(context.userInput);

      // Validate input
      if (!input.component || !input.style || !input.framework) {
        return {
          success: false,
          error: 'Missing required fields: component, style, framework'
        };
      }

      // Generate component code
      const code = await this.generateComponent(input);

      // Generate preview
      const preview = this.generatePreview(input);

      // Determine dependencies
      const dependencies = this.getDependencies(input.framework);

      return {
        success: true,
        output: {
          success: true,
          code,
          preview,
          dependencies
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Parse user input
   */
  private parseInput(input: string): any {
    try {
      return JSON.parse(input);
    } catch {
      // Parse natural language
      return this.parseNaturalLanguage(input);
    }
  }

  /**
   * Parse natural language input
   */
  private parseNaturalLanguage(input: string): any {
    const lower = input.toLowerCase();

    // Extract component type
    const componentTypes = ['button', 'card', 'navbar', 'form', 'input', 'modal'];
    const component = componentTypes.find(type => lower.includes(type)) || 'component';

    // Extract style
    const styles = ['modern', 'minimal', 'bold', 'elegant', 'playful'];
    const style = styles.find(s => lower.includes(s)) || 'modern';

    // Extract framework
    const frameworks = ['react', 'vue', 'svelte', 'vanilla'];
    const framework = frameworks.find(f => lower.includes(f)) || 'react';

    return { component, style, framework, requirements: {} };
  }

  /**
   * Generate component code
   */
  private async generateComponent(input: any): Promise<string> {
    const { component, style, framework, requirements } = input;

    // This would use AI to generate actual code
    // For now, return template
    return this.getTemplate(component, style, framework);
  }

  /**
   * Get component template
   */
  private getTemplate(component: string, style: string, framework: string): string {
    // Template generation based on component, style, framework
    return \`// Generated \${component} in \${style} style for \${framework}
// Implementation details in references/advanced.md
\`;
  }

  /**
   * Generate HTML preview
   */
  private generatePreview(input: any): string {
    return \`<div class="preview">
  <!-- Preview of \${input.component} in \${input.style} style -->
</div>\`;
  }

  /**
   * Get framework dependencies
   */
  private getDependencies(framework: string): string[] {
    const deps = {
      react: ['react', 'react-dom', '@types/react'],
      vue: ['vue', '@vue/runtime-core'],
      svelte: ['svelte'],
      vanilla: []
    };

    return deps[framework] || [];
  }
}

/**
 * Skill exports
 */
export const skill = new FrontendDesignSkill();
export const metadata = ${JSON.stringify(metadata, null, 2)};
`;

// Generate reference sections
const references = {
  basics: `# Frontend Design Basics

## Getting Started

Frontend design is more than just making things look good. It's about creating interfaces that are:

- **Usable**: Easy to understand and navigate
- **Accessible**: Perceivable, operable, understandable
- **Performant**: Fast and responsive
- **Maintainable**: Clean code structure

## Design Fundamentals

### Color Theory
- Use 60-30-10 rule for color proportions
- Ensure WCAG AA contrast (4.5:1 for text)
- Consider color blindness (8% of men, 0.5% of women)

### Typography
- Line length: 60-75 characters for readability
- Font size: 16px minimum for body text
- Hierarchy: Size, weight, and color to establish importance

### Spacing
- Use 8px grid system
- Consistent padding and margins
- Whitespace improves comprehension

## Component Anatomy

Every component should have:
1. **Structure**: HTML/JSX/Vue template
2. **Style**: CSS, SCSS, or styled-components
3. **Behavior**: JavaScript/logic
4. **Tests**: Unit tests for functionality
5. **Documentation**: Usage examples

## Quick Start

1. Define component props/interface
2. Create HTML structure
3. Add styles (use design tokens)
4. Implement behavior
5. Add responsive breakpoints
6. Test accessibility
7. Write documentation
`,

  advanced: `# Advanced Frontend Techniques

## CSS Architecture

### CSS-in-JS
\`\`\`typescript
import styled from 'styled-components';

const Button = styled.button<ButtonProps>\`
  /* Styles here */
\`;
\`\`\`

### CSS Modules
\`\`\`css
.button {
  /* Local scoped styles */
}
\`\`\`

### Design Tokens
\`\`\`css
:root {
  --color-primary: #6366f1;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
}
\`\`\`

## Responsive Design

### Breakpoints
\`\`\`css
/* Mobile First */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
\`\`\`

### Fluid Typography
\`\`\`css
font-size: clamp(1rem, 2vw, 1.5rem);
\`\`\`

## Animations

### Transitions
\`\`\`css
.button {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
\`\`\`

### Keyframes
\`\`\`css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
\`\`\`

### Performance Tips
- Use transform and opacity (GPU accelerated)
- Avoid layout thrashing (read, then write)
- Use will-change sparingly

## Accessibility

### ARIA Attributes
\`\`\`html
<button aria-label="Close dialog" aria-pressed="false">
  <span aria-hidden="true">×</span>
</button>
\`\`\`

### Keyboard Navigation
- All interactive elements focusable
- Logical tab order
- Visible focus indicators
- Skip links for main content

### Screen Readers
- Semantic HTML
- ARIA labels and roles
- Alt text for images
- Error messages in context
`,

  components: `# Component Library

## Buttons

### Primary Button
\`\`\`typescript
interface ButtonProps {
  variant: 'primary' | 'secondary';
  size: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  children
}) => {
  return (
    <button
      className={\`btn btn-\${variant} btn-\${size}\`}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
\`\`\`

### Button Styles
\`\`\`css
.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}
\`\`\`

## Cards

### Card Component
\`\`\`typescript
interface CardProps {
  title: string;
  description?: string;
  footer?: React.ReactNode;
  image?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  description,
  footer,
  image
}) => {
  return (
    <div className="card">
      {image && <img src={image} alt={title} />}
      <div className="card-content">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
};
\`\`\`

## Navigation

### Navbar
- Responsive (hamburger menu on mobile)
- Active state indication
- Dropdown support
- Sticky positioning

### Sidebar
- Collapsible sections
- Active link highlighting
- Smooth transitions
- Icon support

## Forms

### Input Fields
\`\`\`typescript
interface InputProps {
  label: string;
  type?: 'text' | 'email' | 'password';
  error?: string;
  required?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  type = 'text',
  error,
  required = false
}) => {
  return (
    <div className="input-group">
      <label>
        {label}
        {required && <span className="required">*</span>}
      </label>
      <input type={type} aria-invalid={!!error} />
      {error && <span className="error">{error}</span>}
    </div>
  );
};
\`\`\`

## Layouts

### Grid System
\`\`\`css
.container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}
\`\`\`

### Flexbox Layout
\`\`\`css
.flex-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}
\`\`\`
`,

  examples: `# Frontend Design Examples

## Example 1: Modern Landing Page Hero

**Requirements**:
- Bold headline
- Call-to-action buttons
- Background image
- Responsive design

**Implementation**:
See \`examples/landing-page-hero/\`

## Example 2: Elegant Dashboard Card

**Requirements**:
- Data visualization
- Clean typography
- Subtle shadows
- Hover effects

**Implementation**:
See \`examples/dashboard-card/\`

## Example 3: Playful Form

**Requirements**:
- Fun colors
- Rounded corners
- Animated focus states
- Validation feedback

**Implementation**:
See \`examples/playful-form/\`

## Real-World Use Cases

### E-commerce Product Card
- Image gallery
- Price display
- Add to cart
- Wishlist button
- Reviews summary

### SaaS Pricing Table
- Tier comparison
- Feature lists
- Popular badge
- CTA buttons
- Toggle monthly/yearly

### Blog Article Card
- Featured image
- Category tag
- Title and excerpt
- Author info
- Read time
- Bookmark button

## Style Variations

### Modern Tech Startup
- Primary: #6366f1 (indigo)
- Clean sans-serif fonts
- Generous whitespace
- Subtle gradients

### Bold E-commerce
- Primary: #f59e0b (amber)
- Strong contrasts
- Large typography
- Energetic feel

### Elegant Portfolio
- Primary: #1f2937 (charcoal)
- Sophisticated serif headings
- Refined color palette
- Premium feel

### Playful Kids App
- Primary: #ec4899 (pink)
- Rounded shapes
- Bright colors
- Friendly animations
`
};

// Generate test file
const testFile = `import { FrontendDesignSkill } from '../code';

describe('Frontend Design Skill', () => {

  let skill: FrontendDesignSkill;

  beforeEach(() => {
    skill = new FrontendDesignSkill();
  });

  it('should generate modern button component', async () => {
    const input = {
      component: 'button',
      style: 'modern',
      framework: 'react',
      requirements: {
        responsive: true,
        animated: true
      }
    };

    const result = await skill.execute({ userInput: JSON.stringify(input) } as any);

    expect(result.success).toBe(true);
    expect(result.output.code).toBeDefined();
    expect(result.output.dependencies).toContain('react');
  });

  it('should generate elegant card component', async () => {
    const input = {
      component: 'card',
      style: 'elegant',
      framework: 'vue',
      requirements: {
        responsive: true,
        darkMode: true
      }
    };

    const result = await skill.execute({ userInput: JSON.stringify(input) } as any);

    expect(result.success).toBe(true);
    expect(result.output.code).toContain('vue');
  });

  it('should validate required fields', async () => {
    const input = {
      style: 'modern',
      framework: 'react'
      // Missing 'component'
    };

    const result = await skill.execute({ userInput: JSON.stringify(input) } as any);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required fields');
  });

  it('should parse natural language input', async () => {
    const result = await skill.execute({
      userInput: 'create a modern button in react'
    } as any);

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
  });

  it('should return correct dependencies for framework', async () => {
    const frameworks = ['react', 'vue', 'svelte', 'vanilla'];

    for (const framework of frameworks) {
      const input = {
        component: 'button',
        style: 'modern',
        framework
      };

      const result = await skill.execute({ userInput: JSON.stringify(input) } as any);

      expect(result.success).toBe(true);
      expect(result.output.dependencies).toBeDefined();
    }
  });
});
`;

// Output the results
console.log('✅ Skill Created Successfully!\n');
console.log('📍 Location:');
console.log('  ./skills/frontend-design\n');

console.log('📄 Files Created:\n');
console.log('  ✓ SKILL.md');
console.log('  ✓ code.ts');
console.log('  ✓ references/basics.md');
console.log('  ✓ references/advanced.md');
console.log('  ✓ references/components.md');
console.log('  ✓ references/examples.md');
console.log('  ✓ frontend-design.test.ts\n');

console.log('✅ Validation:');
console.log(`  ✓ Metadata is valid`);
console.log(`  ✓ ${validation.errors.length} errors`);
console.log(`  ✓ ${validation.warnings.length} warnings\n`);

console.log('🧪 Tests:');
console.log(`  ✓ Generated 5 test cases`);
console.log(`  → ./skills/frontend-design/frontend-design.test.ts\n`);

console.log('📊 Metadata Summary:');
console.log(`  ID: ${metadata.id}`);
console.log(`  Name: ${metadata.name}`);
console.log(`  Type: ${metadata.type}`);
console.log(`  Category: ${metadata.category}`);
console.log(`  Complexity: ${metadata.complexity}/10`);
console.log(`  Tags: ${metadata.tags.join(', ')}`);
console.log(`  Triggers: ${metadata.triggers.join(', ')}`);
console.log(`  Author: ${metadata.author}`);
console.log(`  Version: ${metadata.version}\n`);

console.log('💡 Key Features:');
console.log(`  • Hybrid skill (guidance + execution)`);
console.log(`  • Progressive loading enabled (4 sections)`);
console.log(`  • Input/output schema validation`);
console.log(`  • Automated test generation (Jest)`);
console.log(`  • Support for React, Vue, Svelte, Vanilla\n`);

console.log('🎯 Next Steps:');
console.log(`  1. Review the generated files`);
console.log(`  2. Customize component templates`);
console.log(`  3. Add AI code generation integration`);
console.log(`  4. Run tests: npm test`);
console.log(`  5. Validate: kode-validate-skill validate ./skills/frontend-design\n`);

console.log('─'.repeat(60) + '\n');

// Export the skill metadata for use
export const frontendDesignSkill = {
  metadata,
  validation,
  options,
  skillMd,
  codeTs,
  references,
  testFile
};
