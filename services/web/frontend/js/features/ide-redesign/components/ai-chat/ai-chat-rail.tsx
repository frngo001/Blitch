/**
 * AI Chat Rail Component - ChatGPT/Claude Style
 *
 * Features:
 * - Streaming responses
 * - Tool calling visualization (expandable)
 * - Agent thinking/reasoning display
 * - Model selection
 */

import React, { useEffect, useState, useCallback, useRef, ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjectContext } from '@/shared/context/project-context'
import { useRailContext } from '../../contexts/rail-context'
import MaterialIcon from '@/shared/components/material-icon'
import getMeta from '@/utils/meta'
import classNames from 'classnames'
import { MarkdownRenderer } from './markdown-renderer'
import { ChatHistoryModal } from '@/features/ai-chat/components/chat-history-modal'
import { DiffPreviewModal } from '@/features/ai-chat/components/diff-preview-modal'
import { InlineEditPopover, useInlineEditPopover } from '@/features/ai-chat/components/inline-edit-popover'
import { useDiffPreview } from '@/features/ai-chat/hooks/useDiffPreview'
// EnhancedChatInput removed - using custom input area
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

type FileAttachment = {
  id: string
  name: string
  type: string
  size: number
  data: string // base64
  preview?: string // for images
}

type AIMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  attachments?: FileAttachment[]
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
  const { togglePane } = useRailContext()

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
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Scroll state for scroll-down button
  const [showScrollDown, setShowScrollDown] = useState(false)

  // File attachment state
  const [attachments, setAttachments] = useState<FileAttachment[]>([])

  // Model selector dropdown state
  const [showModelSelector, setShowModelSelector] = useState(false)

  const aiAgentEnabled = getMeta('ol-aiAgentEnabled')

  // Get current model info
  const currentModel = Object.values(MODELS)
    .flat()
    .find(m => m.id === selectedModel) || MODELS.deepseek[0]

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

  // File handling functions
  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    Array.from(files).forEach(file => {
      // Max 10MB per file
      if (file.size > 10 * 1024 * 1024) {
        console.warn('File too large:', file.name)
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1]
        const attachment: FileAttachment = {
          id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64,
          preview: file.type.startsWith('image/') ? reader.result as string : undefined
        }
        setAttachments(prev => [...prev, attachment])
      }
      reader.readAsDataURL(file)
    })

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }, [])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const sendMessage = useCallback(async () => {
    if ((!inputValue.trim() && attachments.length === 0) || isStreaming || !projectId) return

    const userMessage: AIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setAttachments([]) // Clear attachments after adding to message
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

    // Include attachments as context
    if (userMessage.attachments && userMessage.attachments.length > 0) {
      params.set('attachments', JSON.stringify(userMessage.attachments.map(a => ({
        name: a.name,
        type: a.type,
        size: a.size,
        data: a.data
      }))))
    }

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
    <div className="ai-chat-rail">
      {/* Header - Minimal Icons Only */}
      <div className="ai-chat-rail-header">
        <div className="header-left">
          <button className="ai-chat-header-btn" onClick={clearChat} title="New chat">
            <MaterialIcon type="edit_square" />
          </button>
        </div>
        <div className="header-right">
          <button className="ai-chat-header-btn" onClick={() => setShowHistoryModal(true)} title="History">
            <MaterialIcon type="forum" />
          </button>
          <button className="ai-chat-header-btn" onClick={togglePane} title="Close">
            <MaterialIcon type="close" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="ai-chat-rail-messages" ref={messagesContainerRef}>
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

      {/* Input Area */}
      <div className="ai-chat-input-area">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.txt,.tex,.md,.json,.csv"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {/* Attachment Preview */}
        {attachments.length > 0 && (
          <div className="attachment-preview-area">
            {attachments.map(attachment => (
              <div key={attachment.id} className="attachment-preview-item">
                {attachment.preview ? (
                  <img src={attachment.preview} alt={attachment.name} className="attachment-thumbnail" />
                ) : (
                  <div className="attachment-icon">
                    <MaterialIcon type={
                      attachment.type.includes('pdf') ? 'picture_as_pdf' :
                      attachment.type.includes('text') ? 'description' :
                      'insert_drive_file'
                    } />
                  </div>
                )}
                <div className="attachment-info">
                  <span className="attachment-name">{attachment.name}</span>
                  <span className="attachment-size">{formatFileSize(attachment.size)}</span>
                </div>
                <button
                  className="attachment-remove"
                  onClick={() => removeAttachment(attachment.id)}
                  title={t('remove')}
                >
                  <MaterialIcon type="close" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Quick Action Pills */}
        <div className="quick-action-pills">
          <button className="quick-pill" onClick={() => setInputValue('Explain this: ')}>
            <MaterialIcon type="lightbulb" />
            <span>Explain</span>
          </button>
          <button className="quick-pill" onClick={() => setInputValue('Analyze this: ')}>
            <MaterialIcon type="search" />
            <span>Analyze</span>
          </button>
          <button className="quick-pill" onClick={() => setInputValue('Summarize this: ')}>
            <MaterialIcon type="summarize" />
            <span>Summarize</span>
          </button>
        </div>

        {/* Input Box */}
        <div className="chat-input-box">
          <textarea
            ref={inputRef}
            className="chat-textarea"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder={attachments.length > 0 ? "Add a message or send the file..." : "Ask about your LaTeX document..."}
            rows={1}
          />
          <div className="input-toolbar">
            <div className="toolbar-left">
              {/* Model Selector */}
              <div className="model-selector-wrapper">
                <button
                  className="model-selector-btn"
                  onClick={() => setShowModelSelector(!showModelSelector)}
                >
                  <span className="model-icon">{currentModel.icon}</span>
                  <span className="model-name">{currentModel.name}</span>
                  <MaterialIcon type="expand_more" />
                </button>
                {showModelSelector && (
                  <div className="model-dropdown">
                    {Object.entries(MODELS).map(([provider, models]) => (
                      <div key={provider} className="model-group">
                        <div className="model-group-label">{provider}</div>
                        {models.map(model => (
                          <button
                            key={model.id}
                            className={classNames('model-option', {
                              active: model.id === selectedModel
                            })}
                            onClick={() => {
                              setSelectedProvider(provider)
                              setSelectedModel(model.id)
                              setShowModelSelector(false)
                            }}
                          >
                            <span className="model-icon">{model.icon}</span>
                            <span className="model-name">{model.name}</span>
                            {model.tier === 'pro' && <span className="model-tier">PRO</span>}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="toolbar-right">
              {/* Attachment Button */}
              <button
                className="toolbar-btn attachment-btn"
                onClick={() => fileInputRef.current?.click()}
                title={t('attach_file') || 'Attach file'}
                disabled={isStreaming}
              >
                <MaterialIcon type="attach_file" />
              </button>
              <button
                className={classNames('send-btn', { active: inputValue.trim() || attachments.length > 0 })}
                onClick={isStreaming ? stopStreaming : sendMessage}
                disabled={(!inputValue.trim() && attachments.length === 0) && !isStreaming}
              >
                <MaterialIcon type={isStreaming ? 'stop' : 'arrow_upward'} />
              </button>
            </div>
          </div>
        </div>
      </div>

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

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (isUser) {
    return (
      <div className="ai-chat-message ai-chat-message-user">
        <div className="ai-chat-user-bubble">
          {/* Display attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="message-attachments">
              {message.attachments.map(attachment => (
                <div key={attachment.id} className="message-attachment-item">
                  {attachment.preview ? (
                    <img
                      src={attachment.preview}
                      alt={attachment.name}
                      className="message-attachment-thumb"
                    />
                  ) : (
                    <div className="message-attachment-icon">
                      <MaterialIcon type={
                        attachment.type.includes('pdf') ? 'picture_as_pdf' :
                        attachment.type.includes('text') ? 'description' :
                        'insert_drive_file'
                      } />
                    </div>
                  )}
                  <div className="message-attachment-info">
                    <span className="message-attachment-name">{attachment.name}</span>
                    <span className="message-attachment-size">{formatFileSize(attachment.size)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {message.content}
        </div>
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

// Chat Placeholder - Blitch Style
function ChatPlaceholder({ onQuickAction }: { onQuickAction: (text: string) => void }) {
  const [showPersonalize, setShowPersonalize] = useState(true)

  const quickActions = [
    { icon: 'lightbulb', label: 'Explain', prompt: 'Explain this: ' },
    { icon: 'search', label: 'Analyze', prompt: 'Analyze this: ' },
    { icon: 'summarize', label: 'Summarize', prompt: 'Summarize this: ' },
  ]

  return (
    <div className="ai-chat-placeholder">
      {/* Personalize Card */}
      {showPersonalize && (
        <div className="personalize-card">
          <button className="close-btn" onClick={() => setShowPersonalize(false)}>
            <MaterialIcon type="close" />
          </button>
          <div className="personalize-icon">
            <MaterialIcon type="gesture" />
          </div>
          <div className="personalize-content">
            <h3>Personalize</h3>
            <p>Teach Blitch your writing style and preferences.</p>
          </div>
        </div>
      )}

      {/* Teach Section */}
      <div className="teach-section">
        <h3>Your AI Scientific Writing Assistant</h3>
        <p>Blitch helps you write, edit and improve your LaTeX documents</p>
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
