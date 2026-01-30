/**
 * Provider Registry
 *
 * Manages LLM provider adapters and their initialization
 * Uses dynamic imports to avoid loading dependencies that aren't needed
 */

import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'

export class ProviderRegistry {
  constructor(config = {}) {
    this.config = config
    this.adapters = new Map()
    this.initialized = false
  }

  /**
   * Initialize all configured providers
   * Uses dynamic imports to only load adapters when needed
   */
  async initializeAll() {
    const providerConfigs = this.config.providers || Settings.aiAgent?.providers || {}

    // Initialize DeepSeek if API key is available (default provider)
    // Uses Vercel AI SDK for better tool calling support
    if (providerConfigs.deepseek?.apiKey || process.env.DEEPSEEK_API_KEY) {
      try {
        const { DeepSeekAISDKAdapter } = await import('./adapters/DeepSeekAISDKAdapter.js')
        const adapter = new DeepSeekAISDKAdapter({
          apiKey: providerConfigs.deepseek?.apiKey || process.env.DEEPSEEK_API_KEY,
          baseUrl: providerConfigs.deepseek?.baseUrl || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
        })
        await adapter.initialize()
        this.adapters.set('deepseek', adapter)
        logger.info('DeepSeek AI SDK adapter initialized (with tool calling support)')
      } catch (error) {
        logger.warn({ error }, 'Failed to initialize DeepSeek AI SDK adapter')
      }
    }

    // Initialize Anthropic if API key is available (optional)
    if (providerConfigs.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY) {
      try {
        const { AnthropicAdapter } = await import('./adapters/AnthropicAdapter.js')
        const adapter = new AnthropicAdapter({
          apiKey: providerConfigs.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY
        })
        await adapter.initialize()
        this.adapters.set('anthropic', adapter)
        logger.info('Anthropic adapter initialized')
      } catch (error) {
        logger.warn({ error }, 'Failed to initialize Anthropic adapter (SDK may not be installed)')
      }
    }

    // Initialize Ollama (local, no API key needed) - optional fallback
    if (process.env.ENABLE_OLLAMA === 'true') {
      const ollamaBaseUrl = providerConfigs.ollama?.baseUrl || process.env.OLLAMA_BASE_URL || 'http://ollama:11434'
      try {
        const { OllamaAdapter } = await import('./adapters/OllamaAdapter.js')
        const adapter = new OllamaAdapter({
          baseUrl: ollamaBaseUrl
        })
        await adapter.initialize()
        this.adapters.set('ollama', adapter)
        logger.info({ baseUrl: ollamaBaseUrl }, 'Ollama adapter initialized')
      } catch (error) {
        logger.warn({ error, baseUrl: ollamaBaseUrl }, 'Failed to initialize Ollama adapter')
      }
    }

    // Future: Initialize other providers
    // if (providerConfigs.openai?.apiKey || process.env.OPENAI_API_KEY) { ... }
    // if (providerConfigs.google?.apiKey || process.env.GOOGLE_API_KEY) { ... }
    // if (providerConfigs.groq?.apiKey || process.env.GROQ_API_KEY) { ... }

    this.initialized = true
    logger.info({
      availableProviders: this.getAvailableProviders()
    }, 'Provider registry initialized')
  }

  /**
   * Get an adapter by provider name
   * @param {string} provider - Provider name
   * @returns {Object|null} Provider adapter or null
   */
  getAdapter(provider) {
    return this.adapters.get(provider) || null
  }

  /**
   * Get list of available providers
   * @returns {Array} Provider names
   */
  getAvailableProviders() {
    return Array.from(this.adapters.keys())
  }

  /**
   * Check if a provider is available
   * @param {string} provider - Provider name
   * @returns {boolean}
   */
  hasProvider(provider) {
    return this.adapters.has(provider)
  }

  /**
   * Register a new adapter dynamically
   * @param {string} name - Provider name
   * @param {Object} adapter - Adapter instance
   */
  registerAdapter(name, adapter) {
    this.adapters.set(name, adapter)
    logger.info({ provider: name }, 'Adapter registered dynamically')
  }

  /**
   * Remove an adapter
   * @param {string} name - Provider name
   */
  removeAdapter(name) {
    this.adapters.delete(name)
    logger.info({ provider: name }, 'Adapter removed')
  }

  /**
   * Get provider status/health
   * @returns {Object} Health status per provider
   */
  async getHealthStatus() {
    const status = {}

    for (const [name, adapter] of this.adapters) {
      try {
        const health = await adapter.healthCheck()
        status[name] = {
          available: true,
          ...health
        }
      } catch (error) {
        status[name] = {
          available: false,
          error: error.message
        }
      }
    }

    return status
  }
}
