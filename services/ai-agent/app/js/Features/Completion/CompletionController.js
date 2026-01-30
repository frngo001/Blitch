/**
 * Completion Controller
 *
 * Handles AI completion requests and streaming responses
 * Integrates with K-Dense Scientific Skills for enhanced capabilities
 * Fully persists conversation history including tool calls
 */

import logger from '@overleaf/logger'
import { getGateway } from '../../Infrastructure/LLMGateway/LLMGateway.js'
import { SessionManager } from '../Session/SessionManager.js'
import SkillLoader from '../../Infrastructure/Skills/SkillLoader.js'
import { getMCPClientSync } from '../../Infrastructure/MCP/MCPClient.js'
import { createAgenticHandler } from './AgenticLoopHandler.js'
import {
  convertToLLMFormat,
  getRecentMessages,
  MessageRole,
  StopReason
} from '../../Models/Message.js'

/**
 * Get MCP tools if available
 * @returns {Array} Tool definitions for LLM
 */
function getMCPTools() {
  const mcpClient = getMCPClientSync()
  if (!mcpClient || !mcpClient.isConnected()) {
    return []
  }
  return mcpClient.getToolDefinitions()
}

/**
 * Execute an MCP tool
 * @param {string} toolName - Name of the tool
 * @param {Object} toolInput - Tool input parameters
 * @returns {Object} Tool result
 */
async function executeMCPTool(toolName, toolInput) {
  const mcpClient = getMCPClientSync()
  if (!mcpClient || !mcpClient.isConnected()) {
    return { content: 'MCP server not connected', isError: true }
  }
  return mcpClient.callTool(toolName, toolInput)
}

export const CompletionController = {
  /**
   * Send a message to the AI agent
   * POST /project/:projectId/agent/message
   */
  async sendMessage(req, res) {
    try {
      const { projectId } = req.params
      const { message, sessionId, model, provider, context, tools } = req.body
      const userId = req.headers['x-user-id']

      if (!message) {
        return res.status(400).json({ error: 'Message is required' })
      }

      logger.info({
        projectId,
        userId,
        provider,
        model,
        messageLength: message.length,
        hasTools: !!tools
      }, 'Processing agent message')

      // Get or create session
      const session = await SessionManager.getOrCreateSession(projectId, userId, sessionId)

      // Add user message to session (persisted)
      const userMessage = await SessionManager.addUserMessage(
        session._id,
        message,
        context
      )

      // Auto-generate title from first message
      if (session.messages.length === 0) {
        await SessionManager.autoGenerateTitle(session._id, message)
      }

      // Get LLM gateway
      const gateway = getGateway()

      // Get MCP tools first (needed for system prompt)
      const mcpTools = getMCPTools()
      const hasMCPTools = mcpTools.length > 0
      logger.info({ mcpToolCount: mcpTools.length }, 'MCP tools available')

      // Build messages for LLM with skill context and history
      const llmMessages = buildLLMMessages(
        [...session.messages, userMessage],
        context,
        message,
        hasMCPTools
      )

      // Combine MCP tools with any additional tools
      const allTools = [...mcpTools]
      if (tools && Array.isArray(tools) && tools.length > 0) {
        allTools.push(...tools)
      }

      // Prepare request options - tools MUST be inside options for LLMGateway
      const requestOptions = {
        provider: provider || session.model_preference?.provider || 'deepseek',
        model: model || session.model_preference?.model || 'deepseek-chat',
        messages: llmMessages,
        options: {
          maxTokens: 4096,
          temperature: 0.7,
          ...(allTools.length > 0 && { tools: allTools })
        },
        userId,
        projectId
      }

      if (allTools.length > 0) {
        logger.info({ toolCount: allTools.length, toolNames: allTools.map(t => t.name) }, 'Sending tools to LLM')
      }

      // Execute completion
      const startTime = Date.now()
      const response = await gateway.complete(requestOptions)
      const latencyMs = Date.now() - startTime

      // Enhance response with additional metadata
      response.provider = requestOptions.provider
      response.latency_ms = latencyMs

      // Add assistant message to session (with tool calls if present)
      const assistantMessage = await SessionManager.addAssistantMessage(
        session._id,
        response
      )

      // Handle tool use if the model requested it
      if (response.stop_reason === StopReason.TOOL_USE && response.tool_calls) {
        logger.info({
          sessionId: session._id,
          toolCalls: response.tool_calls.length,
          toolNames: response.tool_calls.map(tc => tc.name)
        }, 'Model requested tool use')

        // Check if these are MCP tools we can auto-execute
        const mcpToolNames = mcpTools.map(t => t.name)
        const mcpToolCalls = response.tool_calls.filter(tc => mcpToolNames.includes(tc.name))

        if (mcpToolCalls.length > 0) {
          logger.info({ mcpToolCalls: mcpToolCalls.length }, 'Auto-executing MCP tools')

          // Execute MCP tools and get results
          const toolResults = []
          for (const tc of mcpToolCalls) {
            const result = await executeMCPTool(tc.name, tc.input)
            toolResults.push({
              tool_call_id: tc.id,
              tool_name: tc.name,
              content: result.content,
              is_error: result.isError
            })

            // Persist tool result to session
            await SessionManager.addToolResultMessage(
              session._id,
              tc.id,
              tc.name,
              result.content,
              result.isError
            )
          }

          // Continue conversation with tool results
          const updatedSession = await SessionManager.getSessionWithHistory(session._id, userId)
          const continuationMessages = buildLLMMessages(updatedSession.messages, context, '')

          const continuationResponse = await gateway.complete({
            ...requestOptions,
            messages: continuationMessages
          })
          continuationResponse.provider = requestOptions.provider
          continuationResponse.latency_ms = Date.now() - startTime

          const finalMessage = await SessionManager.addAssistantMessage(
            session._id,
            continuationResponse
          )

          return res.json({
            sessionId: session._id,
            message: finalMessage,
            usage: continuationResponse.usage,
            tool_results: toolResults
          })
        }

        // Return response indicating tool use is needed (for non-MCP tools)
        return res.json({
          sessionId: session._id,
          message: assistantMessage,
          usage: response.usage,
          requires_tool_results: true,
          tool_calls: response.tool_calls
        })
      }

      res.json({
        sessionId: session._id,
        message: assistantMessage,
        usage: response.usage
      })

    } catch (error) {
      logger.error({ error }, 'Completion failed')
      res.status(500).json({ error: 'Completion failed', details: error.message })
    }
  },

  /**
   * Submit tool results and continue conversation
   * POST /project/:projectId/agent/tool-results
   */
  async submitToolResults(req, res) {
    try {
      const { projectId } = req.params
      const { sessionId, toolResults } = req.body
      const userId = req.headers['x-user-id']

      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' })
      }

      if (!toolResults || !Array.isArray(toolResults)) {
        return res.status(400).json({ error: 'toolResults array is required' })
      }

      logger.info({
        projectId,
        userId,
        sessionId,
        toolResultsCount: toolResults.length
      }, 'Processing tool results')

      // Verify session exists and belongs to user
      const session = await SessionManager.getSession(sessionId, userId)
      if (!session) {
        return res.status(404).json({ error: 'Session not found' })
      }

      // Add each tool result to session
      for (const result of toolResults) {
        await SessionManager.addToolResultMessage(
          sessionId,
          result.tool_call_id,
          result.tool_name,
          result.content,
          result.is_error || false
        )
      }

      // Get updated session with all messages
      const updatedSession = await SessionManager.getSessionWithHistory(sessionId, userId)

      // Build messages for LLM continuation
      const llmMessages = buildLLMMessages(updatedSession.messages, null, '')

      // Get LLM gateway
      const gateway = getGateway()

      // Continue conversation after tool results
      const startTime = Date.now()
      const response = await gateway.complete({
        provider: session.model_preference?.provider || 'anthropic',
        model: session.model_preference?.model || 'claude-3-5-haiku',
        messages: llmMessages,
        options: {
          maxTokens: 4096,
          temperature: 0.7
        },
        userId,
        projectId
      })
      response.provider = session.model_preference?.provider || 'anthropic'
      response.latency_ms = Date.now() - startTime

      // Add assistant response
      const assistantMessage = await SessionManager.addAssistantMessage(
        sessionId,
        response
      )

      // Check if model wants more tools
      if (response.stop_reason === StopReason.TOOL_USE && response.tool_calls) {
        return res.json({
          sessionId,
          message: assistantMessage,
          usage: response.usage,
          requires_tool_results: true,
          tool_calls: response.tool_calls
        })
      }

      res.json({
        sessionId,
        message: assistantMessage,
        usage: response.usage
      })

    } catch (error) {
      logger.error({ error }, 'Tool results submission failed')
      res.status(500).json({ error: 'Tool results submission failed', details: error.message })
    }
  },

  /**
   * Stream AI response using Server-Sent Events
   * GET /project/:projectId/agent/stream
   */
  async stream(req, res) {
    const { projectId } = req.params
    const { message, sessionId, model, provider, context } = req.query
    const userId = req.headers['x-user-id']

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering

    try {
      if (!message) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: 'Message is required' })}\n\n`)
        return res.end()
      }

      logger.info({
        projectId,
        userId,
        provider,
        model
      }, 'Starting agent stream')

      // Get or create session
      const session = await SessionManager.getOrCreateSession(projectId, userId, sessionId)

      // Add user message (persisted)
      const parsedContext = context ? JSON.parse(context) : null
      const userMessage = await SessionManager.addUserMessage(
        session._id,
        message,
        parsedContext
      )

      // Auto-generate title from first message
      if (session.messages.length === 0) {
        await SessionManager.autoGenerateTitle(session._id, message)
      }

      // Get MCP tools first (needed for system prompt)
      const mcpTools = getMCPTools()
      const hasMCPTools = mcpTools.length > 0
      logger.info({ mcpToolCount: mcpTools.length }, 'MCP tools available for stream')

      // Get LLM gateway
      const gateway = getGateway()

      // Build messages for LLM with skill context
      const llmMessages = buildLLMMessages(
        [...session.messages, userMessage],
        parsedContext,
        message,
        hasMCPTools
      )

      // Start streaming
      let fullContent = ''
      let totalUsage = { input: 0, output: 0 }
      let toolCalls = []
      let stopReason = StopReason.END_TURN
      const startTime = Date.now()

      // Prepare stream options with MCP tools
      const streamOptions = {
        provider: provider || session.model_preference?.provider || 'deepseek',
        model: model || session.model_preference?.model || 'deepseek-chat',
        messages: llmMessages,
        options: {
          maxTokens: 4096,
          temperature: 0.7
        },
        userId,
        projectId
      }

      if (mcpTools.length > 0) {
        streamOptions.tools = mcpTools
      }

      for await (const chunk of gateway.stream(streamOptions)) {
        if (chunk.content) {
          fullContent += chunk.content
          res.write(`event: token\ndata: ${JSON.stringify({
            content: chunk.content,
            done: false
          })}\n\n`)
        }

        // Capture tool calls from stream
        if (chunk.tool_calls) {
          toolCalls = chunk.tool_calls
          res.write(`event: tool_use\ndata: ${JSON.stringify({
            tool_calls: chunk.tool_calls
          })}\n\n`)
        }

        if (chunk.done) {
          totalUsage = chunk.usage || totalUsage
          stopReason = chunk.stop_reason || StopReason.END_TURN

          res.write(`event: done\ndata: ${JSON.stringify({
            tokens_used: totalUsage,
            session_id: session._id.toString(),
            stop_reason: stopReason,
            has_tool_calls: toolCalls.length > 0
          })}\n\n`)
        }
      }

      const latencyMs = Date.now() - startTime

      // Save assistant message with full content and tool calls
      await SessionManager.addAssistantMessage(session._id, {
        content: fullContent,
        model: model || session.model_preference?.model,
        provider: provider || session.model_preference?.provider,
        usage: totalUsage,
        stop_reason: stopReason,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        latency_ms: latencyMs
      })

      res.end()

    } catch (error) {
      logger.error({ error }, 'Stream failed')
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Stream failed', details: error.message })}\n\n`)
      res.end()
    }
  },

  /**
   * Get available providers
   * GET /agent/providers
   */
  async getProviders(req, res) {
    try {
      const gateway = getGateway()
      const providers = gateway.getAvailableProviders()

      const providerInfo = providers.map(name => ({
        id: name,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        available: true,
        models: gateway.getModels(name)
      }))

      res.json({ providers: providerInfo })
    } catch (error) {
      logger.error({ error }, 'Failed to get providers')
      res.status(500).json({ error: 'Failed to get providers' })
    }
  },

  /**
   * Get available models (all or by provider)
   * GET /agent/models
   */
  async getModels(req, res) {
    try {
      const { provider } = req.query
      const gateway = getGateway()

      if (provider) {
        const models = gateway.getModels(provider)
        res.json({ provider, models })
      } else {
        const models = gateway.getAllModels()
        res.json({ models })
      }
    } catch (error) {
      logger.error({ error }, 'Failed to get models')
      res.status(500).json({ error: 'Failed to get models' })
    }
  },

  /**
   * Quick edit - fast AI edit for inline CMD+K functionality
   * POST /project/:projectId/agent/quick-edit
   */
  async quickEdit(req, res) {
    try {
      const { projectId } = req.params
      const { prompt, selectedText, context } = req.body
      const userId = req.headers['x-user-id']

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' })
      }

      logger.info({
        projectId,
        userId,
        promptLength: prompt.length,
        selectedTextLength: selectedText?.length || 0
      }, 'Processing quick edit request')

      const gateway = getGateway()

      // Build a focused system prompt for quick edits
      const systemPrompt = `You are a LaTeX editing assistant specialized in scientific writing.

IMPORTANT RULES:
1. Return ONLY the modified text - no explanations, no markdown code blocks
2. Preserve the original formatting and style unless asked to change it
3. Keep the same level of technical detail
4. Maintain any LaTeX commands and environments
5. Be concise and direct in your modifications

${selectedText ? `The user has selected the following text to modify:
---
${selectedText}
---` : 'No text was selected. Generate new content based on the prompt.'}`

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]

      const startTime = Date.now()
      const response = await gateway.complete({
        provider: 'deepseek',
        model: 'deepseek-chat',
        messages,
        options: {
          maxTokens: 2048,
          temperature: 0.3 // Lower temperature for more deterministic edits
        },
        userId,
        projectId
      })
      const latencyMs = Date.now() - startTime

      logger.info({
        projectId,
        latencyMs,
        outputLength: response.content?.length || 0
      }, 'Quick edit completed')

      res.json({
        content: response.content,
        usage: response.usage,
        latency_ms: latencyMs
      })

    } catch (error) {
      logger.error({ error }, 'Quick edit failed')
      res.status(500).json({ error: 'Quick edit failed', details: error.message })
    }
  },

  /**
   * Stream with agentic loop support
   * GET /project/:projectId/agent/stream-agentic
   *
   * This endpoint automatically executes tools and continues the conversation
   */
  async streamAgentic(req, res) {
    const { projectId } = req.params
    const { message, sessionId, model, provider, context } = req.query
    const userId = req.headers['x-user-id']

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    try {
      if (!message) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: 'Message is required' })}\n\n`)
        return res.end()
      }

      logger.info({
        projectId,
        userId,
        provider,
        model
      }, 'Starting agentic stream')

      // Get or create session
      const session = await SessionManager.getOrCreateSession(projectId, userId, sessionId)

      // Add user message
      const parsedContext = context ? JSON.parse(context) : null
      const userMessage = await SessionManager.addUserMessage(
        session._id,
        message,
        parsedContext
      )

      // Auto-generate title from first message
      if (session.messages.length === 0) {
        await SessionManager.autoGenerateTitle(session._id, message)
      }

      // Get all available tools (MCP + built-in)
      const mcpTools = getMCPTools()
      const hasMCPTools = mcpTools.length > 0
      const allTools = [...mcpTools]

      // Build messages for LLM
      const llmMessages = buildLLMMessages(
        [...session.messages, userMessage],
        parsedContext,
        message,
        hasMCPTools
      )

      // Create agentic handler
      const agenticHandler = createAgenticHandler({
        maxIterations: 10
      })

      // Get LLM gateway
      const gateway = getGateway()

      // Prepare request options
      const requestOptions = {
        provider: provider || session.model_preference?.provider || 'deepseek',
        model: model || session.model_preference?.model || 'deepseek-chat',
        messages: llmMessages,
        options: {
          maxTokens: 4096,
          temperature: 0.7
        },
        tools: allTools.length > 0 ? allTools : undefined,
        userId,
        projectId
      }

      // Event emitter for SSE
      const emitEvent = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      }

      // Execute agentic loop
      const startTime = Date.now()
      const finalResponse = await agenticHandler.executeLoop(
        session,
        gateway,
        requestOptions,
        emitEvent,
        (msgs) => buildLLMMessages(msgs, parsedContext, '', hasMCPTools)
      )

      const latencyMs = Date.now() - startTime

      // Send final done event
      res.write(`event: done\ndata: ${JSON.stringify({
        tokens_used: finalResponse.usage || { input: 0, output: 0 },
        session_id: session._id.toString(),
        stop_reason: finalResponse.stop_reason || 'end_turn',
        latency_ms: latencyMs
      })}\n\n`)

      res.end()

    } catch (error) {
      logger.error({ error }, 'Agentic stream failed')
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Agentic stream failed', details: error.message })}\n\n`)
      res.end()
    }
  }
}

/**
 * Build LLM messages from session history with skill context
 * Supports full message history including tool calls and results
 */
function buildLLMMessages(sessionMessages, context, userQuery = '', hasMCPTools = false) {
  const messages = []

  // Get the base system prompt with skill context
  const systemPrompt = SkillLoader.getAgentSystemPrompt(userQuery)

  // Add document context if available
  let fullSystemPrompt = systemPrompt

  // Add MCP tool instructions if tools are available
  if (hasMCPTools) {
    fullSystemPrompt += `

## IMPORTANT: Available Tools

You have access to the following MCP tools that you MUST use:

### 1. find_helpful_skills
**ALWAYS call this tool FIRST** for any task requiring domain-specific knowledge.
- Use it to search for relevant skills, scripts, and best practices
- It performs semantic search over 160+ scientific skills
- Returns ranked results with step-by-step guidance

### 2. read_skill_document
After finding a relevant skill, use this to read scripts, templates, and references.

### 3. list_skills
Lists all available skills for exploration.

## Tool Usage Rules

1. **ALWAYS start with find_helpful_skills** before answering domain-specific questions
2. When a user asks about literature review, data analysis, LaTeX, or any scientific task:
   - First call \`find_helpful_skills\` with a description of the task
   - Read the relevant skill documents using \`read_skill_document\`
   - Then provide your answer based on the skill content
3. Do NOT answer from memory alone - use the tools to get current, accurate information
4. The tools contain Python scripts, templates, and workflows that you should reference`
  }

  if (context?.selection) {
    fullSystemPrompt += `\n\n## Current Document Context

**File:** ${context.doc_name || 'Unknown'}
**Selected text (lines ${context.selection.start_line}-${context.selection.end_line}):**
\`\`\`latex
${context.selection.text}
\`\`\`

When editing this selection, provide the improved LaTeX code directly.`
  }

  if (context?.doc_content) {
    fullSystemPrompt += `\n\n## Full Document Content (truncated)

\`\`\`latex
${context.doc_content.substring(0, 3000)}${context.doc_content.length > 3000 ? '\n... (truncated)' : ''}
\`\`\``
  }

  messages.push({ role: 'system', content: fullSystemPrompt })

  // Get recent messages (last 20 to avoid context overflow)
  const recentMessages = getRecentMessages(sessionMessages, 20)

  // Convert session messages to LLM format (handles tool calls/results)
  for (const msg of recentMessages) {
    if (msg.role === MessageRole.USER) {
      messages.push({
        role: 'user',
        content: msg.content
      })
    } else if (msg.role === MessageRole.ASSISTANT) {
      // Handle assistant messages with potential tool calls
      const content = []

      // Add text content if present
      if (msg.content) {
        content.push({
          type: 'text',
          text: msg.content
        })
      }

      // Add tool use blocks if present
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.input
          })
        }
      }

      // Use simple string content if no tool calls
      if (content.length === 1 && content[0].type === 'text') {
        messages.push({
          role: 'assistant',
          content: content[0].text
        })
      } else if (content.length > 0) {
        messages.push({
          role: 'assistant',
          content: content
        })
      }
    } else if (msg.role === MessageRole.TOOL) {
      // Tool results are sent as user messages with tool_result content
      messages.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: msg.tool_call_id,
          content: msg.content,
          is_error: msg.is_error || false
        }]
      })
    }
  }

  return messages
}
