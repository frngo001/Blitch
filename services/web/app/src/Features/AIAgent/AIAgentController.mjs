// @ts-check

/**
 * AI Agent Controller
 *
 * HTTP request handlers for AI Agent endpoints in the web service
 */

import AIAgentApiHandler from './AIAgentApiHandler.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import { expressify } from '@overleaf/promise-utils'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'

/**
 * Check if AI Agent feature is enabled
 */
function _isAIAgentEnabled() {
  return process.env.AI_AGENT_ENABLED === 'true' ||
    Settings.aiAgent?.enabled === true
}

/**
 * Get user's subscription tier
 * @param {string} userId
 */
async function _getUserTier(userId) {
  // TODO: Implement proper tier lookup from user_subscriptions collection
  // For now, return 'free' as default
  return 'free'
}

/**
 * Send message to AI agent
 * POST /project/:project_id/agent/message
 */
async function sendMessage(req, res) {
  if (!_isAIAgentEnabled()) {
    return res.status(503).json({ error: 'AI Agent not enabled' })
  }

  const { project_id: projectId } = req.params
  const { message, sessionId, model, provider, context } = req.body
  const userId = SessionManager.getLoggedInUserId(req.session)

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  if (!message) {
    return res.status(400).json({ error: 'Message is required' })
  }

  try {
    const response = await AIAgentApiHandler.promises.sendMessage(
      projectId,
      userId,
      message,
      { sessionId, model, provider, context }
    )

    res.json(response)
  } catch (error) {
    logger.error({ error, projectId, userId }, 'AI Agent message failed')
    res.status(500).json({ error: 'Failed to send message to AI agent' })
  }
}

/**
 * Get SSE stream URL for real-time responses
 * GET /project/:project_id/agent/stream
 */
async function getStreamUrl(req, res) {
  if (!_isAIAgentEnabled()) {
    return res.status(503).json({ error: 'AI Agent not enabled' })
  }

  const { project_id: projectId } = req.params
  const { message, sessionId, model, provider, context } = req.query
  const userId = SessionManager.getLoggedInUserId(req.session)

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  // Return the stream URL that the frontend can connect to
  const streamUrl = AIAgentApiHandler.getStreamUrl(projectId, message, {
    sessionId,
    model,
    provider,
    context: context ? JSON.parse(context) : null
  })

  res.json({ streamUrl })
}

/**
 * Proxy SSE stream from AI Agent service
 * GET /project/:project_id/agent/stream/proxy
 */
async function proxyStream(req, res) {
  if (!_isAIAgentEnabled()) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'AI Agent not enabled' })}\n\n`)
    return res.end()
  }

  const { project_id: projectId } = req.params
  const { message, sessionId, model, provider, context, attachments } = req.query
  const userId = SessionManager.getLoggedInUserId(req.session)

  if (!userId) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Not authenticated' })}\n\n`)
    return res.end()
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  // Flush headers immediately to establish SSE connection
  res.flushHeaders()

  try {
    const streamUrl = AIAgentApiHandler.getStreamUrl(projectId, message, {
      sessionId,
      model,
      provider,
      context: context ? JSON.parse(context) : null,
      attachments: attachments ? JSON.parse(attachments) : null
    })

    // Add user ID header to the stream request
    const url = new URL(streamUrl)
    const response = await fetch(url, {
      headers: {
        'x-user-id': userId,
        'Accept': 'text/event-stream'
      }
    })

    if (!response.ok) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Stream connection failed' })}\n\n`)
      return res.end()
    }

    if (!response.body) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'No response body' })}\n\n`)
      return res.end()
    }

    // Pipe the response with immediate flushing
    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      res.write(chunk)
      // Flush immediately if available (for compression middleware)
      if (typeof res.flush === 'function') {
        res.flush()
      }
    }

    res.end()
  } catch (error) {
    logger.error({ error, projectId, userId }, 'AI Agent stream failed')
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Stream failed' })}\n\n`)
    res.end()
  }
}

/**
 * Get current session
 * GET /project/:project_id/agent/session
 */
async function getSession(req, res) {
  if (!_isAIAgentEnabled()) {
    return res.status(503).json({ error: 'AI Agent not enabled' })
  }

  const { project_id: projectId } = req.params
  const { sessionId } = req.query
  const userId = SessionManager.getLoggedInUserId(req.session)

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    const response = await AIAgentApiHandler.promises.getSession(projectId, userId, sessionId)
    res.json(response)
  } catch (error) {
    logger.error({ error, projectId, userId }, 'Get session failed')
    res.status(500).json({ error: 'Failed to get session' })
  }
}

/**
 * Create new session
 * POST /project/:project_id/agent/session
 */
async function createSession(req, res) {
  if (!_isAIAgentEnabled()) {
    return res.status(503).json({ error: 'AI Agent not enabled' })
  }

  const { project_id: projectId } = req.params
  const { title, provider, model } = req.body
  const userId = SessionManager.getLoggedInUserId(req.session)

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    const response = await AIAgentApiHandler.promises.createSession(
      projectId,
      userId,
      { title, provider, model }
    )
    res.status(201).json(response)
  } catch (error) {
    logger.error({ error, projectId, userId }, 'Create session failed')
    res.status(500).json({ error: 'Failed to create session' })
  }
}

/**
 * Delete session
 * DELETE /project/:project_id/agent/session
 */
async function deleteSession(req, res) {
  if (!_isAIAgentEnabled()) {
    return res.status(503).json({ error: 'AI Agent not enabled' })
  }

  const { project_id: projectId } = req.params
  const { sessionId } = req.query
  const userId = SessionManager.getLoggedInUserId(req.session)

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID required' })
  }

  try {
    await AIAgentApiHandler.promises.deleteSession(projectId, userId, sessionId)
    res.json({ success: true })
  } catch (error) {
    logger.error({ error, projectId, userId, sessionId }, 'Delete session failed')
    res.status(500).json({ error: 'Failed to delete session' })
  }
}

/**
 * List sessions
 * GET /project/:project_id/agent/sessions
 */
async function listSessions(req, res) {
  if (!_isAIAgentEnabled()) {
    return res.status(503).json({ error: 'AI Agent not enabled' })
  }

  const { project_id: projectId } = req.params
  const { limit, skip, includeArchived } = req.query
  const userId = SessionManager.getLoggedInUserId(req.session)

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    const response = await AIAgentApiHandler.promises.listSessions(
      projectId,
      userId,
      { limit: parseInt(limit), skip: parseInt(skip), includeArchived: includeArchived === 'true' }
    )
    res.json(response)
  } catch (error) {
    logger.error({ error, projectId, userId }, 'List sessions failed')
    res.status(500).json({ error: 'Failed to list sessions' })
  }
}

/**
 * Get session history (messages)
 * GET /project/:project_id/agent/session/:session_id/history
 */
async function getSessionHistory(req, res) {
  if (!_isAIAgentEnabled()) {
    return res.status(503).json({ error: 'AI Agent not enabled' })
  }

  const { project_id: projectId, session_id: sessionId } = req.params
  const { limit, includeToolCalls } = req.query
  const userId = SessionManager.getLoggedInUserId(req.session)

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    const response = await AIAgentApiHandler.promises.getSessionHistory(
      projectId,
      userId,
      sessionId,
      { limit: parseInt(limit), includeToolCalls: includeToolCalls !== 'false' }
    )
    res.json(response)
  } catch (error) {
    logger.error({ error, projectId, userId, sessionId }, 'Get session history failed')
    res.status(500).json({ error: 'Failed to get session history' })
  }
}

/**
 * Get skills
 * GET /project/:project_id/agent/skills
 */
async function getSkills(req, res) {
  if (!_isAIAgentEnabled()) {
    return res.status(503).json({ error: 'AI Agent not enabled' })
  }

  const { project_id: projectId } = req.params
  const userId = SessionManager.getLoggedInUserId(req.session)

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    const userTier = await _getUserTier(userId)
    const response = await AIAgentApiHandler.promises.getSkills(projectId, userId, userTier)
    res.json(response)
  } catch (error) {
    logger.error({ error, projectId, userId }, 'Get skills failed')
    res.status(500).json({ error: 'Failed to get skills' })
  }
}

/**
 * Execute skill
 * POST /project/:project_id/agent/skill/:skill_id/execute
 */
async function executeSkill(req, res) {
  if (!_isAIAgentEnabled()) {
    return res.status(503).json({ error: 'AI Agent not enabled' })
  }

  const { project_id: projectId, skill_id: skillId } = req.params
  const { input, context, model, provider } = req.body
  const userId = SessionManager.getLoggedInUserId(req.session)

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  if (!input) {
    return res.status(400).json({ error: 'Input is required' })
  }

  try {
    const userTier = await _getUserTier(userId)
    const response = await AIAgentApiHandler.promises.executeSkill(
      projectId,
      userId,
      skillId,
      input,
      { context, model, provider, userTier }
    )
    res.json(response)
  } catch (error) {
    logger.error({ error, projectId, userId, skillId }, 'Execute skill failed')
    res.status(500).json({ error: 'Failed to execute skill' })
  }
}

/**
 * Get providers
 * GET /agent/providers
 */
async function getProviders(req, res) {
  if (!_isAIAgentEnabled()) {
    return res.status(503).json({ error: 'AI Agent not enabled' })
  }

  try {
    const response = await AIAgentApiHandler.promises.getProviders()
    res.json(response)
  } catch (error) {
    logger.error({ error }, 'Get providers failed')
    res.status(500).json({ error: 'Failed to get providers' })
  }
}

/**
 * Get models
 * GET /agent/models
 */
async function getModels(req, res) {
  if (!_isAIAgentEnabled()) {
    return res.status(503).json({ error: 'AI Agent not enabled' })
  }

  const { provider } = req.query

  try {
    const response = await AIAgentApiHandler.promises.getModels(provider)
    res.json(response)
  } catch (error) {
    logger.error({ error }, 'Get models failed')
    res.status(500).json({ error: 'Failed to get models' })
  }
}

/**
 * Health check
 * GET /agent/health
 */
async function healthCheck(req, res) {
  if (!_isAIAgentEnabled()) {
    return res.json({ enabled: false, status: 'disabled' })
  }

  try {
    const response = await AIAgentApiHandler.promises.healthCheck()
    res.json({ enabled: true, ...response })
  } catch (error) {
    logger.warn({ error }, 'AI Agent health check failed')
    res.json({ enabled: true, status: 'unhealthy', error: error.message })
  }
}

export default {
  sendMessage: expressify(sendMessage),
  getStreamUrl: expressify(getStreamUrl),
  proxyStream: expressify(proxyStream),
  getSession: expressify(getSession),
  createSession: expressify(createSession),
  deleteSession: expressify(deleteSession),
  listSessions: expressify(listSessions),
  getSessionHistory: expressify(getSessionHistory),
  getSkills: expressify(getSkills),
  executeSkill: expressify(executeSkill),
  getProviders: expressify(getProviders),
  getModels: expressify(getModels),
  healthCheck: expressify(healthCheck)
}
