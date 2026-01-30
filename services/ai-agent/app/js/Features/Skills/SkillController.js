/**
 * Skill Controller
 *
 * Manages AI skills from K-Dense Scientific Skills and Scientific Writer
 * Skills are loaded dynamically from the cloned repositories (160+ skills)
 */

import logger from '@overleaf/logger'
import { getGateway } from '../../Infrastructure/LLMGateway/LLMGateway.js'
import SkillLoader from '../../Infrastructure/Skills/SkillLoader.js'

export const SkillController = {
  /**
   * List available skills
   * GET /project/:projectId/agent/skills
   */
  async listSkills(req, res) {
    try {
      const { category, search } = req.query
      const userTier = req.headers['x-user-tier'] || 'free'

      let skills

      if (search) {
        // Search for relevant skills
        skills = SkillLoader.findRelevantSkills(search, 50)
      } else if (category) {
        // Get skills by category
        const byCategory = SkillLoader.getSkillsByCategory()
        skills = byCategory[category] || []
      } else {
        // Get all skills
        skills = SkillLoader.getAllSkillNames()
      }

      // Group by category
      const grouped = SkillLoader.getSkillsByCategory()

      res.json({
        skills,
        grouped,
        totalCount: SkillLoader.loadAllSkills().length,
        userTier
      })

    } catch (error) {
      logger.error({ error }, 'Failed to list skills')
      res.status(500).json({ error: 'Failed to list skills' })
    }
  },

  /**
   * Get a specific skill by ID
   * GET /project/:projectId/agent/skill/:skillId
   */
  async getSkill(req, res) {
    try {
      const { skillId } = req.params

      const skill = SkillLoader.getSkill(skillId)

      if (!skill) {
        return res.status(404).json({ error: 'Skill not found' })
      }

      res.json({
        skill: {
          id: skill.id,
          name: skill.name,
          description: skill.description,
          source: skill.source,
          overview: skill.overview,
          references: skill.references.map(r => r.name)
        }
      })

    } catch (error) {
      logger.error({ error }, 'Failed to get skill')
      res.status(500).json({ error: 'Failed to get skill' })
    }
  },

  /**
   * Get skill reference documentation
   * GET /project/:projectId/agent/skill/:skillId/reference/:refName
   */
  async getSkillReference(req, res) {
    try {
      const { skillId, refName } = req.params

      const skill = SkillLoader.getSkill(skillId)
      if (!skill) {
        return res.status(404).json({ error: 'Skill not found' })
      }

      const referenceContent = SkillLoader.getSkillReference(skill, refName)
      if (!referenceContent) {
        return res.status(404).json({ error: 'Reference not found' })
      }

      res.json({
        skill: skill.name,
        reference: refName,
        content: referenceContent
      })

    } catch (error) {
      logger.error({ error }, 'Failed to get skill reference')
      res.status(500).json({ error: 'Failed to get skill reference' })
    }
  },

  /**
   * Execute a skill with AI assistance
   * POST /project/:projectId/agent/skill/:skillId/execute
   *
   * The skill context is automatically included in the AI's system prompt
   */
  async executeSkill(req, res) {
    try {
      const { projectId, skillId } = req.params
      const { input, context, model, provider } = req.body
      const userId = req.headers['x-user-id']

      // Find skill
      const skill = SkillLoader.getSkill(skillId)
      if (!skill) {
        return res.status(404).json({ error: 'Skill not found' })
      }

      if (!input) {
        return res.status(400).json({ error: 'Input is required' })
      }

      logger.info({
        skillId,
        skillName: skill.name,
        projectId,
        userId,
        inputLength: input.length
      }, 'Executing skill')

      // Build comprehensive prompt using skill content
      let systemPrompt = `You are an AI assistant specialized in: ${skill.name}

## Skill Description
${skill.description}

## Detailed Instructions
${skill.overview || skill.content.substring(0, 4000)}

## Guidelines
- Follow the skill documentation precisely
- Provide accurate, scientific responses
- Use LaTeX formatting when appropriate for equations, tables, and figures
- Be thorough and complete in your response
`

      // Add document context if available
      if (context?.selection) {
        systemPrompt += `\n## Document Context
File: ${context.doc_name || 'Unknown'}
Selected text:
\`\`\`
${context.selection.text}
\`\`\`
`
      }

      // Execute via LLM Gateway
      const gateway = getGateway()
      const response = await gateway.complete({
        provider: provider || 'anthropic',
        model: model || 'claude-3-5-sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input }
        ],
        options: {
          maxTokens: 8192,
          temperature: 0.7
        },
        userId,
        projectId
      })

      res.json({
        skillId,
        skillName: skill.name,
        result: response.content,
        usage: response.usage,
        model: response.model
      })

    } catch (error) {
      logger.error({ error }, 'Skill execution failed')
      res.status(500).json({ error: 'Skill execution failed' })
    }
  },

  /**
   * Get skill categories
   * GET /agent/skills/categories
   */
  async getCategories(req, res) {
    try {
      const categories = SkillLoader.getSkillsByCategory()

      const categoryInfo = Object.entries(categories).map(([name, skills]) => ({
        name,
        count: skills.length
      }))

      res.json({ categories: categoryInfo })

    } catch (error) {
      logger.error({ error }, 'Failed to get categories')
      res.status(500).json({ error: 'Failed to get categories' })
    }
  },

  /**
   * Find relevant skills for a query
   * GET /project/:projectId/agent/skills/search
   */
  async searchSkills(req, res) {
    try {
      const { q, limit = 10 } = req.query

      if (!q) {
        return res.status(400).json({ error: 'Query parameter q is required' })
      }

      const skills = SkillLoader.findRelevantSkills(q, parseInt(limit))

      res.json({
        query: q,
        results: skills.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description.substring(0, 200),
          source: s.source,
          relevanceScore: s.relevanceScore
        }))
      })

    } catch (error) {
      logger.error({ error }, 'Failed to search skills')
      res.status(500).json({ error: 'Failed to search skills' })
    }
  }
}
