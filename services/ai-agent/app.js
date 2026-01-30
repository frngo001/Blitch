/**
 * AI-Agent Service Entry Point
 *
 * Multi-Provider LLM Gateway for Scientific Writing and Research
 * Port: 3020
 */

import { createServer } from './app/js/server.js'
import { getGateway } from './app/js/Infrastructure/LLMGateway/LLMGateway.js'
import { getMCPClient } from './app/js/Infrastructure/MCP/MCPClient.js'
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

    // Initialize MCP Client if enabled
    if (MCP_ENABLED) {
      try {
        logger.info({ command: MCP_COMMAND, args: MCP_ARGS }, 'Initializing MCP client')
        await getMCPClient({
          command: MCP_COMMAND,
          args: MCP_ARGS
        })
        logger.info('MCP client initialized successfully')
      } catch (mcpError) {
        logger.warn({ error: mcpError }, 'MCP client initialization failed - continuing without MCP')
      }
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
