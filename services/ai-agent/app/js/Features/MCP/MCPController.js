/**
 * MCP Controller
 *
 * Handles MCP-related API endpoints:
 * - List available MCP tools
 * - Execute MCP tool calls
 * - Get MCP server status
 */

import logger from '@overleaf/logger'
import { getMCPClientSync } from '../../Infrastructure/MCP/MCPClient.js'

export const MCPController = {
  /**
   * Get MCP server status and available tools
   * GET /agent/mcp/status
   */
  async getStatus(req, res) {
    try {
      const mcpClient = getMCPClientSync()

      if (!mcpClient || !mcpClient.isConnected()) {
        return res.json({
          connected: false,
          tools: [],
          message: 'MCP server not connected'
        })
      }

      res.json({
        connected: true,
        tools: mcpClient.getToolDefinitions(),
        toolNames: mcpClient.getToolNames()
      })
    } catch (error) {
      logger.error({ error }, 'Failed to get MCP status')
      res.status(500).json({ error: 'Failed to get MCP status' })
    }
  },

  /**
   * List available MCP tools
   * GET /agent/mcp/tools
   */
  async listTools(req, res) {
    try {
      const mcpClient = getMCPClientSync()

      if (!mcpClient || !mcpClient.isConnected()) {
        return res.json({ tools: [], message: 'MCP server not connected' })
      }

      res.json({
        tools: mcpClient.getToolDefinitions()
      })
    } catch (error) {
      logger.error({ error }, 'Failed to list MCP tools')
      res.status(500).json({ error: 'Failed to list MCP tools' })
    }
  },

  /**
   * Execute an MCP tool
   * POST /agent/mcp/execute
   */
  async executeTool(req, res) {
    try {
      const { tool_name, tool_input } = req.body

      if (!tool_name) {
        return res.status(400).json({ error: 'tool_name is required' })
      }

      const mcpClient = getMCPClientSync()

      if (!mcpClient || !mcpClient.isConnected()) {
        return res.status(503).json({ error: 'MCP server not connected' })
      }

      logger.info({ tool_name, tool_input }, 'Executing MCP tool via API')

      const result = await mcpClient.callTool(tool_name, tool_input || {})

      res.json({
        tool_name,
        result: result.content,
        is_error: result.isError
      })
    } catch (error) {
      logger.error({ error }, 'Failed to execute MCP tool')
      res.status(500).json({ error: 'Failed to execute MCP tool', details: error.message })
    }
  },

  /**
   * Search for skills using MCP find_helpful_skills tool
   * GET /agent/mcp/search?query=...
   */
  async searchSkills(req, res) {
    try {
      const { query } = req.query

      if (!query) {
        return res.status(400).json({ error: 'query parameter is required' })
      }

      const mcpClient = getMCPClientSync()

      if (!mcpClient || !mcpClient.isConnected()) {
        return res.status(503).json({ error: 'MCP server not connected' })
      }

      const result = await mcpClient.callTool('find_helpful_skills', {
        task_description: query
      })

      res.json({
        query,
        skills: result.content,
        is_error: result.isError
      })
    } catch (error) {
      logger.error({ error }, 'Failed to search MCP skills')
      res.status(500).json({ error: 'Failed to search skills', details: error.message })
    }
  }
}
