/**
 * AI Chat Rail Component - ChatGPT/Claude Style
 *
 * Features:
 * - Streaming responses
 * - Tool calling visualization (expandable)
 * - Agent thinking/reasoning display
 * - Model selection
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjectContext } from '@/shared/context/project-context'
import MaterialIcon from '@/shared/components/material-icon'
import getMeta from '@/utils/meta'
import classNames from 'classnames'
import { MarkdownRenderer } from './markdown-renderer'
import { ChatHistoryModal } from '@/features/ai-chat/components/chat-history-modal'
import { DiffPreviewModal } from '@/features/ai-chat/components/diff-preview-modal'
import { InlineEditPopover, useInlineEditPopover } from '@/features/ai-chat/components/inline-edit-popover'
import { useDiffPreview } from '@/features/ai-chat/hooks/useDiffPreview'
import { EnhancedChatInput, type EnhancedChatInputRef } from '@/features/ai-chat/components/enhanced-chat-input'
import { getJSON } from '@/infrastructure/fetch-json'

// Types
type ToolCall = {
  id: string
  name: string
  input: Record<string, unknown>
  output?: string
  status: 'pending' | 'running' | 'completed' | 'error'
}

type ThinkingBlock = {
  id: string
  content: string
}

type AIMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  thinking?: ThinkingBlock[]
  toolCalls?: ToolCall[]
  metadata?: {
    model_used?: string
    tokens_used?: { input: number; output: number }
    duration_ms?: number
  }
}

// Available models
const MODELS = {
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek V3', tier: 'free', icon: '🔮' },
    { id: 'deepseek-reasoner', name: 'DeepSeek R1', tier: 'pro', icon: '🧠' },
  ],
  anthropic: [
    { id: 'claude-3-5-haiku', name: 'Haiku 3.5', tier: 'free', icon: '⚡' },
    { id: 'claude-3-5-sonnet', name: 'Sonnet 3.5', tier: 'pro', icon: '✨' },
    { id: 'claude-sonnet-4', name: 'Sonnet 4', tier: 'pro', icon: '🌟' },
  ],
  ollama: [
    { id: 'llama3.2', name: 'Llama 3.2', tier: 'free', icon: '🦙' },
    { id: 'qwen2.5', name: 'Qwen 2.5', tier: 'free', icon: '🌊' },
  ],
}

export function AIChatPane() {
  const { t } = useTranslation()
  const { projectId } = useProjectContext()

  const [messages, setMessages] = useState<AIMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState<Partial<AIMessage> | null>(null)
  const [selectedProvider, setSelectedProvider] = useState('deepseek')
  const [selectedModel, setSelectedModel] = useState('deepseek-chat')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)

  // Diff Preview state
  const {
    showModal: showDiffModal,
    originalContent,
    proposedContent,
    selectionRange,
    openDiffPreview,
    closeDiffPreview,
    applyChanges,
    isApplying
  } = useDiffPreview()

  // Inline Edit Popover state (CMD+K)
  const {
    isOpen: isInlineEditOpen,
    position: inlineEditPosition,
    selectedText: inlineEditSelectedText,
    editorView: inlineEditEditorView,
    close: closeInlineEdit
  } = useInlineEditPopover(projectId)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<EnhancedChatInputRef>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Scroll state for scroll-down button
  const [showScrollDown, setShowScrollDown] = useState(false)

  // Transform MODELS to flat array for EnhancedChatInput
  const availableModels = useMemo(() => {
    const models: Array<{
      id: string
      name: string
      provider: string
      icon: string
      tier: 'free' | 'pro' | 'enterprise'
    }> = []
    Object.entries(MODELS).forEach(([provider, providerModels]) => {
      providerModels.forEach(model => {
        models.push({
          id: model.id,
          name: model.name,
          provider,
          icon: model.icon,
          tier: model.tier === 'pro' ? 'pro' : 'free'
        })
      })
    })
    return models
  }, [])

  // Current selected model object
  const currentModelObj = useMemo(() => {
    return availableModels.find(m => m.id === selectedModel) || availableModels[0]
  }, [availableModels, selectedModel])

  const aiAgentEnabled = getMeta('ol-aiAgentEnabled')

  // Auto-scroll
  useEffect(() => {
    if (!showScrollDown) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingMessage, showScrollDown])

  // Scroll detection for scroll-down button
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
      setShowScrollDown(!isNearBottom)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setShowScrollDown(false)
  }, [])

  // Handle model change from EnhancedChatInput
  const handleModelChange = useCallback((model: { id: string; provider: string }) => {
    setSelectedProvider(model.provider)
    setSelectedModel(model.id)
  }, [])

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || isStreaming || !projectId) return

    const userMessage: AIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsStreaming(true)
    setStreamingMessage({
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      thinking: [],
      toolCalls: [],
    })

    // Build URL
    const params = new URLSearchParams()
    params.set('message', userMessage.content)
    if (sessionId) params.set('sessionId', sessionId)
    params.set('provider', selectedProvider)
    params.set('model', selectedModel)

    const url = `/project/${projectId}/agent/stream/proxy?${params.toString()}`

    try {
      const eventSource = new EventSource(url)
      eventSourceRef.current = eventSource

      let content = ''
      let thinking: ThinkingBlock[] = []
      let toolCalls: ToolCall[] = []

      eventSource.addEventListener('thinking', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          thinking = [...thinking, {
            id: `thinking-${Date.now()}`,
            content: data.content,
          }]
          setStreamingMessage(prev => prev ? { ...prev, thinking } : null)
        } catch (e) {
          console.error('Parse thinking error:', e)
        }
      })

      eventSource.addEventListener('tool_start', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          toolCalls = [...toolCalls, {
            id: data.id || `tool-${Date.now()}`,
            name: data.name,
            input: data.input || {},
            status: 'running',
          }]
          setStreamingMessage(prev => prev ? { ...prev, toolCalls } : null)
        } catch (e) {
          console.error('Parse tool_start error:', e)
        }
      })

      eventSource.addEventListener('tool_end', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          toolCalls = toolCalls.map(tc =>
            tc.id === data.id || tc.name === data.name
              ? { ...tc, status: 'completed' as const, output: data.output }
              : tc
          )
          setStreamingMessage(prev => prev ? { ...prev, toolCalls } : null)
        } catch (e) {
          console.error('Parse tool_end error:', e)
        }
      })

      eventSource.addEventListener('token', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          if (data.content) {
            content += data.content
            setStreamingMessage(prev => prev ? { ...prev, content } : null)
          }
        } catch (e) {
          console.error('Parse token error:', e)
        }
      })

      eventSource.addEventListener('done', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)

          const assistantMessage: AIMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content,
            timestamp: new Date(),
            thinking: thinking.length > 0 ? thinking : undefined,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            metadata: {
              tokens_used: data.tokens_used,
              model_used: selectedModel,
              duration_ms: data.duration_ms,
            },
          }

          setMessages(prev => [...prev, assistantMessage])
          setStreamingMessage(null)
          setIsStreaming(false)

          if (data.session_id && !sessionId) {
            setSessionId(data.session_id)
          }

          eventSource.close()
          eventSourceRef.current = null
        } catch (e) {
          console.error('Parse done error:', e)
        }
      })

      eventSource.addEventListener('error', () => {
        if (content) {
          const assistantMessage: AIMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: content + '\n\n_(Stream interrupted)_',
            timestamp: new Date(),
            thinking: thinking.length > 0 ? thinking : undefined,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          }
          setMessages(prev => [...prev, assistantMessage])
        }
        setStreamingMessage(null)
        setIsStreaming(false)
        eventSource.close()
        eventSourceRef.current = null
      })

    } catch (error) {
      console.error('Stream error:', error)
      setIsStreaming(false)
      setStreamingMessage(null)
    }
  }, [inputValue, isStreaming, projectId, sessionId, selectedProvider, selectedModel])

  const handleCopy = useCallback(async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedMessageId(messageId)
      setTimeout(() => setCopiedMessageId(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }, [])

  const handleApply = useCallback((content: string) => {
    openDiffPreview(content)
  }, [openDiffPreview])

  const handleLoadSession = useCallback(async (loadSessionId: string) => {
    if (!projectId) return

    try {
      const response = await getJSON(`/project/${projectId}/agent/session/${loadSessionId}/history`)
      const loadedMessages = (response.messages || []).map((msg: any) => ({
        id: msg.id || `msg-${Date.now()}-${Math.random()}`,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        thinking: msg.thinking,
        toolCalls: msg.tool_calls?.map((tc: any) => ({
          id: tc.id,
          name: tc.name,
          input: tc.input,
          output: tc.output,
          status: tc.status || 'completed'
        })),
        metadata: msg.metadata
      }))
      setMessages(loadedMessages)
      setSessionId(loadSessionId)
      setStreamingMessage(null)

      // Update model preference if session has one
      if (response.model_preference) {
        if (response.model_preference.provider) {
          setSelectedProvider(response.model_preference.provider)
        }
        if (response.model_preference.model) {
          setSelectedModel(response.model_preference.model)
        }
      }
    } catch (error) {
      console.error('Failed to load session:', error)
    }
  }, [projectId])

  const clearChat = () => {
    setMessages([])
    setSessionId(null)
    setStreamingMessage(null)
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }

  const stopStreaming = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (streamingMessage?.content) {
      const msg: AIMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: streamingMessage.content + '\n\n_(Stopped)_',
        timestamp: new Date(),
        thinking: streamingMessage.thinking,
        toolCalls: streamingMessage.toolCalls,
      }
      setMessages(prev => [...prev, msg])
    }
    setIsStreaming(false)
    setStreamingMessage(null)
  }

  if (!aiAgentEnabled) {
    return (
      <div className="ai-chat-disabled">
        <MaterialIcon type="smart_toy" />
        <h4>{t('ai_agent_not_enabled') || 'AI Agent Not Enabled'}</h4>
        <p>{t('contact_admin') || 'Contact your administrator to enable this feature.'}</p>
      </div>
    )
  }

  return (
    <div className="ai-chat-container">
      {/* Header */}
      <div className="ai-chat-header">
        <div className="ai-chat-header-title">
          <MaterialIcon type="smart_toy" />
          <span>{t('ai_assistant') || 'AI Assistant'}</span>
        </div>
        <div className="ai-chat-header-actions">
          <button
            className="ai-chat-icon-btn"
            onClick={() => setShowHistoryModal(true)}
            title={t('chat_history') || 'Chat history'}
          >
            <MaterialIcon type="history" />
          </button>
          <button
            className="ai-chat-icon-btn"
            onClick={clearChat}
            title={t('new_chat') || 'New chat'}
          >
            <MaterialIcon type="add" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="ai-chat-messages" ref={messagesContainerRef}>
        {messages.length === 0 && !streamingMessage ? (
          <ChatPlaceholder onQuickAction={(text) => {
            setInputValue(text)
            inputRef.current?.focus()
          }} />
        ) : (
          <>
            {messages.map(msg => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onCopy={(content) => handleCopy(msg.id, content)}
                onApply={handleApply}
                isCopied={copiedMessageId === msg.id}
              />
            ))}

            {/* Streaming message with shimmer */}
            {streamingMessage && (
              <MessageBubble
                message={streamingMessage as AIMessage}
                isStreaming
              />
            )}

            {/* Loading shimmer when waiting for first token */}
            {isStreaming && !streamingMessage?.content && (
              <ShimmerLoader />
            )}

            <div ref={messagesEndRef} />
          </>
        )}

        {/* Scroll down button */}
        {showScrollDown && (
          <button
            className="ai-chat-scroll-down-btn"
            onClick={scrollToBottom}
            title={t('scroll_to_bottom') || 'Scroll to bottom'}
          >
            <MaterialIcon type="keyboard_arrow_down" />
          </button>
        )}
      </div>

      {/* Enhanced Input */}
      <EnhancedChatInput
        ref={inputRef}
        value={inputValue}
        onChange={setInputValue}
        onSubmit={sendMessage}
        onStop={stopStreaming}
        isStreaming={isStreaming}
        placeholder={t('ask_ai_placeholder') || 'Ask about your document, LaTeX, or scientific writing...'}
        selectedModel={currentModelObj}
        onModelChange={handleModelChange}
        availableModels={availableModels}
      />

      {/* Chat History Modal */}
      <ChatHistoryModal
        show={showHistoryModal}
        onHide={() => setShowHistoryModal(false)}
        onLoadSession={handleLoadSession}
        projectId={projectId}
        currentSessionId={sessionId}
      />

      {/* Diff Preview Modal */}
      <DiffPreviewModal
        show={showDiffModal}
        onHide={closeDiffPreview}
        originalContent={originalContent}
        proposedContent={proposedContent}
        onApply={applyChanges}
        isApplying={isApplying}
        selectionRange={selectionRange || undefined}
      />

      {/* Inline Edit Popover (CMD+K) */}
      {isInlineEditOpen && inlineEditPosition && (
        <InlineEditPopover
          projectId={projectId}
          onClose={closeInlineEdit}
          onApply={(content) => {
            openDiffPreview(content)
            closeInlineEdit()
          }}
          position={inlineEditPosition}
          selectedText={inlineEditSelectedText}
          editorView={inlineEditEditorView}
        />
      )}
    </div>
  )
}

// Message Bubble Component
type MessageBubbleProps = {
  message: AIMessage
  isStreaming?: boolean
  onCopy?: (content: string) => void
  onApply?: (content: string) => void
  isCopied?: boolean
}

function MessageBubble({ message, isStreaming, onCopy, onApply, isCopied }: MessageBubbleProps) {
  const { t } = useTranslation()
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="ai-chat-message ai-chat-message-user">
        <div className="ai-chat-user-bubble">{message.content}</div>
      </div>
    )
  }

  return (
    <div className="ai-chat-message ai-chat-message-assistant">
      {/* Thinking blocks */}
      {message.thinking && message.thinking.length > 0 && (
        <ThinkingSection blocks={message.thinking} />
      )}

      {/* Tool calls */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <ToolCallsSection toolCalls={message.toolCalls} />
      )}

      {/* Content - Now with Markdown rendering! */}
      {message.content && (
        <div className={classNames('ai-chat-assistant-content', { 'is-streaming': isStreaming })}>
          <MarkdownRenderer content={message.content} />
        </div>
      )}

      {/* Action Buttons (only for assistant messages, not streaming) */}
      {!isStreaming && message.content && (
        <div className="ai-chat-message-actions">
          <button
            className="ai-chat-action-btn"
            onClick={() => onCopy?.(message.content)}
            title={t('copy', 'Copy')}
          >
            <MaterialIcon type={isCopied ? 'check' : 'content_copy'} />
            <span>{isCopied ? t('copied', 'Copied!') : t('copy', 'Copy')}</span>
          </button>
          <button
            className="ai-chat-action-btn ai-chat-action-btn-primary"
            onClick={() => onApply?.(message.content)}
            title={t('apply_to_document', 'Apply to document')}
          >
            <MaterialIcon type="difference" />
            <span>{t('preview_apply', 'Preview & Apply')}</span>
          </button>
        </div>
      )}

      {/* Metadata */}
      {message.metadata && !isStreaming && (
        <div className="ai-chat-message-meta">
          {message.metadata.model_used && <span>{message.metadata.model_used}</span>}
          {message.metadata.tokens_used && (
            <span>{message.metadata.tokens_used.input + message.metadata.tokens_used.output} tokens</span>
          )}
          {message.metadata.duration_ms && (
            <span>{(message.metadata.duration_ms / 1000).toFixed(1)}s</span>
          )}
        </div>
      )}
    </div>
  )
}

// Thinking Section
function ThinkingSection({ blocks }: { blocks: ThinkingBlock[] }) {
  const [expanded, setExpanded] = useState(false)
  const { t } = useTranslation()

  return (
    <div className="ai-chat-thinking-block">
      <div
        className="ai-chat-thinking-header"
        onClick={() => setExpanded(!expanded)}
      >
        <MaterialIcon
          type="chevron_right"
          className={classNames('ai-chat-chevron', { expanded })}
        />
        <span className="ai-chat-thinking-label">
          💭 {t('thinking') || 'Thinking'}
        </span>
        <span className="ai-chat-thinking-count">
          {blocks.length} {blocks.length > 1 ? 'steps' : 'step'}
        </span>
      </div>
      {expanded && (
        <div className="ai-chat-thinking-content">
          {blocks.map((block, i) => (
            <div key={block.id} style={{ marginBottom: i < blocks.length - 1 ? '12px' : 0 }}>
              {block.content}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Tool Calls Section
function ToolCallsSection({ toolCalls }: { toolCalls: ToolCall[] }) {
  return (
    <div>
      {toolCalls.map(tool => (
        <ToolCallBlock key={tool.id} tool={tool} />
      ))}
    </div>
  )
}

function ToolCallBlock({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false)

  const statusIcons: Record<string, string> = {
    pending: 'schedule',
    running: 'sync',
    completed: 'check_circle',
    error: 'error',
  }

  return (
    <div className="ai-chat-tool-block">
      <div
        className="ai-chat-tool-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="ai-chat-tool-name">
          <MaterialIcon
            type="chevron_right"
            className={classNames('ai-chat-chevron', { expanded })}
          />
          <MaterialIcon type="build" />
          <span>{tool.name}</span>
        </div>
        <div className={classNames('ai-chat-tool-status', tool.status)}>
          <MaterialIcon type={statusIcons[tool.status]} />
          <span>{tool.status}</span>
        </div>
      </div>
      {expanded && (
        <div className="ai-chat-tool-content">
          <div className="ai-chat-tool-input-label">Input:</div>
          <pre>{JSON.stringify(tool.input, null, 2)}</pre>
          {tool.output && (
            <>
              <div className="ai-chat-tool-output-label">Output:</div>
              <pre>{tool.output}</pre>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// Chat Placeholder
function ChatPlaceholder({ onQuickAction }: { onQuickAction: (text: string) => void }) {
  const { t } = useTranslation()

  const quickActions = [
    { icon: '✏️', label: t('improve_text') || 'Improve text', prompt: 'Improve this text: ' },
    { icon: '📊', label: t('generate_table') || 'Create table', prompt: 'Create a LaTeX table for: ' },
    { icon: '📐', label: t('write_equation') || 'Write equation', prompt: 'Write an equation for: ' },
    { icon: '📚', label: t('add_citations') || 'Add citations', prompt: 'Find citations for: ' },
  ]

  return (
    <div className="ai-chat-placeholder">
      <div className="ai-chat-placeholder-icon">
        <MaterialIcon type="smart_toy" />
      </div>
      <h3 className="ai-chat-placeholder-title">
        {t('ai_assistant') || 'AI Scientific Assistant'}
      </h3>
      <p className="ai-chat-placeholder-desc">
        {t('ai_assistant_help') || 'I can help with scientific writing, LaTeX, equations, tables, and research.'}
      </p>
      <div className="ai-chat-quick-actions">
        {quickActions.map(action => (
          <button
            key={action.label}
            className="ai-chat-quick-action"
            onClick={() => onQuickAction(action.prompt)}
          >
            <span className="icon">{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// Shimmer Loader Component - Beautiful loading animation
function ShimmerLoader() {
  const { t } = useTranslation()

  return (
    <div className="ai-chat-message ai-chat-message-assistant">
      {/* Typing Indicator with Shimmer Text */}
      <div className="ai-chat-typing-indicator">
        <div className="ai-chat-typing-dots">
          <span className="ai-chat-typing-dot" />
          <span className="ai-chat-typing-dot" />
          <span className="ai-chat-typing-dot" />
        </div>
        <span className="ai-chat-typing-text">
          {t('ai_thinking', 'AI is thinking...')}
        </span>
      </div>

      {/* Shimmer Lines */}
      <div className="ai-chat-shimmer-container">
        <div className="ai-chat-shimmer-content">
          <div className="ai-chat-shimmer-line ai-chat-shimmer-line-1" />
          <div className="ai-chat-shimmer-line ai-chat-shimmer-line-2" />
          <div className="ai-chat-shimmer-line ai-chat-shimmer-line-3" />
        </div>
      </div>
    </div>
  )
}

// Indicator for unread messages
export function AIChatIndicator() {
  return null
}
