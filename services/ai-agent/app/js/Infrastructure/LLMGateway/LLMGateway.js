/**
 * LLM Gateway
 *
 * Unified interface for multiple LLM providers
 * Supports: Anthropic, OpenAI, Google, Ollama, Groq, Together, OpenRouter
 */

import logger from '@overleaf/logger'
import { ProviderRegistry } from './ProviderRegistry.js'
import { CostTracker } from './CostTracker.js'
import { ModelRouter } from './ModelRouter.js'

export class LLMGateway {
  constructor(config = {}) {
    this.config = config
    this.providerRegistry = new ProviderRegistry(config)
    this.costTracker = new CostTracker()
    this.modelRouter = new ModelRouter()
    this.defaultProvider = config.defaultProvider || 'anthropic'
  }

  /**
   * Initialize all configured providers
   */
  async initialize() {
    await this.providerRegistry.initializeAll()
    logger.info({ providers: this.providerRegistry.getAvailableProviders() }, 'LLM Gateway initialized')
  }

  /**
   * Unified completion API
   * @param {Object} request - Completion request
   * @param {string} request.provider - Provider name (anthropic, openai, etc.)
   * @param {string} request.model - Model identifier
   * @param {Array} request.messages - Message array [{role, content}]
   * @param {Object} request.options - Additional options (temperature, maxTokens, etc.)
   * @param {string} request.userId - User ID for cost tracking
   * @returns {Object} Normalized response
   */
  async complete(request) {
    const { provider, model, messages, options = {}, userId, projectId } = request

    const adapter = this.providerRegistry.getAdapter(provider || this.defaultProvider)
    if (!adapter) {
      throw new Error(`Provider "${provider}" not available`)
    }

    // Normalize request for the specific provider
    const normalizedRequest = adapter.normalizeRequest({
      model,
      messages,
      ...options
    })

    logger.debug({
      provider,
      model,
      messageCount: messages.length,
      userId
    }, 'Executing LLM completion')

    try {
      const response = await adapter.complete(normalizedRequest)

      // Track costs
      if (response.usage) {
        this.costTracker.track({
          provider,
          model,
          tokens: response.usage,
          userId,
          projectId
        })
      }

      return adapter.normalizeResponse(response)
    } catch (error) {
      logger.error({ error, provider, model }, 'LLM completion failed')
      throw error
    }
  }

  /**
   * Streaming completion
   * @param {Object} request - Same as complete()
   * @yields {Object} Normalized chunks
   */
  async *stream(request) {
    const { provider, model, messages, options = {}, userId, projectId } = request

    const adapter = this.providerRegistry.getAdapter(provider || this.defaultProvider)
    if (!adapter) {
      throw new Error(`Provider "${provider}" not available`)
    }

    const normalizedRequest = adapter.normalizeRequest({
      model,
      messages,
      stream: true,
      ...options
    })

    logger.debug({
      provider,
      model,
      messageCount: messages.length,
      userId
    }, 'Starting LLM stream')

    let totalTokens = { input: 0, output: 0 }

    try {
      for await (const chunk of adapter.stream(normalizedRequest)) {
        const normalized = adapter.normalizeChunk(chunk)

        if (normalized.usage) {
          totalTokens = normalized.usage
        }

        yield normalized
      }

      // Track costs after stream completes
      if (totalTokens.input > 0 || totalTokens.output > 0) {
        this.costTracker.track({
          provider,
          model,
          tokens: totalTokens,
          userId,
          projectId
        })
      }
    } catch (error) {
      logger.error({ error, provider, model }, 'LLM stream failed')
      throw error
    }
  }

  /**
   * Get model recommendation based on task type and user tier
   * @param {string} taskType - Type of task (simple-edit, scientific-analysis, etc.)
   * @param {string} userTier - User subscription tier (free, pro, team, enterprise)
   * @returns {Object} Recommended provider and model
   */
  recommendModel(taskType, userTier) {
    return this.modelRouter.recommend(taskType, userTier)
  }

  /**
   * Get available providers
   * @returns {Array} List of available provider names
   */
  getAvailableProviders() {
    return this.providerRegistry.getAvailableProviders()
  }

  /**
   * Get available models for a provider
   * @param {string} provider - Provider name
   * @returns {Array} List of models
   */
  getModels(provider) {
    const adapter = this.providerRegistry.getAdapter(provider)
    return adapter ? adapter.getModels() : []
  }

  /**
   * Get all available models across all providers
   * @returns {Object} Models grouped by provider
   */
  getAllModels() {
    const models = {}
    for (const provider of this.getAvailableProviders()) {
      models[provider] = this.getModels(provider)
    }
    return models
  }

  /**
   * Get cost summary for a user
   * @param {string} userId - User ID
   * @param {Object} options - Time range options
   * @returns {Object} Cost summary
   */
  getCostSummary(userId, options = {}) {
    return this.costTracker.getSummary(userId, options)
  }
}

// Singleton instance
let gateway = null

export function getGateway(config) {
  if (!gateway) {
    gateway = new LLMGateway(config)
  }
  return gateway
}
