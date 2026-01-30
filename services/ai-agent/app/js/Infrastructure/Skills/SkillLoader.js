/**
 * SkillLoader
 *
 * Loads and manages all scientific skills from:
 * - claude-scientific-skills (140+ skills)
 * - claude-scientific-writer (22 skills)
 *
 * Skills are loaded at startup and provide context to the AI Agent
 * for intelligent task handling without explicit user selection.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import logger from '@overleaf/logger'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Base directory for ai-agent service
// In Docker: /overleaf/services/ai-agent
// Locally: determined from this file's location (app/js/Infrastructure/Skills/)
const AI_AGENT_BASE = process.env.AI_AGENT_BASE ||
  (process.env.NODE_ENV === 'production' || fs.existsSync('/overleaf')
    ? '/overleaf/services/ai-agent'
    : path.resolve(__dirname, '../../../..'))

// Skill sources - use absolute paths
const SKILL_SOURCES = [
  {
    name: 'claude-scientific-skills',
    path: path.join(AI_AGENT_BASE, 'lib/claude-scientific-skills/scientific-skills'),
    priority: 1
  },
  {
    name: 'claude-scientific-writer',
    path: path.join(AI_AGENT_BASE, 'lib/claude-scientific-writer/skills'),
    priority: 2  // Higher priority for writing tasks
  }
]

// Parsed skill cache
let skillCache = null
let skillIndex = null

/**
 * Parse SKILL.md frontmatter and content
 */
function parseSkillFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')

    // Parse YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)

    if (!frontmatterMatch) {
      // No frontmatter, use filename as name
      const name = path.basename(path.dirname(filePath))
      return {
        name,
        description: content.substring(0, 500),
        content: content,
        metadata: {}
      }
    }

    const frontmatter = frontmatterMatch[1]
    const body = frontmatterMatch[2]

    // Parse frontmatter fields
    const metadata = {}
    const lines = frontmatter.split('\n')
    let currentKey = null

    for (const line of lines) {
      const keyMatch = line.match(/^(\w[\w-]*?):\s*(.*)$/)
      if (keyMatch) {
        currentKey = keyMatch[1]
        const value = keyMatch[2].trim()

        // Handle arrays
        if (value.startsWith('[') && value.endsWith(']')) {
          metadata[currentKey] = value.slice(1, -1).split(',').map(s => s.trim())
        } else if (value) {
          metadata[currentKey] = value
        }
      } else if (currentKey && line.startsWith('  ')) {
        // Continuation of previous value
        if (Array.isArray(metadata[currentKey])) {
          metadata[currentKey].push(line.trim().replace(/^-\s*/, ''))
        }
      }
    }

    return {
      name: metadata.name || path.basename(path.dirname(filePath)),
      description: metadata.description || '',
      allowedTools: metadata['allowed-tools'] || [],
      license: metadata.license || 'Unknown',
      metadata: metadata.metadata || {},
      content: body,
      overview: extractOverview(body)
    }
  } catch (error) {
    logger.warn({ error, filePath }, 'Failed to parse skill file')
    return null
  }
}

/**
 * Extract overview section from skill content
 */
function extractOverview(content) {
  // Get the first few paragraphs or up to "## When to Use"
  const overviewMatch = content.match(/^#[^#].*?\n\n([\s\S]*?)(?=\n##|\n$)/m)
  if (overviewMatch) {
    return overviewMatch[1].trim().substring(0, 1000)
  }
  return content.substring(0, 500)
}

/**
 * Load all skills from a directory
 */
function loadSkillsFromDirectory(sourcePath, sourceName) {
  const skills = []

  if (!fs.existsSync(sourcePath)) {
    logger.warn({ sourcePath }, 'Skill source directory not found')
    return skills
  }

  const entries = fs.readdirSync(sourcePath, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const skillPath = path.join(sourcePath, entry.name)
    const skillFile = path.join(skillPath, 'SKILL.md')

    if (fs.existsSync(skillFile)) {
      const skill = parseSkillFile(skillFile)
      if (skill) {
        skills.push({
          ...skill,
          id: entry.name,
          source: sourceName,
          path: skillPath,
          references: loadReferences(skillPath)
        })
      }
    }

    // Check for nested skills (e.g., document-skills/docx)
    const nestedEntries = fs.readdirSync(skillPath, { withFileTypes: true })
    for (const nested of nestedEntries) {
      if (nested.isDirectory()) {
        const nestedSkillFile = path.join(skillPath, nested.name, 'SKILL.md')
        if (fs.existsSync(nestedSkillFile)) {
          const nestedSkill = parseSkillFile(nestedSkillFile)
          if (nestedSkill) {
            skills.push({
              ...nestedSkill,
              id: `${entry.name}/${nested.name}`,
              source: sourceName,
              path: path.join(skillPath, nested.name),
              references: loadReferences(path.join(skillPath, nested.name))
            })
          }
        }
      }
    }
  }

  return skills
}

/**
 * Load reference files for a skill
 */
function loadReferences(skillPath) {
  const referencesPath = path.join(skillPath, 'references')
  const references = []

  if (!fs.existsSync(referencesPath)) return references

  const files = fs.readdirSync(referencesPath)
  for (const file of files) {
    if (file.endsWith('.md')) {
      references.push({
        name: file.replace('.md', ''),
        path: path.join(referencesPath, file)
      })
    }
  }

  return references
}

/**
 * Load all skills from all sources
 */
export function loadAllSkills() {
  if (skillCache) return skillCache

  logger.info('Loading scientific skills...')
  const allSkills = []

  for (const source of SKILL_SOURCES) {
    const skills = loadSkillsFromDirectory(source.path, source.name)
    logger.info({ source: source.name, count: skills.length }, 'Loaded skills from source')

    for (const skill of skills) {
      skill.priority = source.priority
      allSkills.push(skill)
    }
  }

  // Deduplicate by name (higher priority wins)
  const skillMap = new Map()
  for (const skill of allSkills.sort((a, b) => b.priority - a.priority)) {
    if (!skillMap.has(skill.name)) {
      skillMap.set(skill.name, skill)
    }
  }

  skillCache = Array.from(skillMap.values())
  logger.info({ totalSkills: skillCache.length }, 'Total unique skills loaded')

  // Build search index
  buildSkillIndex()

  return skillCache
}

/**
 * Build search index for skill matching
 */
function buildSkillIndex() {
  skillIndex = {
    byCategory: {},
    byKeyword: {},
    byName: {}
  }

  const categories = {
    writing: ['writing', 'paper', 'manuscript', 'latex', 'document', 'report'],
    bioinformatics: ['bio', 'gene', 'protein', 'sequence', 'dna', 'rna', 'genomic'],
    chemistry: ['chem', 'molecule', 'drug', 'compound', 'rdkit', 'smiles'],
    clinical: ['clinical', 'medical', 'treatment', 'patient', 'health', 'diagnosis'],
    data: ['data', 'analysis', 'statistics', 'visualization', 'plot', 'chart'],
    research: ['research', 'literature', 'citation', 'review', 'paper'],
    ml: ['machine learning', 'ml', 'ai', 'neural', 'deep learning', 'model']
  }

  for (const skill of skillCache) {
    // Index by name
    skillIndex.byName[skill.name.toLowerCase()] = skill

    // Index by category
    const text = `${skill.name} ${skill.description}`.toLowerCase()
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(kw => text.includes(kw))) {
        if (!skillIndex.byCategory[category]) {
          skillIndex.byCategory[category] = []
        }
        skillIndex.byCategory[category].push(skill)
      }
    }

    // Index by keywords in description
    const words = skill.description.toLowerCase().split(/\W+/).filter(w => w.length > 3)
    for (const word of words) {
      if (!skillIndex.byKeyword[word]) {
        skillIndex.byKeyword[word] = []
      }
      skillIndex.byKeyword[word].push(skill)
    }
  }
}

/**
 * Find relevant skills for a query
 */
export function findRelevantSkills(query, maxResults = 10) {
  if (!skillCache) loadAllSkills()

  const queryLower = query.toLowerCase()
  const scores = new Map()

  // Exact name match (highest score)
  if (skillIndex.byName[queryLower]) {
    scores.set(skillIndex.byName[queryLower], 100)
  }

  // Category matching
  for (const [category, skills] of Object.entries(skillIndex.byCategory)) {
    if (queryLower.includes(category)) {
      for (const skill of skills) {
        scores.set(skill, (scores.get(skill) || 0) + 20)
      }
    }
  }

  // Keyword matching
  const queryWords = queryLower.split(/\W+/).filter(w => w.length > 3)
  for (const word of queryWords) {
    const matches = skillIndex.byKeyword[word] || []
    for (const skill of matches) {
      scores.set(skill, (scores.get(skill) || 0) + 5)
    }
  }

  // Description contains query terms
  for (const skill of skillCache) {
    const descLower = skill.description.toLowerCase()
    for (const word of queryWords) {
      if (descLower.includes(word)) {
        scores.set(skill, (scores.get(skill) || 0) + 3)
      }
    }
  }

  // Sort by score and return top results
  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxResults)
    .map(([skill, score]) => ({ ...skill, relevanceScore: score }))
}

/**
 * Get skill by name or ID
 */
export function getSkill(nameOrId) {
  if (!skillCache) loadAllSkills()

  const nameLower = nameOrId.toLowerCase()

  // Try exact name match
  if (skillIndex.byName[nameLower]) {
    return skillIndex.byName[nameLower]
  }

  // Try ID match
  return skillCache.find(s => s.id.toLowerCase() === nameLower)
}

/**
 * Get skill reference content
 */
export function getSkillReference(skill, referenceName) {
  const ref = skill.references.find(r => r.name === referenceName)
  if (!ref) return null

  try {
    return fs.readFileSync(ref.path, 'utf-8')
  } catch (error) {
    logger.warn({ error, skill: skill.name, reference: referenceName }, 'Failed to read reference')
    return null
  }
}

/**
 * Get all skill names for listing
 */
export function getAllSkillNames() {
  if (!skillCache) loadAllSkills()
  return skillCache.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description.substring(0, 200),
    source: s.source
  }))
}

/**
 * Get skills grouped by category
 */
export function getSkillsByCategory() {
  if (!skillCache) loadAllSkills()

  const categories = {
    'Scientific Writing': [],
    'Bioinformatics': [],
    'Chemistry & Drug Discovery': [],
    'Clinical & Medical': [],
    'Data Analysis': [],
    'Research Tools': [],
    'Databases': [],
    'Machine Learning': [],
    'Visualization': [],
    'Other': []
  }

  for (const skill of skillCache) {
    const desc = `${skill.name} ${skill.description}`.toLowerCase()

    if (desc.includes('writing') || desc.includes('latex') || desc.includes('paper') || desc.includes('manuscript')) {
      categories['Scientific Writing'].push(skill)
    } else if (desc.includes('bio') || desc.includes('gene') || desc.includes('protein') || desc.includes('sequence')) {
      categories['Bioinformatics'].push(skill)
    } else if (desc.includes('chem') || desc.includes('drug') || desc.includes('molecule') || desc.includes('compound')) {
      categories['Chemistry & Drug Discovery'].push(skill)
    } else if (desc.includes('clinical') || desc.includes('medical') || desc.includes('treatment') || desc.includes('patient')) {
      categories['Clinical & Medical'].push(skill)
    } else if (desc.includes('database') || desc.includes('-database')) {
      categories['Databases'].push(skill)
    } else if (desc.includes('machine learning') || desc.includes('neural') || desc.includes('deep learning')) {
      categories['Machine Learning'].push(skill)
    } else if (desc.includes('plot') || desc.includes('visual') || desc.includes('chart') || desc.includes('figure')) {
      categories['Visualization'].push(skill)
    } else if (desc.includes('research') || desc.includes('literature') || desc.includes('citation')) {
      categories['Research Tools'].push(skill)
    } else if (desc.includes('data') || desc.includes('analysis') || desc.includes('statistic')) {
      categories['Data Analysis'].push(skill)
    } else {
      categories['Other'].push(skill)
    }
  }

  return categories
}

/**
 * Build system prompt context for relevant skills
 * NOW INCLUDES FULL SKILL CONTENT for the AI to actually use!
 */
export function buildSkillContext(query, maxSkills = 3) {
  const relevantSkills = findRelevantSkills(query, maxSkills)

  if (relevantSkills.length === 0) {
    return ''
  }

  let context = '\n\n## ACTIVE SCIENTIFIC SKILLS - FOLLOW THESE INSTRUCTIONS\n\n'
  context += 'The following skills have been activated based on your query.\n'
  context += '**YOU MUST follow the instructions in each skill when responding.**\n\n'

  for (const skill of relevantSkills) {
    context += `<skill name="${skill.name}" relevance="${skill.relevanceScore}">\n`

    // Include FULL skill content - this is the key fix!
    if (skill.content) {
      context += skill.content + '\n'
    } else {
      // Fallback to description if no content
      context += `## ${skill.name}\n${skill.description}\n`
    }

    // Include reference content for highly relevant skills
    if (skill.relevanceScore >= 15 && skill.references.length > 0) {
      context += '\n### Reference Materials:\n'
      for (const ref of skill.references.slice(0, 2)) {
        const refContent = getSkillReference(skill, ref.name)
        if (refContent) {
          context += `\n#### ${ref.name}\n${refContent.substring(0, 2000)}\n`
        }
      }
    }

    context += '</skill>\n\n'
  }

  context += '---\n'
  context += 'Apply the above skill instructions to generate your response.\n'

  return context
}

/**
 * Get the system prompt for the AI Agent including skill context
 */
export function getAgentSystemPrompt(userQuery = '') {
  // Load skills if not already loaded
  if (!skillCache) loadAllSkills()

  const basePrompt = `You are a deep research and scientific writing assistant integrated into Overleaf, a LaTeX editor. You combine AI-driven research with well-formatted scientific writing capabilities.

## Core Capabilities

You have access to ${skillCache.length} scientific skills from the K-Dense scientific toolkit, covering:
- Scientific Writing (LaTeX papers, grants, posters, clinical reports)
- Bioinformatics & Genomics
- Cheminformatics & Drug Discovery
- Clinical Research & Precision Medicine
- Data Analysis & Visualization
- Research Tools (literature review, citations, peer review)
- 28+ Scientific Databases
- Machine Learning & AI tools

## Key Principles

1. **LaTeX is your default format** for scientific documents
2. **Research before writing** - gather information before providing responses
3. **Real citations only** - never invent or use placeholder citations
4. **Be precise and scientific** - use appropriate terminology
5. **Generate complete responses** - don't stop mid-task

## Writing Guidelines

When helping with LaTeX documents:
- Use proper LaTeX formatting and packages
- Include BibTeX citations when referencing papers
- Generate tables, equations, and figures as needed
- Follow journal/venue guidelines when specified

## Response Format

For scientific writing tasks, structure your response as:
1. Brief analysis of the request
2. LaTeX code with proper formatting
3. Explanation of key elements
4. Suggestions for improvement if applicable
`

  // Add skill context based on query
  const skillContext = userQuery ? buildSkillContext(userQuery) : ''

  return basePrompt + skillContext
}

// Initialize skills on module load
loadAllSkills()

export default {
  loadAllSkills,
  findRelevantSkills,
  getSkill,
  getSkillReference,
  getAllSkillNames,
  getSkillsByCategory,
  buildSkillContext,
  getAgentSystemPrompt
}
