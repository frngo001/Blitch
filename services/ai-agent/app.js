/**
 * AI-Agent Service Entry Point
 *
 * Multi-Provider LLM Gateway for Scientific Writing and Research
 * Port: 3020
 */

import { createServer } from './app/js/server.js'
import { getGateway } from './app/js/Infrastructure/LLMGateway/LLMGateway.js'
import { initMCPClient } from './app/js/Infrastructure/MCP/MCPClient.js'
import { connect as connectMongo, close as closeMongo } from './app/js/mongodb.js'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'

// MCP Configuration
const MCP_ENABLED = process.env.MCP_ENABLED === 'true'
const MCP_COMMAND = process.env.MCP_COMMAND || 'uvx'
const MCP_ARGS = (process.env.MCP_ARGS || 'claude-skills-mcp').split(',')

const PORT = Settings.internal?.aiAgent?.port || 3020
const HOST = Settings.internal?.aiAgent?.host || '0.0.0.0'

async function main() {
  try {
    // Connect to MongoDB first
    await connectMongo()
    logger.info('MongoDB connection established')

    // Initialize LLM Gateway with providers
    const gateway = getGateway(Settings.aiAgent || {})
    await gateway.initialize()

    // Initialize MCP Client if enabled (lazy - connects in background)
    if (MCP_ENABLED) {
      logger.info({ command: MCP_COMMAND, args: MCP_ARGS }, 'Initializing MCP client (lazy)')
      // This starts background connection but doesn't block server startup
      initMCPClient({
        command: MCP_COMMAND,
        args: MCP_ARGS
      }, true) // true = start background connection
      logger.info('MCP client initialized (connecting in background)')
    } else {
      logger.info('MCP is disabled (set MCP_ENABLED=true to enable)')
    }

    const { server } = await createServer()

    server.listen(PORT, HOST, () => {
      logger.info({ port: PORT, host: HOST }, 'AI-Agent service started')
    })

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully')
      server.close(async () => {
        await closeMongo()
        logger.info('Server closed')
        process.exit(0)
      })
    })

  } catch (error) {
    logger.fatal({ error }, 'Failed to start AI-Agent service')
    process.exit(1)
  }
}

main()
