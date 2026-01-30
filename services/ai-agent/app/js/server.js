/**
 * AI-Agent Server
 *
 * Express server with REST API and SSE streaming endpoints
 * Full conversation history and tool call support
 */

import http from 'node:http'
import express from 'express'
import bodyParser from 'body-parser'
import metrics from '@overleaf/metrics'
import logger from '@overleaf/logger'

import { CompletionController } from './Features/Completion/CompletionController.js'
import { SkillController } from './Features/Skills/SkillController.js'
import { SessionController } from './Features/Session/SessionController.js'
import { HealthController } from './Features/Health/HealthController.js'
import { ProjectController } from './Features/Project/ProjectController.js'
import { MCPController } from './Features/MCP/MCPController.js'
import { getMCPClient } from './Infrastructure/MCP/MCPClient.js'

logger.initialize('ai-agent')
metrics.open_sockets.monitor()
metrics.leaked_sockets.monitor(logger)

export async function createServer() {
  const app = express()

  // Middleware
  app.use(metrics.http.monitor(logger))
  app.use(bodyParser.json({ limit: '5mb' }))

  // Metrics endpoint
  metrics.injectMetricsRoute(app)

  // Health check endpoints
  app.get('/health', HealthController.check)
  app.get('/status', HealthController.status)

  // Completion endpoints
  app.post('/project/:projectId/agent/message', CompletionController.sendMessage)
  app.post('/project/:projectId/agent/tool-results', CompletionController.submitToolResults)
  app.get('/project/:projectId/agent/stream', CompletionController.stream)
  app.get('/project/:projectId/agent/stream-agentic', CompletionController.streamAgentic)
  app.post('/project/:projectId/agent/quick-edit', CompletionController.quickEdit)

  // Session endpoints (basic CRUD)
  app.get('/project/:projectId/agent/session', SessionController.getSession)
  app.post('/project/:projectId/agent/session', SessionController.createSession)
  app.delete('/project/:projectId/agent/session', SessionController.deleteSession)
  app.get('/project/:projectId/agent/sessions', SessionController.listSessions)

  // Session detail endpoints (conversation history, tool calls)
  app.get('/project/:projectId/agent/session/:sessionId/history', SessionController.getConversationHistory)
  app.get('/project/:projectId/agent/session/:sessionId/tool-calls', SessionController.getToolCalls)
  app.get('/project/:projectId/agent/session/:sessionId/export', SessionController.exportSession)
  app.get('/project/:projectId/agent/session/:sessionId/search', SessionController.searchMessages)
  app.patch('/project/:projectId/agent/session/:sessionId', SessionController.updateSession)

  // User stats endpoint
  app.get('/agent/user/stats', SessionController.getUserStats)

  // Skill endpoints (160+ K-Dense Scientific Skills)
  app.get('/project/:projectId/agent/skills', SkillController.listSkills)
  app.get('/project/:projectId/agent/skills/search', SkillController.searchSkills)
  app.get('/project/:projectId/agent/skill/:skillId', SkillController.getSkill)
  app.get('/project/:projectId/agent/skill/:skillId/reference/:refName', SkillController.getSkillReference)
  app.post('/project/:projectId/agent/skill/:skillId/execute', SkillController.executeSkill)
  app.get('/agent/skills/categories', SkillController.getCategories)

  // Project File Bridge endpoints (AI ↔ Overleaf Files)
  app.get('/project/:projectId/agent/files', ProjectController.listFiles)
  app.get('/project/:projectId/agent/docs', ProjectController.getAllDocs)
  app.get('/project/:projectId/agent/doc/:docId', ProjectController.getDoc)
  app.post('/project/:projectId/agent/doc', ProjectController.upsertDoc)
  app.put('/project/:projectId/agent/doc/:docId', ProjectController.updateDoc)
  app.post('/project/:projectId/agent/file', ProjectController.uploadFile)
  app.post('/project/:projectId/agent/folder', ProjectController.createFolder)
  app.delete('/project/:projectId/agent/entity/:entityId', ProjectController.deleteEntity)
  app.get('/project/:projectId/agent/structure', ProjectController.getStructure)

  // Model/Provider endpoints
  app.get('/agent/providers', CompletionController.getProviders)
  app.get('/agent/models', CompletionController.getModels)

  // MCP endpoints (claude-skills-mcp integration)
  app.get('/agent/mcp/status', MCPController.getStatus)
  app.get('/agent/mcp/tools', MCPController.listTools)
  app.post('/agent/mcp/execute', MCPController.executeTool)
  app.get('/agent/mcp/search', MCPController.searchSkills)

  // 404 Handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  // Error Handler
  app.use((err, req, res, next) => {
    logger.error({ err, path: req.path }, 'Request error')
    res.status(500).json({ error: 'Internal server error' })
  })

  const server = http.createServer(app)

  return { app, server }
}
