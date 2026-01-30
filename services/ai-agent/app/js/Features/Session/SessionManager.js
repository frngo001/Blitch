/**
 * Session Manager
 *
 * Manages AI chat sessions per user per project
 * Supports full conversation history with tool calls
 */

import logger from '@overleaf/logger'
import { ObjectId } from 'mongodb'
import { db } from '../../mongodb.js'
import {
  createMessageId,
  createUserMessage,
  createAssistantMessage,
  createToolResultMessage,
  calculateTotalTokens,
  getRecentMessages,
  validateMessage,
  MessageRole
} from '../../Models/Message.js'

const COLLECTION_NAME = 'ai_chat_sessions'

export const SessionManager = {
  /**
   * Get or create a session for a user in a project
   * @param {string} projectId - Project ID
   * @param {string} userId - User ID
   * @param {string} sessionId - Optional existing session ID
   * @returns {Object} Session document
   */
  async getOrCreateSession(projectId, userId, sessionId = null) {
    const collection = db.collection(COLLECTION_NAME)

    // If sessionId provided, try to find it
    if (sessionId) {
      const session = await collection.findOne({
        _id: new ObjectId(sessionId),
        project_id: new ObjectId(projectId),
        user_id: new ObjectId(userId)
      })

      if (session) {
        return session
      }
    }

    // Find active session or create new one
    let session = await collection.findOne({
      project_id: new ObjectId(projectId),
      user_id: new ObjectId(userId),
      status: 'active'
    })

    if (!session) {
      const newSession = {
        project_id: new ObjectId(projectId),
        user_id: new ObjectId(userId),
        created_at: new Date(),
        updated_at: new Date(),
        title: 'New Conversation',
        model_preference: {
          provider: 'anthropic',
          model: 'claude-3-5-haiku'
        },
        messages: [],
        status: 'active',
        total_tokens: {
          input: 0,
          output: 0
        },
        total_cost_usd: 0,
        message_count: 0,
        tool_call_count: 0
      }

      const result = await collection.insertOne(newSession)
      session = { ...newSession, _id: result.insertedId }

      logger.info({
        sessionId: session._id,
        projectId,
        userId
      }, 'New AI chat session created')
    }

    return session
  },

  /**
   * Get a session by ID
   * @param {string} sessionId - Session ID
   * @param {string} userId - User ID (for access control)
   * @returns {Object|null} Session document
   */
  async getSession(sessionId, userId) {
    const collection = db.collection(COLLECTION_NAME)

    return collection.findOne({
      _id: new ObjectId(sessionId),
      user_id: new ObjectId(userId)
    })
  },

  /**
   * Get session with full message history
   * @param {string} sessionId - Session ID
   * @param {string} userId - User ID (for access control)
   * @param {Object} options - Options for message retrieval
   * @returns {Object|null} Session with messages
   */
  async getSessionWithHistory(sessionId, userId, options = {}) {
    const collection = db.collection(COLLECTION_NAME)
    const { messageLimit = 100, includeToolCalls = true } = options

    const session = await collection.findOne({
      _id: new ObjectId(sessionId),
      user_id: new ObjectId(userId)
    })

    if (!session) {
      return null
    }

    // Apply message limit
    if (session.messages && session.messages.length > messageLimit) {
      session.messages = getRecentMessages(session.messages, messageLimit)
    }

    // Optionally filter out tool calls
    if (!includeToolCalls) {
      session.messages = session.messages.filter(
        msg => msg.role !== MessageRole.TOOL
      )
    }

    return session
  },

  /**
   * Update a session
   * @param {string} sessionId - Session ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated session
   */
  async updateSession(sessionId, updates) {
    const collection = db.collection(COLLECTION_NAME)

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(sessionId) },
      { $set: { ...updates, updated_at: new Date() } },
      { returnDocument: 'after' }
    )

    return result
  },

  /**
   * Create a new session
   * @param {string} projectId - Project ID
   * @param {string} userId - User ID
   * @param {Object} options - Session options
   * @returns {Object} New session
   */
  async createSession(projectId, userId, options = {}) {
    const collection = db.collection(COLLECTION_NAME)

    const newSession = {
      project_id: new ObjectId(projectId),
      user_id: new ObjectId(userId),
      created_at: new Date(),
      updated_at: new Date(),
      title: options.title || 'New Conversation',
      model_preference: {
        provider: options.provider || 'anthropic',
        model: options.model || 'claude-3-5-haiku'
      },
      messages: [],
      status: 'active',
      total_tokens: {
        input: 0,
        output: 0
      },
      total_cost_usd: 0,
      message_count: 0,
      tool_call_count: 0
    }

    const result = await collection.insertOne(newSession)

    logger.info({
      sessionId: result.insertedId,
      projectId,
      userId
    }, 'AI chat session created')

    return { ...newSession, _id: result.insertedId }
  },

  /**
   * Delete (archive) a session
   * @param {string} sessionId - Session ID
   * @param {string} userId - User ID
   * @returns {boolean} Success
   */
  async deleteSession(sessionId, userId) {
    const collection = db.collection(COLLECTION_NAME)

    const result = await collection.updateOne(
      {
        _id: new ObjectId(sessionId),
        user_id: new ObjectId(userId)
      },
      { $set: { status: 'archived', updated_at: new Date() } }
    )

    return result.modifiedCount > 0
  },

  /**
   * List sessions for a user in a project
   * @param {string} projectId - Project ID
   * @param {string} userId - User ID
   * @param {Object} options - Pagination options
   * @returns {Array} Sessions
   */
  async listSessions(projectId, userId, options = {}) {
    const collection = db.collection(COLLECTION_NAME)

    const { limit = 20, skip = 0, includeArchived = false } = options

    const query = {
      project_id: new ObjectId(projectId),
      user_id: new ObjectId(userId)
    }

    if (!includeArchived) {
      query.status = 'active'
    }

    const sessions = await collection
      .find(query)
      .sort({ updated_at: -1 })
      .skip(skip)
      .limit(limit)
      .project({
        messages: { $slice: -1 }, // Only last message for preview
        title: 1,
        status: 1,
        created_at: 1,
        updated_at: 1,
        total_tokens: 1,
        total_cost_usd: 1,
        model_preference: 1,
        message_count: 1,
        tool_call_count: 1
      })
      .toArray()

    return sessions
  },

  /**
   * Update session title (auto-generate from first message)
   * @param {string} sessionId - Session ID
   * @param {string} firstMessage - First user message
   */
  async autoGenerateTitle(sessionId, firstMessage) {
    // Generate title from first 50 chars of message
    const title = firstMessage.length > 50
      ? firstMessage.substring(0, 47) + '...'
      : firstMessage

    await this.updateSession(sessionId, { title })
  },

  /**
   * Add a user message to session
   * @param {string} sessionId - Session ID
   * @param {string} content - Message content
   * @param {Object} context - Document context
   * @returns {Object} Created message
   */
  async addUserMessage(sessionId, content, context = null) {
    const collection = db.collection(COLLECTION_NAME)
    const message = createUserMessage(content, context)

    const validation = validateMessage(message)
    if (!validation.valid) {
      logger.error({ errors: validation.errors }, 'Invalid user message')
      throw new Error(`Invalid message: ${validation.errors.join(', ')}`)
    }

    await collection.updateOne(
      { _id: new ObjectId(sessionId) },
      {
        $push: { messages: message },
        $inc: { message_count: 1 },
        $set: { updated_at: new Date() }
      }
    )

    logger.debug({ sessionId, messageId: message.id }, 'User message added')
    return message
  },

  /**
   * Add an assistant message to session (with tool calls support)
   * @param {string} sessionId - Session ID
   * @param {Object} response - LLM response object
   * @returns {Object} Created message
   */
  async addAssistantMessage(sessionId, response) {
    const collection = db.collection(COLLECTION_NAME)
    const message = createAssistantMessage(response)

    const validation = validateMessage(message)
    if (!validation.valid) {
      logger.error({ errors: validation.errors }, 'Invalid assistant message')
      throw new Error(`Invalid message: ${validation.errors.join(', ')}`)
    }

    const toolCallCount = message.tool_calls?.length || 0
    const tokenInc = {
      'total_tokens.input': message.metadata.tokens_used?.input || 0,
      'total_tokens.output': message.metadata.tokens_used?.output || 0
    }

    await collection.updateOne(
      { _id: new ObjectId(sessionId) },
      {
        $push: { messages: message },
        $inc: {
          message_count: 1,
          tool_call_count: toolCallCount,
          ...tokenInc
        },
        $set: { updated_at: new Date() }
      }
    )

    logger.debug({
      sessionId,
      messageId: message.id,
      hasToolCalls: toolCallCount > 0,
      toolCallCount
    }, 'Assistant message added')

    return message
  },

  /**
   * Add a tool result message to session
   * @param {string} sessionId - Session ID
   * @param {string} toolCallId - ID of the tool call
   * @param {string} toolName - Name of the tool
   * @param {*} result - Tool result
   * @param {boolean} isError - Whether result is an error
   * @returns {Object} Created message
   */
  async addToolResultMessage(sessionId, toolCallId, toolName, result, isError = false) {
    const collection = db.collection(COLLECTION_NAME)
    const message = createToolResultMessage(toolCallId, toolName, result, isError)

    const validation = validateMessage(message)
    if (!validation.valid) {
      logger.error({ errors: validation.errors }, 'Invalid tool result message')
      throw new Error(`Invalid message: ${validation.errors.join(', ')}`)
    }

    await collection.updateOne(
      { _id: new ObjectId(sessionId) },
      {
        $push: { messages: message },
        $inc: { message_count: 1 },
        $set: { updated_at: new Date() }
      }
    )

    logger.debug({
      sessionId,
      messageId: message.id,
      toolCallId,
      toolName,
      isError
    }, 'Tool result message added')

    return message
  },

  /**
   * Add message to session (legacy support)
   * @param {string} sessionId - Session ID
   * @param {Object} message - Message to add
   * @deprecated Use addUserMessage, addAssistantMessage, or addToolResultMessage instead
   */
  async addMessage(sessionId, message) {
    const collection = db.collection(COLLECTION_NAME)

    // Ensure message has required fields
    if (!message.id) {
      message.id = createMessageId()
    }
    if (!message.timestamp) {
      message.timestamp = new Date()
    }

    const inc = { message_count: 1 }
    if (message.tool_calls) {
      inc.tool_call_count = message.tool_calls.length
    }
    if (message.metadata?.tokens_used) {
      inc['total_tokens.input'] = message.metadata.tokens_used.input || 0
      inc['total_tokens.output'] = message.metadata.tokens_used.output || 0
    }

    await collection.updateOne(
      { _id: new ObjectId(sessionId) },
      {
        $push: { messages: message },
        $inc: inc,
        $set: { updated_at: new Date() }
      }
    )
  },

  /**
   * Get conversation history for a session
   * @param {string} sessionId - Session ID
   * @param {string} userId - User ID (for access control)
   * @param {Object} options - Options
   * @returns {Array} Messages array
   */
  async getConversationHistory(sessionId, userId, options = {}) {
    const session = await this.getSessionWithHistory(sessionId, userId, options)
    return session?.messages || []
  },

  /**
   * Get tool calls from a session
   * @param {string} sessionId - Session ID
   * @param {string} userId - User ID
   * @returns {Array} Tool calls with results
   */
  async getToolCalls(sessionId, userId) {
    const session = await this.getSession(sessionId, userId)
    if (!session) return []

    const toolCalls = []
    const toolResultMap = new Map()

    // First pass: collect tool results
    for (const msg of session.messages) {
      if (msg.role === MessageRole.TOOL) {
        toolResultMap.set(msg.tool_call_id, {
          result: msg.content,
          is_error: msg.is_error,
          timestamp: msg.timestamp
        })
      }
    }

    // Second pass: collect tool calls with their results
    for (const msg of session.messages) {
      if (msg.role === MessageRole.ASSISTANT && msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          toolCalls.push({
            id: tc.id,
            name: tc.name,
            input: tc.input,
            called_at: msg.timestamp,
            message_id: msg.id,
            result: toolResultMap.get(tc.id)
          })
        }
      }
    }

    return toolCalls
  },

  /**
   * Get usage statistics for a user
   * @param {string} userId - User ID
   * @returns {Object} Usage stats
   */
  async getUserStats(userId) {
    const collection = db.collection(COLLECTION_NAME)

    const stats = await collection.aggregate([
      { $match: { user_id: new ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          totalTokensInput: { $sum: '$total_tokens.input' },
          totalTokensOutput: { $sum: '$total_tokens.output' },
          totalCost: { $sum: '$total_cost_usd' },
          totalMessages: { $sum: '$message_count' },
          totalToolCalls: { $sum: '$tool_call_count' }
        }
      }
    ]).toArray()

    const result = stats[0] || {
      totalSessions: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0,
      totalCost: 0,
      totalMessages: 0,
      totalToolCalls: 0
    }

    result.totalTokens = result.totalTokensInput + result.totalTokensOutput
    return result
  },

  /**
   * Export session for download/backup
   * @param {string} sessionId - Session ID
   * @param {string} userId - User ID
   * @returns {Object} Exportable session object
   */
  async exportSession(sessionId, userId) {
    const session = await this.getSessionWithHistory(sessionId, userId, { messageLimit: 10000 })
    if (!session) return null

    return {
      id: session._id.toString(),
      title: session.title,
      created_at: session.created_at,
      updated_at: session.updated_at,
      model: session.model_preference,
      statistics: {
        message_count: session.message_count,
        tool_call_count: session.tool_call_count,
        total_tokens: session.total_tokens,
        total_cost_usd: session.total_cost_usd
      },
      messages: session.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        tool_calls: msg.tool_calls,
        tool_call_id: msg.tool_call_id,
        tool_name: msg.tool_name,
        stop_reason: msg.stop_reason,
        is_error: msg.is_error
      }))
    }
  },

  /**
   * Search messages within a session
   * @param {string} sessionId - Session ID
   * @param {string} userId - User ID
   * @param {string} query - Search query
   * @returns {Array} Matching messages
   */
  async searchMessages(sessionId, userId, query) {
    const session = await this.getSession(sessionId, userId)
    if (!session) return []

    const queryLower = query.toLowerCase()
    return session.messages.filter(msg =>
      msg.content?.toLowerCase().includes(queryLower) ||
      msg.tool_name?.toLowerCase().includes(queryLower)
    )
  }
}
