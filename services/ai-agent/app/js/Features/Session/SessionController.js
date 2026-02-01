/**
 * Session Controller
 *
 * HTTP handlers for AI chat session management
 * Includes conversation history and tool call retrieval
 */

import logger from '@overleaf/logger'
import { SessionManager } from './SessionManager.js'

export const SessionController = {
  /**
   * Get current session or list all sessions
   * GET /project/:projectId/agent/session
   */
  async getSession(req, res) {
    try {
      const { projectId } = req.params
      const { sessionId } = req.query
      const userId = req.headers['x-user-id']

      if (!userId) {
        return res.status(401).json({ error: 'User ID required' })
      }

      if (sessionId) {
        // Get specific session
        const session = await SessionManager.getSession(sessionId, userId)

        if (!session) {
          return res.status(404).json({ error: 'Session not found' })
        }

        res.json({ session })
      } else {
        // Get active session for project
        const session = await SessionManager.getOrCreateSession(projectId, userId)
        res.json({ session })
      }

    } catch (error) {
      logger.error({ error }, 'Failed to get session')
      res.status(500).json({ error: 'Failed to get session' })
    }
  },

  /**
   * Create a new session
   * POST /project/:projectId/agent/session
   */
  async createSession(req, res) {
    try {
      const { projectId } = req.params
      const { title, provider, model } = req.body
      const userId = req.headers['x-user-id']

      if (!userId) {
        return res.status(401).json({ error: 'User ID required' })
      }

      const session = await SessionManager.createSession(projectId, userId, {
        title,
        provider,
        model
      })

      logger.info({
        sessionId: session._id,
        projectId,
        userId
      }, 'Session created')

      res.status(201).json({ session })

    } catch (error) {
      logger.error({ error }, 'Failed to create session')
      res.status(500).json({ error: 'Failed to create session' })
    }
  },

  /**
   * Delete (archive) a session
   * DELETE /project/:projectId/agent/session
   */
  async deleteSession(req, res) {
    try {
      const { projectId } = req.params
      const { sessionId } = req.query
      const userId = req.headers['x-user-id']

      if (!userId) {
        return res.status(401).json({ error: 'User ID required' })
      }

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID required' })
      }

      const success = await SessionManager.deleteSession(sessionId, userId)

      if (!success) {
        return res.status(404).json({ error: 'Session not found' })
      }

      logger.info({ sessionId, projectId, userId }, 'Session deleted')

      res.json({ success: true })

    } catch (error) {
      logger.error({ error }, 'Failed to delete session')
      res.status(500).json({ error: 'Failed to delete session' })
    }
  },

  /**
   * List all sessions for a project
   * GET /project/:projectId/agent/sessions
   */
  async listSessions(req, res) {
    try {
      const { projectId } = req.params
      const { limit, skip, includeArchived } = req.query
      const userId = req.headers['x-user-id']

      if (!userId) {
        return res.status(401).json({ error: 'User ID required' })
      }

      const sessions = await SessionManager.listSessions(projectId, userId, {
        limit: parseInt(limit) || 20,
        skip: parseInt(skip) || 0,
        includeArchived: includeArchived === 'true'
      })

      res.json({ sessions })

    } catch (error) {
      logger.error({ error }, 'Failed to list sessions')
      res.status(500).json({ error: 'Failed to list sessions' })
    }
  },

  /**
   * Get conversation history for a session
   * GET /project/:projectId/agent/session/:sessionId/history
   */
  async getConversationHistory(req, res) {
    try {
      const { sessionId } = req.params
      const { limit, includeToolCalls } = req.query
      const userId = req.headers['x-user-id']

      if (!userId) {
        return res.status(401).json({ error: 'User ID required' })
      }

      // Get full session with history (includes model_preference)
      const session = await SessionManager.getSessionWithHistory(
        sessionId,
        userId,
        {
          messageLimit: parseInt(limit) || 100,
          includeToolCalls: includeToolCalls !== 'false'
        }
      )

      if (!session) {
        return res.status(404).json({ error: 'Session not found' })
      }

      res.json({
        session_id: sessionId,
        title: session.title,
        model_preference: session.model_preference,
        message_count: session.messages?.length || 0,
        messages: session.messages || []
      })

    } catch (error) {
      logger.error({ error }, 'Failed to get conversation history')
      res.status(500).json({ error: 'Failed to get conversation history' })
    }
  },

  /**
   * Get tool calls from a session
   * GET /project/:projectId/agent/session/:sessionId/tool-calls
   */
  async getToolCalls(req, res) {
    try {
      const { sessionId } = req.params
      const userId = req.headers['x-user-id']

      if (!userId) {
        return res.status(401).json({ error: 'User ID required' })
      }

      const toolCalls = await SessionManager.getToolCalls(sessionId, userId)

      res.json({
        session_id: sessionId,
        tool_call_count: toolCalls.length,
        tool_calls: toolCalls
      })

    } catch (error) {
      logger.error({ error }, 'Failed to get tool calls')
      res.status(500).json({ error: 'Failed to get tool calls' })
    }
  },

  /**
   * Export session for backup/download
   * GET /project/:projectId/agent/session/:sessionId/export
   */
  async exportSession(req, res) {
    try {
      const { sessionId } = req.params
      const userId = req.headers['x-user-id']

      if (!userId) {
        return res.status(401).json({ error: 'User ID required' })
      }

      const exportData = await SessionManager.exportSession(sessionId, userId)

      if (!exportData) {
        return res.status(404).json({ error: 'Session not found' })
      }

      // Set headers for file download
      res.setHeader('Content-Type', 'application/json')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="chat-session-${sessionId}.json"`
      )

      res.json(exportData)

    } catch (error) {
      logger.error({ error }, 'Failed to export session')
      res.status(500).json({ error: 'Failed to export session' })
    }
  },

  /**
   * Search messages within a session
   * GET /project/:projectId/agent/session/:sessionId/search
   */
  async searchMessages(req, res) {
    try {
      const { sessionId } = req.params
      const { q } = req.query
      const userId = req.headers['x-user-id']

      if (!userId) {
        return res.status(401).json({ error: 'User ID required' })
      }

      if (!q) {
        return res.status(400).json({ error: 'Search query (q) is required' })
      }

      const messages = await SessionManager.searchMessages(sessionId, userId, q)

      res.json({
        session_id: sessionId,
        query: q,
        result_count: messages.length,
        messages
      })

    } catch (error) {
      logger.error({ error }, 'Failed to search messages')
      res.status(500).json({ error: 'Failed to search messages' })
    }
  },

  /**
   * Get user statistics
   * GET /agent/user/stats
   */
  async getUserStats(req, res) {
    try {
      const userId = req.headers['x-user-id']

      if (!userId) {
        return res.status(401).json({ error: 'User ID required' })
      }

      const stats = await SessionManager.getUserStats(userId)

      res.json({ stats })

    } catch (error) {
      logger.error({ error }, 'Failed to get user stats')
      res.status(500).json({ error: 'Failed to get user stats' })
    }
  },

  /**
   * Update session title
   * PATCH /project/:projectId/agent/session/:sessionId
   */
  async updateSession(req, res) {
    try {
      const { sessionId } = req.params
      const { title, model_preference } = req.body
      const userId = req.headers['x-user-id']

      if (!userId) {
        return res.status(401).json({ error: 'User ID required' })
      }

      // Verify session belongs to user
      const existingSession = await SessionManager.getSession(sessionId, userId)
      if (!existingSession) {
        return res.status(404).json({ error: 'Session not found' })
      }

      // Build update object
      const updates = {}
      if (title) updates.title = title
      if (model_preference) updates.model_preference = model_preference

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid update fields provided' })
      }

      const session = await SessionManager.updateSession(sessionId, updates)

      logger.info({ sessionId, updates }, 'Session updated')

      res.json({ session })

    } catch (error) {
      logger.error({ error }, 'Failed to update session')
      res.status(500).json({ error: 'Failed to update session' })
    }
  }
}
