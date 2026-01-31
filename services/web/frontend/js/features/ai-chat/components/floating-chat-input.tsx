/**
 * Floating Chat Input
 *
 * A modern, floating input component for the AI Chat
 * Matches the requested dark theme design
 */

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import classNames from 'classnames'

type Props = {
  onSend: (content: string) => void
  onQuickAction?: (action: string) => void
  disabled?: boolean
  isStreaming?: boolean
  onStop?: () => void
  contextName?: string
  contextDescription?: string
}

const QUICK_ACTIONS = [
  { id: 'explain', label: 'Explain', icon: 'lightbulb' },
  { id: 'analyze', label: 'Analyze', icon: 'analytics' },
  { id: 'summarize', label: 'Summarize', icon: 'short_text' },
]

export default function FloatingChatInput({ 
  onSend, 
  onQuickAction, 
  disabled, 
  isStreaming,
  onStop,
  contextName = 'renewed-nature', // Example default from screenshot
  contextDescription = 'railway.com'
}: Props) {
  const { t } = useTranslation()
  const [content, setContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`
    }
  }, [content])

  const handleSubmit = () => {
    if (content.trim() && !disabled) {
      onSend(content.trim())
      setContent('')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="floating-input-container">
      {/* Quick Action Pills */}
      <div className="floating-input-pills">
        {QUICK_ACTIONS.map(action => (
          <button
            key={action.id}
            className="quick-action-pill"
            onClick={() => onQuickAction?.(action.id)}
            disabled={disabled || isStreaming}
          >
            <MaterialIcon type={action.icon} />
            <span>{t(action.id, action.label)}</span>
          </button>
        ))}
      </div>

      {/* Main Input Box */}
      <div className="floating-input-box">
        {/* Context Pill (if present) */}
        {contextName && (
          <div className="input-context-pill">
            <div className="context-icon">
              <MaterialIcon type="language" /> {/* Using language/globe as simplified icon */}
            </div>
            <div className="context-info">
              <span className="context-name">{contextName}</span>
              <span className="context-desc">{contextDescription}</span>
            </div>
          </div>
        )}

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          className="floating-textarea"
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('ask_question_placeholder', 'Ask a question about this page...')}
          disabled={disabled}
          rows={1}
        />

        {/* Bottom Toolbar */}
        <div className="floating-input-toolbar">
          <div className="toolbar-left">
            <button className="toolbar-btn" disabled={disabled}>
              <MaterialIcon type="add" />
            </button>
            <button className="toolbar-btn" disabled={disabled}>
              <MaterialIcon type="more_horiz" />
            </button>
          </div>
          
          <div className="toolbar-right">
             <button className="toolbar-btn" disabled={disabled}>
              <MaterialIcon type="photo_camera" />
            </button>
            <button className="toolbar-btn" disabled={disabled}>
              <MaterialIcon type="mic" />
            </button>
            
            {isStreaming ? (
              <button className="send-btn stop" onClick={onStop}>
                <MaterialIcon type="stop" />
              </button>
            ) : (
              <button 
                className="send-btn" 
                onClick={handleSubmit}
                disabled={!content.trim() || disabled}
              >
                <MaterialIcon type="arrow_upward" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
