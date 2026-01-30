/**
 * AI Chat Messages
 *
 * Displays the conversation history with the AI agent
 */

import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AIMessage } from '../context/ai-chat-context'
import MaterialIcon from '@/shared/components/material-icon'

type Props = {
  messages: AIMessage[]
  streamingContent: string
  isStreaming: boolean
}

export default function AIChatMessages({
  messages,
  streamingContent,
  isStreaming,
}: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  return (
    <div className="ai-chat-messages">
      {messages.map(message => (
        <AIChatMessage key={message.id} message={message} />
      ))}

      {isStreaming && streamingContent && (
        <div className="ai-chat-message ai-chat-message-assistant streaming">
          <div className="ai-chat-message-avatar">
            <MaterialIcon type="smart_toy" />
          </div>
          <div className="ai-chat-message-content">
            <div className="ai-chat-message-text">{streamingContent}</div>
            <div className="ai-chat-streaming-indicator">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}

function AIChatMessage({ message }: { message: AIMessage }) {
  const { t } = useTranslation()
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  return (
    <div
      className={`ai-chat-message ai-chat-message-${message.role} ${
        message.pending ? 'pending' : ''
      }`}
    >
      <div className="ai-chat-message-avatar">
        {isUser ? (
          <MaterialIcon type="person" />
        ) : (
          <MaterialIcon type="smart_toy" />
        )}
      </div>

      <div className="ai-chat-message-content">
        <div className="ai-chat-message-header">
          <span className="ai-chat-message-role">
            {isUser ? t('you') || 'You' : t('ai_assistant') || 'AI Assistant'}
          </span>
          {message.metadata?.model_used && (
            <span className="ai-chat-message-model">
              {message.metadata.model_used}
            </span>
          )}
          <span className="ai-chat-message-time">
            {formatTime(message.timestamp)}
          </span>
        </div>

        <div className="ai-chat-message-text">
          {message.content}
        </div>

        {message.pending && (
          <div className="ai-chat-message-pending">
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>
        )}

        {isAssistant && !message.pending && (
          <div className="ai-chat-message-actions">
            <button
              className="ai-chat-action-button"
              title={t('copy') || 'Copy'}
              onClick={() => navigator.clipboard.writeText(message.content)}
            >
              <MaterialIcon type="content_copy" />
            </button>
            <button
              className="ai-chat-action-button"
              title={t('apply_to_document') || 'Apply to document'}
            >
              <MaterialIcon type="add_to_photos" />
            </button>
            <button
              className="ai-chat-action-button"
              title={t('apply_with_track_changes') || 'Apply with Track Changes'}
            >
              <MaterialIcon type="track_changes" />
            </button>
          </div>
        )}

        {message.metadata?.document_context && (
          <div className="ai-chat-message-context">
            <MaterialIcon type="description" />
            <span>{message.metadata.document_context.doc_name}</span>
            {message.metadata.document_context.selection && (
              <span className="ai-chat-context-lines">
                (Lines {message.metadata.document_context.selection.start_line}-
                {message.metadata.document_context.selection.end_line})
              </span>
            )}
          </div>
        )}

        {message.metadata?.tokens_used && (
          <div className="ai-chat-message-tokens">
            <MaterialIcon type="token" />
            <span>
              {message.metadata.tokens_used.input + message.metadata.tokens_used.output} tokens
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
