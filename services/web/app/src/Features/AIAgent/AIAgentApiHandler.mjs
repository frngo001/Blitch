// @ts-check

/**
 * AI Agent API Handler
 *
 * HTTP client for communicating with the AI-Agent microservice
 */

import { fetchJson, fetchNothing } from '@overleaf/fetch-utils'
import settings from '@overleaf/settings'
import { callbackify } from 'node:util'

/**
 * Send a message to the AI agent
 * @param {string} projectId
 * @param {string} userId
 * @param {string} message
 * @param {Object} options
 */
async function sendMessage(projectId, userId, message, options = {}) {
  const { sessionId, model, provider, context } = options

  const response = await fetchJson(
    aiAgentApiUrl(`/project/${projectId}/agent/message`),
    {
      method: 'POST',
      headers: {
        'x-user-id': userId
      },
      json: {
        message,
        sessionId,
        model,
        provider,
        context
      }
    }
  )
  return response
}

/**
 * Get the current session for a project
 * @param {string} projectId
 * @param {string} userId
 * @param {string} sessionId - Optional specific session ID
 */
async function getSession(projectId, userId, sessionId = null) {
  const url = aiAgentApiUrl(`/project/${projectId}/agent/session`)
  if (sessionId) {
    url.searchParams.set('sessionId', sessionId)
  }

  return await fetchJson(url, {
    headers: { 'x-user-id': userId }
  })
}

/**
 * Create a new AI chat session
 * @param {string} projectId
 * @param {string} userId
 * @param {Object} options
 */
async function createSession(projectId, userId, options = {}) {
  const { title, provider, model } = options

  return await fetchJson(
    aiAgentApiUrl(`/project/${projectId}/agent/session`),
    {
      method: 'POST',
      headers: { 'x-user-id': userId },
      json: { title, provider, model }
    }
  )
}

/**
 * Delete (archive) a session
 * @param {string} projectId
 * @param {string} userId
 * @param {string} sessionId
 */
async function deleteSession(projectId, userId, sessionId) {
  const url = aiAgentApiUrl(`/project/${projectId}/agent/session`)
  url.searchParams.set('sessionId', sessionId)

  await fetchNothing(url, {
    method: 'DELETE',
    headers: { 'x-user-id': userId }
  })
}

/**
 * List all sessions for a user in a project
 * @param {string} projectId
 * @param {string} userId
 * @param {Object} options
 */
async function listSessions(projectId, userId, options = {}) {
  const { limit, skip, includeArchived } = options

  const url = aiAgentApiUrl(`/project/${projectId}/agent/sessions`)
  if (limit) url.searchParams.set('limit', limit.toString())
  if (skip) url.searchParams.set('skip', skip.toString())
  if (includeArchived) url.searchParams.set('includeArchived', 'true')

  return await fetchJson(url, {
    headers: { 'x-user-id': userId }
  })
}

/**
 * Get session history (messages) for a specific session
 * @param {string} projectId
 * @param {string} userId
 * @param {string} sessionId
 * @param {Object} options
 */
async function getSessionHistory(projectId, userId, sessionId, options = {}) {
  const { limit, includeToolCalls } = options

  const url = aiAgentApiUrl(`/project/${projectId}/agent/session/${sessionId}/history`)
  if (limit) url.searchParams.set('limit', limit.toString())
  if (includeToolCalls === false) url.searchParams.set('includeToolCalls', 'false')

  return await fetchJson(url, {
    headers: { 'x-user-id': userId }
  })
}

/**
 * Get available skills
 * @param {string} projectId
 * @param {string} userId
 * @param {string} userTier
 */
async function getSkills(projectId, userId, userTier = 'free') {
  return await fetchJson(
    aiAgentApiUrl(`/project/${projectId}/agent/skills`),
    {
      headers: {
        'x-user-id': userId,
        'x-user-tier': userTier
      }
    }
  )
}

/**
 * Execute a skill
 * @param {string} projectId
 * @param {string} userId
 * @param {string} skillId
 * @param {string} input
 * @param {Object} options
 */
async function executeSkill(projectId, userId, skillId, input, options = {}) {
  const { context, model, provider, userTier } = options

  return await fetchJson(
    aiAgentApiUrl(`/project/${projectId}/agent/skill/${skillId}/execute`),
    {
      method: 'POST',
      headers: {
        'x-user-id': userId,
        'x-user-tier': userTier || 'free'
      },
      json: { input, context, model, provider }
    }
  )
}

/**
 * Get available providers
 */
async function getProviders() {
  return await fetchJson(aiAgentApiUrl('/agent/providers'))
}

/**
 * Get available models
 * @param {string} provider - Optional provider filter
 */
async function getModels(provider = null) {
  const url = aiAgentApiUrl('/agent/models')
  if (provider) {
    url.searchParams.set('provider', provider)
  }
  return await fetchJson(url)
}

/**
 * Get skill categories
 */
async function getSkillCategories() {
  return await fetchJson(aiAgentApiUrl('/agent/skills/categories'))
}

/**
 * Health check
 */
async function healthCheck() {
  return await fetchJson(aiAgentApiUrl('/status'))
}

/**
 * Get streaming URL for SSE connection
 * @param {string} projectId
 * @param {string} message
 * @param {Object} options
 */
function getStreamUrl(projectId, message, options = {}) {
  const { sessionId, model, provider, context, attachments } = options

  const url = aiAgentApiUrl(`/project/${projectId}/agent/stream`)
  url.searchParams.set('message', message)
  if (sessionId) url.searchParams.set('sessionId', sessionId)
  if (model) url.searchParams.set('model', model)
  if (provider) url.searchParams.set('provider', provider)
  if (context) url.searchParams.set('context', JSON.stringify(context))
  if (attachments) url.searchParams.set('attachments', JSON.stringify(attachments))

  return url.toString()
}

function aiAgentApiUrl(path) {
  const baseUrl = settings.apis?.aiAgent?.internal_url ||
    `http://${process.env.AI_AGENT_HOST || 'ai-agent'}:${process.env.AI_AGENT_PORT || '3020'}`
  return new URL(path, baseUrl)
}

export default {
  sendMessage: callbackify(sendMessage),
  getSession: callbackify(getSession),
  createSession: callbackify(createSession),
  deleteSession: callbackify(deleteSession),
  listSessions: callbackify(listSessions),
  getSessionHistory: callbackify(getSessionHistory),
  getSkills: callbackify(getSkills),
  executeSkill: callbackify(executeSkill),
  getProviders: callbackify(getProviders),
  getModels: callbackify(getModels),
  getSkillCategories: callbackify(getSkillCategories),
  healthCheck: callbackify(healthCheck),
  getStreamUrl,
  promises: {
    sendMessage,
    getSession,
    createSession,
    deleteSession,
    listSessions,
    getSessionHistory,
    getSkills,
    executeSkill,
    getProviders,
    getModels,
    getSkillCategories,
    healthCheck
  }
}
