/**
 * Base Adapter
 *
 * Abstract base class for all LLM provider adapters
 */

export class BaseAdapter {
  constructor(config) {
    this.config = config
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl
    this.initialized = false
    this.models = {}
  }

  /**
   * Initialize the adapter
   * Override in subclasses for provider-specific initialization
   */
  async initialize() {
    this.initialized = true
  }

  /**
   * Execute a completion request
   * Must be implemented by subclasses
   * @param {Object} request - Normalized request
   * @returns {Object} Raw response
   */
  async complete(request) {
    throw new Error('complete() must be implemented by subclass')
  }

  /**
   * Execute a streaming completion request
   * Must be implemented by subclasses
   * @param {Object} request - Normalized request
   * @yields {Object} Raw chunks
   */
  async *stream(request) {
    throw new Error('stream() must be implemented by subclass')
  }

  /**
   * Normalize incoming request to provider format
   * Override for provider-specific normalization
   * @param {Object} request - Standard request format
   * @returns {Object} Provider-specific request format
   */
  normalizeRequest(request) {
    return {
      model: request.model,
      messages: request.messages,
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature ?? 0.7,
      stream: request.stream || false,
      ...request
    }
  }

  /**
   * Normalize response to standard format
   * Override for provider-specific normalization
   * @param {Object} response - Provider response
   * @returns {Object} Normalized response
   */
  normalizeResponse(response) {
    return {
      id: response.id,
      content: response.content,
      role: 'assistant',
      model: response.model,
      usage: {
        input: response.usage?.input_tokens || response.usage?.prompt_tokens || 0,
        output: response.usage?.output_tokens || response.usage?.completion_tokens || 0
      },
      finishReason: response.stop_reason || response.finish_reason || 'stop'
    }
  }

  /**
   * Normalize streaming chunk to standard format
   * Override for provider-specific normalization
   * @param {Object} chunk - Provider chunk
   * @returns {Object} Normalized chunk
   */
  normalizeChunk(chunk) {
    return {
      content: chunk.content || chunk.delta?.content || '',
      done: chunk.done || false,
      usage: chunk.usage || null
    }
  }

  /**
   * Get available models for this provider
   * @returns {Array} List of model objects
   */
  getModels() {
    return Object.entries(this.models).map(([id, info]) => ({
      id,
      ...info
    }))
  }

  /**
   * Get information about a specific model
   * @param {string} modelId - Model identifier
   * @returns {Object|null} Model info
   */
  getModelInfo(modelId) {
    return this.models[modelId] || null
  }

  /**
   * Calculate cost for usage
   * @param {Object} usage - Token usage
   * @returns {Object} Cost breakdown
   */
  calculateCost(usage) {
    const model = this.getModelInfo(usage.model)
    if (!model || !model.pricing) {
      return { inputCost: 0, outputCost: 0, total: 0 }
    }

    const inputCost = (usage.input / 1_000_000) * model.pricing.input
    const outputCost = (usage.output / 1_000_000) * model.pricing.output

    return {
      inputCost,
      outputCost,
      total: inputCost + outputCost
    }
  }

  /**
   * Health check for the provider
   * @returns {Object} Health status
   */
  async healthCheck() {
    return {
      initialized: this.initialized,
      modelsAvailable: Object.keys(this.models).length
    }
  }

  /**
   * Provider name
   * Override in subclasses
   */
  get name() {
    return 'base'
  }
}
