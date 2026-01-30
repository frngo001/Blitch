/**
 * Cost Tracker
 *
 * Tracks token usage and costs per user/project
 */

import logger from '@overleaf/logger'

// Pricing per 1M tokens (as of 2026-01)
const PRICING = {
  anthropic: {
    'claude-opus-4': { input: 15.00, output: 75.00 },
    'claude-sonnet-4': { input: 3.00, output: 15.00 },
    'claude-3-5-haiku': { input: 0.80, output: 4.00 },
    'claude-3-5-sonnet': { input: 3.00, output: 15.00 }
  },
  openai: {
    'gpt-4o': { input: 5.00, output: 15.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'o1': { input: 15.00, output: 60.00 },
    'o3-mini': { input: 1.10, output: 4.40 }
  },
  google: {
    'gemini-2.0-pro': { input: 1.25, output: 5.00 },
    'gemini-2.0-flash': { input: 0.075, output: 0.30 }
  },
  groq: {
    'llama-3.3-70b': { input: 0.59, output: 0.79 },
    'mixtral-8x7b': { input: 0.24, output: 0.24 }
  },
  together: {
    'llama-3.3-70b': { input: 0.88, output: 0.88 },
    'mixtral-8x22b': { input: 1.20, output: 1.20 }
  },
  ollama: {
    // Ollama is free (local)
    default: { input: 0, output: 0 }
  },
  openrouter: {
    // OpenRouter pricing varies, use pass-through
    default: { input: 0, output: 0 }
  }
}

export class CostTracker {
  constructor() {
    // In-memory tracking (should be persisted to MongoDB in production)
    this.usage = new Map()
    this.dailyUsage = new Map()
  }

  /**
   * Track token usage and cost
   * @param {Object} data - Usage data
   */
  track(data) {
    const { provider, model, tokens, userId, projectId } = data

    const cost = this.calculateCost(provider, model, tokens)

    // Get or create user usage
    const key = userId || 'anonymous'
    if (!this.usage.has(key)) {
      this.usage.set(key, {
        totalTokensInput: 0,
        totalTokensOutput: 0,
        totalCostUsd: 0,
        byProvider: {},
        byProject: {}
      })
    }

    const userUsage = this.usage.get(key)

    // Update totals
    userUsage.totalTokensInput += tokens.input || 0
    userUsage.totalTokensOutput += tokens.output || 0
    userUsage.totalCostUsd += cost.total

    // Update by provider
    if (!userUsage.byProvider[provider]) {
      userUsage.byProvider[provider] = {
        tokensInput: 0,
        tokensOutput: 0,
        costUsd: 0
      }
    }
    userUsage.byProvider[provider].tokensInput += tokens.input || 0
    userUsage.byProvider[provider].tokensOutput += tokens.output || 0
    userUsage.byProvider[provider].costUsd += cost.total

    // Update by project
    if (projectId) {
      if (!userUsage.byProject[projectId]) {
        userUsage.byProject[projectId] = {
          tokensInput: 0,
          tokensOutput: 0,
          costUsd: 0
        }
      }
      userUsage.byProject[projectId].tokensInput += tokens.input || 0
      userUsage.byProject[projectId].tokensOutput += tokens.output || 0
      userUsage.byProject[projectId].costUsd += cost.total
    }

    // Track daily usage for rate limiting
    const today = new Date().toISOString().split('T')[0]
    const dailyKey = `${key}:${today}`
    if (!this.dailyUsage.has(dailyKey)) {
      this.dailyUsage.set(dailyKey, {
        tokensInput: 0,
        tokensOutput: 0,
        costUsd: 0,
        requestCount: 0
      })
    }
    const daily = this.dailyUsage.get(dailyKey)
    daily.tokensInput += tokens.input || 0
    daily.tokensOutput += tokens.output || 0
    daily.costUsd += cost.total
    daily.requestCount++

    logger.debug({
      userId,
      provider,
      model,
      tokens,
      cost
    }, 'Usage tracked')

    return cost
  }

  /**
   * Calculate cost for token usage
   * @param {string} provider - Provider name
   * @param {string} model - Model name
   * @param {Object} tokens - Token counts
   * @returns {Object} Cost breakdown
   */
  calculateCost(provider, model, tokens) {
    const providerPricing = PRICING[provider] || {}
    const modelPricing = providerPricing[model] || providerPricing.default || { input: 0, output: 0 }

    const inputCost = ((tokens.input || 0) / 1_000_000) * modelPricing.input
    const outputCost = ((tokens.output || 0) / 1_000_000) * modelPricing.output

    return {
      inputCost,
      outputCost,
      total: inputCost + outputCost
    }
  }

  /**
   * Get usage summary for a user
   * @param {string} userId - User ID
   * @param {Object} options - Options (timeRange, etc.)
   * @returns {Object} Usage summary
   */
  getSummary(userId, options = {}) {
    const userUsage = this.usage.get(userId)

    if (!userUsage) {
      return {
        totalTokensInput: 0,
        totalTokensOutput: 0,
        totalCostUsd: 0,
        byProvider: {},
        byProject: {}
      }
    }

    return { ...userUsage }
  }

  /**
   * Get daily usage for rate limiting
   * @param {string} userId - User ID
   * @returns {Object} Daily usage
   */
  getDailyUsage(userId) {
    const today = new Date().toISOString().split('T')[0]
    const key = `${userId}:${today}`

    return this.dailyUsage.get(key) || {
      tokensInput: 0,
      tokensOutput: 0,
      costUsd: 0,
      requestCount: 0
    }
  }

  /**
   * Check if user is within their tier limits
   * @param {string} userId - User ID
   * @param {string} tier - User tier (free, pro, team, enterprise)
   * @returns {Object} Limit status
   */
  checkLimits(userId, tier) {
    const daily = this.getDailyUsage(userId)

    const limits = {
      free: { dailyRequests: 50, dailyTokens: 50000, dailyCostUsd: 0.50 },
      pro: { dailyRequests: 500, dailyTokens: 500000, dailyCostUsd: 5.00 },
      team: { dailyRequests: 1000, dailyTokens: 1000000, dailyCostUsd: 10.00 },
      enterprise: { dailyRequests: Infinity, dailyTokens: Infinity, dailyCostUsd: Infinity }
    }

    const userLimits = limits[tier] || limits.free

    return {
      withinLimits:
        daily.requestCount < userLimits.dailyRequests &&
        (daily.tokensInput + daily.tokensOutput) < userLimits.dailyTokens &&
        daily.costUsd < userLimits.dailyCostUsd,
      current: daily,
      limits: userLimits,
      remaining: {
        requests: Math.max(0, userLimits.dailyRequests - daily.requestCount),
        tokens: Math.max(0, userLimits.dailyTokens - (daily.tokensInput + daily.tokensOutput)),
        costUsd: Math.max(0, userLimits.dailyCostUsd - daily.costUsd)
      }
    }
  }

  /**
   * Reset daily usage (for testing or admin)
   * @param {string} userId - User ID
   */
  resetDailyUsage(userId) {
    const today = new Date().toISOString().split('T')[0]
    const key = `${userId}:${today}`
    this.dailyUsage.delete(key)
  }

  /**
   * Get pricing info
   * @returns {Object} Pricing table
   */
  static getPricing() {
    return PRICING
  }
}
