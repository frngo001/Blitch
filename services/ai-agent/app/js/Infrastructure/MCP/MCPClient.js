/**
 * MCP Client with Lazy Initialization
 *
 * Connects to MCP servers (like claude-skills-mcp) and provides
 * tool definitions that can be used with any LLM provider.
 *
 * Uses lazy initialization to avoid timeout issues during first-run
 * package downloads. Connection happens on first tool request.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import logger from '@overleaf/logger'

class MCPClient {
  constructor() {
    this.client = null
    this.transport = null
    this.tools = []
    this.connected = false
    this.connecting = false
    this.config = null
    this.connectionPromise = null
  }

  /**
   * Store configuration for lazy connection
   * @param {Object} config - Server configuration
   */
  setConfig(config) {
    this.config = {
      command: config.command || 'uvx',
      args: config.args || ['claude-skills-mcp'],
      env: config.env || {}
    }
    logger.info({ config: this.config }, 'MCP config stored for lazy initialization')
  }

  /**
   * Ensure connection is established (lazy connect)
   * @returns {Promise<boolean>} True if connected
   */
  async ensureConnected() {
    if (this.connected) {
      return true
    }

    if (this.connecting && this.connectionPromise) {
      // Wait for ongoing connection
      return this.connectionPromise
    }

    if (!this.config) {
      logger.warn('MCP config not set, cannot connect')
      return false
    }

    this.connecting = true
    this.connectionPromise = this._connect()

    try {
      await this.connectionPromise
      return true
    } catch (error) {
      logger.error({ error }, 'Lazy MCP connection failed')
      return false
    } finally {
      this.connecting = false
      this.connectionPromise = null
    }
  }

  /**
   * Internal connect method
   */
  async _connect() {
    const { command, args, env } = this.config

    try {
      logger.info({ command, args }, 'Starting MCP server (lazy initialization)')

      // Create stdio transport with command configuration
      this.transport = new StdioClientTransport({
        command,
        args,
        env: { ...process.env, ...env }
      })

      // Create MCP client
      this.client = new Client({
        name: 'overleaf-ai-agent',
        version: '1.0.0'
      }, {
        capabilities: {
          tools: {}
        }
      })

      // Connect to the server
      await this.client.connect(this.transport)
      this.connected = true

      logger.info('Connected to MCP server')

      // Load available tools
      await this.loadTools()

      return true
    } catch (error) {
      logger.error({ error }, 'Failed to connect to MCP server')
      this.connected = false
      throw error
    }
  }

  /**
   * Start background connection (non-blocking)
   * Connection will complete eventually without blocking server start
   */
  startBackgroundConnection() {
    if (!this.config) {
      logger.warn('MCP config not set, cannot start background connection')
      return
    }

    logger.info('Starting MCP background connection...')

    // Fire and forget - don't await
    this.ensureConnected().then(connected => {
      if (connected) {
        logger.info('MCP background connection successful')
      } else {
        logger.warn('MCP background connection failed')
      }
    }).catch(error => {
      logger.error({ error }, 'MCP background connection error')
    })
  }

  /**
   * Load available tools from the MCP server
   */
  async loadTools() {
    if (!this.connected || !this.client) {
      throw new Error('Not connected to MCP server')
    }

    try {
      const response = await this.client.listTools()
      this.tools = response.tools || []

      logger.info({
        toolCount: this.tools.length,
        toolNames: this.tools.map(t => t.name)
      }, 'Loaded MCP tools')

      return this.tools
    } catch (error) {
      logger.error({ error }, 'Failed to load MCP tools')
      throw error
    }
  }

  /**
   * Get tools in a format suitable for LLM providers
   * @returns {Array} Tools formatted for LLM tool-use
   */
  getToolDefinitions() {
    return this.tools.map(tool => ({
      name: tool.name,
      description: tool.description || '',
      input_schema: tool.inputSchema || {
        type: 'object',
        properties: {},
        required: []
      }
    }))
  }

  /**
   * Execute a tool call (with lazy connection)
   * @param {string} toolName - Name of the tool to call
   * @param {Object} toolInput - Input parameters for the tool
   * @returns {Object} Tool execution result
   */
  async callTool(toolName, toolInput) {
    // Ensure connected before calling tool
    const isConnected = await this.ensureConnected()
    if (!isConnected) {
      return {
        content: 'MCP server not available. Please try again later.',
        isError: true
      }
    }

    logger.info({ toolName, toolInput }, 'Executing MCP tool')

    try {
      const result = await this.client.callTool({
        name: toolName,
        arguments: toolInput
      })

      logger.info({
        toolName,
        hasContent: !!result.content,
        isError: result.isError
      }, 'MCP tool executed')

      // Extract text content from result
      let content = ''
      if (result.content && Array.isArray(result.content)) {
        content = result.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n')
      } else if (typeof result.content === 'string') {
        content = result.content
      }

      return {
        content,
        isError: result.isError || false
      }
    } catch (error) {
      logger.error({ error, toolName }, 'MCP tool execution failed')
      return {
        content: `Error executing tool: ${error.message}`,
        isError: true
      }
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect() {
    try {
      if (this.client) {
        await this.client.close()
      }
      this.connected = false
      this.tools = []
      logger.info('Disconnected from MCP server')
    } catch (error) {
      logger.error({ error }, 'Error disconnecting from MCP server')
    }
  }

  /**
   * Check if connected to MCP server
   */
  isConnected() {
    return this.connected
  }

  /**
   * Check if connection is in progress
   */
  isConnecting() {
    return this.connecting
  }

  /**
   * Get list of available tool names
   */
  getToolNames() {
    return this.tools.map(t => t.name)
  }
}

// Singleton instance
let mcpClient = null

/**
 * Initialize MCP client with config (lazy - doesn't connect immediately)
 * @param {Object} config - MCP server configuration
 * @param {boolean} startBackground - If true, start connection in background
 */
export function initMCPClient(config, startBackground = true) {
  if (!mcpClient) {
    mcpClient = new MCPClient()
  }
  mcpClient.setConfig(config)

  if (startBackground) {
    mcpClient.startBackgroundConnection()
  }

  return mcpClient
}

/**
 * Get MCP client (creates if needed, connects lazily on first tool use)
 * @param {Object} config - Optional config if not already set
 */
export async function getMCPClient(config) {
  if (!mcpClient) {
    mcpClient = new MCPClient()
    if (config) {
      mcpClient.setConfig(config)
    }
  }

  // Ensure connected
  await mcpClient.ensureConnected()
  return mcpClient
}

/**
 * Get MCP client synchronously (may not be connected yet)
 */
export function getMCPClientSync() {
  return mcpClient
}

export { MCPClient }
