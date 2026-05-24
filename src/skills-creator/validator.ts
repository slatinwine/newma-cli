/**
 * Plugin Code Validator
 *
 * Enhanced validation with type checking, enum usage verification,
 * and automatic error fixing for generated plugin code
 */

import chalk from 'chalk';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fixes?: string[];
}

export class PluginCodeValidator {
  validate(code: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fixes: string[] = [];

    if (!code.match(/^(import|interface|type|const|export)/m)) {
      errors.push('Code must start with import, interface, type, const, or export');
    }

    if (code.match(/^\d+\.\s/m)) {
      errors.push('Code contains numbered list (likely AI thinking process)');
    }

    if (code.includes('"todo":') || code.includes('"actions":')) {
      errors.push('Code contains JSON metadata fields (todo, actions)');
    }

    if (!code.includes('export')) {
      errors.push('Code must have export statement');
    }

    if (!code.includes('Plugin')) {
      errors.push('Code should reference Plugin interface');
    }

    if (code.length < 500) {
      errors.push('Code is too short (< 500 chars), likely incomplete');
    }

    if (code.includes('```')) {
      errors.push('Code contains markdown code block markers');
    }

    const hasToolCategoryImport = code.includes('ToolCategory');
    const hasStringCategory = /category:\s*['"](file|command|utility|analysis|system)['"]/i.test(code);

    if (hasStringCategory) {
      errors.push('category must use ToolCategory enum, not strings');
      fixes.push("Replace category: 'utility' with category: ToolCategory.ANALYSIS");
    }

    if (!hasToolCategoryImport && code.includes('tools:')) {
      errors.push('Missing ToolCategory import');
      fixes.push("Add: import { ToolCategory, Permission } from '../../src/tools/types'");
    }

    const hasStringPermissions = /permissions:\s*\[(['"](read_files|write_files|delete_files|run_commands)['"],?\s*)+\]/i.test(code);

    if (hasStringPermissions) {
      errors.push('permissions must use Permission enum or empty array, not strings');
      fixes.push("Replace permissions: ['read_files'] with permissions: [Permission.READ_FILES]");
    }

    const toolsWithoutParams = this.findToolsMissingParameters(code);
    if (toolsWithoutParams.length > 0) {
      errors.push('Tools missing parameters array: ' + toolsWithoutParams.join(', '));
      fixes.push('Add parameters array to each tool definition');
    }

    const hasIncorrectHandler = /handler:\s*async\s*\(\s*\w*:\s*{[^}]+}\s*,\s*context\s*\)/.test(code);
    if (hasIncorrectHandler) {
      errors.push('handler must use Record<string, unknown> for params, not typed object');
      fixes.push("Change handler: async (params: { a: number }, context) to handler: async (params, context)");
    }

    if (!code.includes("from '../../src/plugins/types'")) {
      errors.push('Missing Plugin type import');
    }

    if (!code.includes("from '../../src/tools/types'") && code.includes('tools:')) {
      warnings.push('Missing ToolCategory/Permission imports - strongly recommended');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fixes: fixes.length > 0 ? fixes : undefined,
    };
  }

  private findToolsMissingParameters(code: string): string[] {
    const toolsWithoutParams: string[] = [];
    const toolPattern = /{\s*name:\s*['"](\w+)['"],\s*description:\s*['"][^']+['"],\s*category:/g;
    let match;

    while ((match = toolPattern.exec(code)) !== null) {
      const toolName = match[1];
      const toolStart = match.index;
      const nextHandlerIndex = code.indexOf('handler:', toolStart);
      if (nextHandlerIndex === -1) continue;

      const toolSection = code.substring(toolStart, nextHandlerIndex);
      if (!toolSection.includes('parameters:')) {
        toolsWithoutParams.push(toolName);
      }
    }

    return toolsWithoutParams;
  }

  autoFix(code: string): string {
    let fixed = code;

    if (!fixed.includes("from '../../src/tools/types'") && fixed.includes('tools:')) {
      fixed = fixed.replace(
        "from '../../src/plugins/types'",
        "from '../../src/plugins/types'\nimport { ToolCategory, Permission } from '../../src/tools/types';"
      );
    }

    fixed = fixed.replace(/category:\s*['"]utility['"]/gi, 'category: ToolCategory.ANALYSIS');
    fixed = fixed.replace(/category:\s*['"]file['"]/gi, 'category: ToolCategory.FILE');
    fixed = fixed.replace(/category:\s*['"]command['"]/gi, 'category: ToolCategory.COMMAND');
    fixed = fixed.replace(/category:\s*['"]system['"]/gi, 'category: ToolCategory.SYSTEM');
    fixed = fixed.replace(/category:\s*['"]analysis['"]/gi, 'category: ToolCategory.ANALYSIS');

    fixed = fixed.replace(/permissions:\s*\[\s*['"]read_only['"]\s*\]/gi, 'permissions: []');
    fixed = fixed.replace(/permissions:\s*\[\s*['"]read_files['"]\s*\]/gi, 'permissions: [Permission.READ_FILES]');
    fixed = fixed.replace(/permissions:\s*\[\s*['"]write_files['"]\s*\]/gi, 'permissions: [Permission.WRITE_FILES]');

    fixed = fixed.replace(
      /({\s*name:\s*['"](\w+)['"],\s*description:\s*['"][^']+['"],\s*category:\s*ToolCategory\.\w+,\s*permissions:\s*\[[^\]]*\],)\s*handler:/g,
      '$1\n      parameters: [],\n      handler:'
    );

    return fixed;
  }

  displayValidation(result: ValidationResult): void {
    if (result.valid) {
      console.log('[Skills Creator] ✅ Code validation passed');
    } else {
      console.warn('[Skills Creator] ⚠️  Validation errors:');
      result.errors.forEach(err => console.error('  ✗ ' + err));
    }

    if (result.warnings.length > 0) {
      console.warn('[Skills Creator] ⚠️  Warnings:');
      result.warnings.forEach(w => console.warn('  ⚠️  ' + w));
    }

    if (result.fixes) {
      console.warn('\n[Suggested fixes:]');
      result.fixes.forEach((fix, idx) => console.warn('  ' + (idx + 1) + '. ' + fix));
    }
  }
}
