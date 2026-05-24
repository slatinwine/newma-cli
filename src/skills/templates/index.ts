/**
 * Skill Templates Index
 * Exports all skill templates for easy access
 */

// Import templates first
import { knowledgeSkillTemplate, generateKnowledgeSkill } from './knowledge-skill';
import { codeSkillTemplate, generateCodeSkill } from './code-skill';
import { hybridSkillTemplate, generateHybridSkill } from './hybrid-skill';
import { dataProcessingSkillTemplate, generateDataProcessingSkill } from './data-processing-skill';
import { apiIntegrationSkillTemplate, generateApiIntegrationSkill } from './api-integration-skill';

// Re-export
export { knowledgeSkillTemplate, generateKnowledgeSkill };
export { codeSkillTemplate, generateCodeSkill };
export { hybridSkillTemplate, generateHybridSkill };
export { dataProcessingSkillTemplate, generateDataProcessingSkill };
export { apiIntegrationSkillTemplate, generateApiIntegrationSkill };

/**
 * Template type enum
 */
export enum SkillTemplateType {
  KNOWLEDGE = 'knowledge',
  CODE = 'code',
  HYBRID = 'hybrid',
  DATA_PROCESSING = 'data-processing',
  API_INTEGRATION = 'api-integration',
}

/**
 * Get template by type
 */
export function getTemplate(type: SkillTemplateType) {
  switch (type) {
    case SkillTemplateType.KNOWLEDGE:
      return { knowledgeSkillTemplate, generate: generateKnowledgeSkill };
    case SkillTemplateType.CODE:
      return { codeSkillTemplate, generate: generateCodeSkill };
    case SkillTemplateType.HYBRID:
      return { hybridSkillTemplate, generate: generateHybridSkill };
    case SkillTemplateType.DATA_PROCESSING:
      return { dataProcessingSkillTemplate, generate: generateDataProcessingSkill };
    case SkillTemplateType.API_INTEGRATION:
      return { apiIntegrationSkillTemplate, generate: generateApiIntegrationSkill };
    default:
      throw new Error(`Unknown template type: ${type}`);
  }
}

/**
 * List all available templates
 */
export function listTemplates(): Array<{
  type: SkillTemplateType;
  name: string;
  description: string;
}> {
  return [
    {
      type: SkillTemplateType.KNOWLEDGE,
      name: 'Knowledge Skill',
      description: 'Pure markdown guidance skill (no code execution)',
    },
    {
      type: SkillTemplateType.CODE,
      name: 'Code Skill',
      description: 'Executable TypeScript skill with tool integration',
    },
    {
      type: SkillTemplateType.HYBRID,
      name: 'Hybrid Skill',
      description: 'Combines knowledge guidance with code execution',
    },
    {
      type: SkillTemplateType.DATA_PROCESSING,
      name: 'Data Processing Skill',
      description: 'Specialized for data transformation and analysis',
    },
    {
      type: SkillTemplateType.API_INTEGRATION,
      name: 'API Integration Skill',
      description: 'Specialized for API integration and automation',
    },
  ];
}
