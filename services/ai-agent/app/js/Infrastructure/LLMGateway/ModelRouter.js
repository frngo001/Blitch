/**
 * Model Router
 *
 * Intelligent model selection based on task type and user tier
 */

// Model recommendations by task type
const RECOMMENDATIONS = {
  // Simple text improvements
  'simple-edit': {
    free: { provider: 'anthropic', model: 'claude-3-5-haiku' },
    pro: { provider: 'anthropic', model: 'claude-3-5-sonnet' },
    team: { provider: 'anthropic', model: 'claude-3-5-sonnet' },
    enterprise: { provider: 'anthropic', model: 'claude-sonnet-4' }
  },

  // Scientific analysis and research
  'scientific-analysis': {
    free: { provider: 'anthropic', model: 'claude-3-5-haiku' },
    pro: { provider: 'anthropic', model: 'claude-sonnet-4' },
    team: { provider: 'anthropic', model: 'claude-sonnet-4' },
    enterprise: { provider: 'anthropic', model: 'claude-opus-4' }
  },

  // Complex reasoning tasks
  'complex-reasoning': {
    free: { provider: 'ollama', model: 'llama3.2' },
    pro: { provider: 'anthropic', model: 'claude-sonnet-4' },
    team: { provider: 'anthropic', model: 'claude-opus-4' },
    enterprise: { provider: 'anthropic', model: 'claude-opus-4' }
  },

  // LaTeX generation
  'latex-generation': {
    free: { provider: 'anthropic', model: 'claude-3-5-haiku' },
    pro: { provider: 'anthropic', model: 'claude-3-5-sonnet' },
    team: { provider: 'anthropic', model: 'claude-sonnet-4' },
    enterprise: { provider: 'anthropic', model: 'claude-sonnet-4' }
  },

  // Fast local processing
  'fast-local': {
    free: { provider: 'ollama', model: 'llama3.2' },
    pro: { provider: 'ollama', model: 'llama3.2' },
    team: { provider: 'ollama', model: 'llama3.2' },
    enterprise: { provider: 'ollama', model: 'llama3.2' }
  },

  // Cost-optimized for bulk operations
  'cost-optimized': {
    free: { provider: 'ollama', model: 'llama3.2' },
    pro: { provider: 'groq', model: 'llama-3.3-70b' },
    team: { provider: 'groq', model: 'llama-3.3-70b' },
    enterprise: { provider: 'groq', model: 'llama-3.3-70b' }
  },

  // Literature research
  'literature-search': {
    free: { provider: 'anthropic', model: 'claude-3-5-haiku' },
    pro: { provider: 'anthropic', model: 'claude-3-5-sonnet' },
    team: { provider: 'anthropic', model: 'claude-sonnet-4' },
    enterprise: { provider: 'anthropic', model: 'claude-opus-4' }
  },

  // Peer review simulation
  'peer-review': {
    free: { provider: 'ollama', model: 'llama3.2' },
    pro: { provider: 'anthropic', model: 'claude-sonnet-4' },
    team: { provider: 'anthropic', model: 'claude-opus-4' },
    enterprise: { provider: 'anthropic', model: 'claude-opus-4' }
  },

  // Code generation (for computational methods)
  'code-generation': {
    free: { provider: 'anthropic', model: 'claude-3-5-haiku' },
    pro: { provider: 'anthropic', model: 'claude-3-5-sonnet' },
    team: { provider: 'anthropic', model: 'claude-sonnet-4' },
    enterprise: { provider: 'anthropic', model: 'claude-sonnet-4' }
  },

  // Translation
  'translation': {
    free: { provider: 'anthropic', model: 'claude-3-5-haiku' },
    pro: { provider: 'anthropic', model: 'claude-3-5-sonnet' },
    team: { provider: 'anthropic', model: 'claude-3-5-sonnet' },
    enterprise: { provider: 'anthropic', model: 'claude-sonnet-4' }
  }
}

// Default fallback
const DEFAULT_RECOMMENDATION = {
  free: { provider: 'anthropic', model: 'claude-3-5-haiku' },
  pro: { provider: 'anthropic', model: 'claude-3-5-sonnet' },
  team: { provider: 'anthropic', model: 'claude-sonnet-4' },
  enterprise: { provider: 'anthropic', model: 'claude-opus-4' }
}

// Model capabilities for intelligent routing
const MODEL_CAPABILITIES = {
  'claude-opus-4': {
    maxTokens: 200000,
    strengths: ['complex-reasoning', 'scientific-analysis', 'long-context', 'creativity'],
    costTier: 'premium'
  },
  'claude-sonnet-4': {
    maxTokens: 200000,
    strengths: ['balanced', 'scientific-writing', 'code', 'analysis'],
    costTier: 'standard'
  },
  'claude-3-5-sonnet': {
    maxTokens: 200000,
    strengths: ['balanced', 'writing', 'code'],
    costTier: 'standard'
  },
  'claude-3-5-haiku': {
    maxTokens: 200000,
    strengths: ['fast', 'simple-tasks', 'cost-effective'],
    costTier: 'economy'
  },
  'llama3.2': {
    maxTokens: 128000,
    strengths: ['local', 'privacy', 'free'],
    costTier: 'free'
  },
  'llama-3.3-70b': {
    maxTokens: 128000,
    strengths: ['fast', 'cost-effective', 'general'],
    costTier: 'economy'
  }
}

export class ModelRouter {
  constructor() {
    this.recommendations = RECOMMENDATIONS
    this.capabilities = MODEL_CAPABILITIES
  }

  /**
   * Get recommended model for a task
   * @param {string} taskType - Type of task
   * @param {string} userTier - User subscription tier
   * @returns {Object} Recommended provider and model
   */
  recommend(taskType, userTier = 'free') {
    const taskRecommendations = this.recommendations[taskType] || DEFAULT_RECOMMENDATION
    return taskRecommendations[userTier] || taskRecommendations.free
  }

  /**
   * Get all available task types
   * @returns {Array} Task type names
   */
  getTaskTypes() {
    return Object.keys(this.recommendations)
  }

  /**
   * Get model capabilities
   * @param {string} model - Model name
   * @returns {Object|null} Model capabilities
   */
  getCapabilities(model) {
    return this.capabilities[model] || null
  }

  /**
   * Find best model for given requirements
   * @param {Object} requirements - Required capabilities
   * @returns {Array} Sorted list of suitable models
   */
  findBestModels(requirements) {
    const { minTokens, strengths, maxCostTier, userTier } = requirements

    const costTierOrder = ['free', 'economy', 'standard', 'premium']
    const maxCostIndex = costTierOrder.indexOf(maxCostTier || 'premium')

    const suitable = Object.entries(this.capabilities)
      .filter(([model, caps]) => {
        // Check token limit
        if (minTokens && caps.maxTokens < minTokens) return false

        // Check cost tier
        const costIndex = costTierOrder.indexOf(caps.costTier)
        if (costIndex > maxCostIndex) return false

        return true
      })
      .map(([model, caps]) => {
        // Score based on strength matches
        let score = 0
        if (strengths) {
          for (const strength of strengths) {
            if (caps.strengths.includes(strength)) score++
          }
        }
        return { model, ...caps, score }
      })
      .sort((a, b) => b.score - a.score)

    return suitable
  }

  /**
   * Detect task type from message content
   * @param {string} message - User message
   * @returns {string} Detected task type
   */
  detectTaskType(message) {
    const lower = message.toLowerCase()

    if (lower.includes('review') || lower.includes('critique') || lower.includes('feedback')) {
      return 'peer-review'
    }
    if (lower.includes('latex') || lower.includes('equation') || lower.includes('table') || lower.includes('figure')) {
      return 'latex-generation'
    }
    if (lower.includes('research') || lower.includes('literature') || lower.includes('citation') || lower.includes('reference')) {
      return 'literature-search'
    }
    if (lower.includes('analyze') || lower.includes('analysis') || lower.includes('interpret')) {
      return 'scientific-analysis'
    }
    if (lower.includes('translate') || lower.includes('translation')) {
      return 'translation'
    }
    if (lower.includes('code') || lower.includes('script') || lower.includes('algorithm')) {
      return 'code-generation'
    }
    if (lower.includes('improve') || lower.includes('rewrite') || lower.includes('edit')) {
      return 'simple-edit'
    }

    return 'simple-edit' // Default
  }
}
