/**
 * Health Controller
 *
 * Health check and status endpoints
 */

import logger from '@overleaf/logger'
import { getGateway } from '../../Infrastructure/LLMGateway/LLMGateway.js'

export const HealthController = {
  /**
   * Basic health check
   * GET /health
   */
  async check(req, res) {
    res.json({
      status: 'ok',
      service: 'ai-agent',
      timestamp: new Date().toISOString()
    })
  },

  /**
   * Detailed status including provider health
   * GET /status
   */
  async status(req, res) {
    try {
      const gateway = getGateway()
      const providers = gateway.getAvailableProviders()

      // Get health status for each provider
      const providerStatus = {}
      for (const provider of providers) {
        try {
          const adapter = gateway.providerRegistry.getAdapter(provider)
          if (adapter) {
            providerStatus[provider] = await adapter.healthCheck()
          }
        } catch (error) {
          providerStatus[provider] = {
            healthy: false,
            error: error.message
          }
        }
      }

      res.json({
        status: 'ok',
        service: 'ai-agent',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        providers: providerStatus,
        capabilities: {
          streaming: true,
          multiProvider: true,
          skills: true
        }
      })

    } catch (error) {
      logger.error({ error }, 'Status check failed')
      res.status(500).json({
        status: 'error',
        service: 'ai-agent',
        error: error.message
      })
    }
  }
}
