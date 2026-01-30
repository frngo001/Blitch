/**
 * Enhanced Chat Input Component
 *
 * A beautiful, feature-rich chat input with:
 * - @ Mentions for files, skills, web
 * - Attachment button
 * - Quick actions toolbar
 * - Character count
 * - Model selector
 * - Beautiful animations
 * - Dark theme support
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle
} from 'react'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import classNames from 'classnames'

// Types
type MentionType = 'file' | 'skill' | 'web' | 'selection'

type MentionItem = {
  id: string
  type: MentionType
  label: string
  description?: string
  icon: string
}

type QuickAction = {
  id: string
  label: string
  description: string
  icon: string
  prompt: string
}

type ModelOption = {
  id: string
  name: string
  provider: string
  icon: string
  tier: 'free' | 'pro' | 'enterprise'
}

export type EnhancedChatInputProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onStop?: () => void
  isStreaming?: boolean
  disabled?: boolean
  placeholder?: string
  maxLength?: number
  selectedModel: ModelOption
  onModelChange: (model: ModelOption) => void
  availableModels: ModelOption[]
  projectFiles?: { id: string; name: string; path: string }[]
  onMentionSelect?: (mention: MentionItem) => void
}

export type EnhancedChatInputRef = {
  focus: () => void
  blur: () => void
  insertText: (text: string) => void
}

// Quick Actions
const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'improve',
    label: 'Improve',
    description: 'Enhance writing quality',
    icon: 'auto_fix_high',
    prompt: '/improve '
  },
  {
    id: 'explain',
    label: 'Explain',
    description: 'Explain selected code/text',
    icon: 'school',
    prompt: '/explain '
  },
  {
    id: 'fix',
    label: 'Fix',
    description: 'Fix errors and issues',
    icon: 'build',
    prompt: '/fix '
  },
  {
    id: 'translate',
    label: 'Translate',
    description: 'Translate to another language',
    icon: 'translate',
    prompt: '/translate '
  },
  {
    id: 'summarize',
    label: 'Summarize',
    description: 'Create a summary',
    icon: 'summarize',
    prompt: '/summarize '
  },
  {
    id: 'cite',
    label: 'Cite',
    description: 'Add citations',
    icon: 'format_quote',
    prompt: '/cite '
  }
]

// Mention Suggestions
const MENTION_TYPES: { type: MentionType; icon: string; label: string }[] = [
  { type: 'file', icon: 'description', label: 'Files' },
  { type: 'skill', icon: 'psychology', label: 'Skills' },
  { type: 'web', icon: 'public', label: 'Web Search' },
  { type: 'selection', icon: 'select_all', label: 'Selection' }
]

export const EnhancedChatInput = forwardRef<EnhancedChatInputRef, EnhancedChatInputProps>(
  (
    {
      value,
      onChange,
      onSubmit,
      onStop,
      isStreaming = false,
      disabled = false,
      placeholder = 'Ask anything... Use @ to mention files, / for commands',
      maxLength = 10000,
      selectedModel,
      onModelChange,
      availableModels,
      projectFiles = [],
      onMentionSelect
    },
    ref
  ) => {
    const { t } = useTranslation()
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // State
    const [isFocused, setIsFocused] = useState(false)
    const [showMentions, setShowMentions] = useState(false)
    const [showQuickActions, setShowQuickActions] = useState(false)
    const [showModelSelector, setShowModelSelector] = useState(false)
    const [mentionQuery, setMentionQuery] = useState('')
    const [mentionType, setMentionType] = useState<MentionType | null>(null)
    const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      blur: () => textareaRef.current?.blur(),
      insertText: (text: string) => {
        const textarea = textareaRef.current
        if (textarea) {
          const start = textarea.selectionStart
          const end = textarea.selectionEnd
          const newValue = value.substring(0, start) + text + value.substring(end)
          onChange(newValue)
          // Set cursor after inserted text
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + text.length
          }, 0)
        }
      }
    }))

    // Auto-resize textarea
    useEffect(() => {
      const textarea = textareaRef.current
      if (textarea) {
        textarea.style.height = 'auto'
        const newHeight = Math.min(Math.max(textarea.scrollHeight, 52), 200)
        textarea.style.height = `${newHeight}px`
      }
    }, [value])

    // Detect @ mentions
    useEffect(() => {
      const match = value.match(/@(\w*)$/)
      if (match) {
        setShowMentions(true)
        setMentionQuery(match[1])
        setSelectedMentionIndex(0)
      } else {
        setShowMentions(false)
        setMentionQuery('')
      }
    }, [value])

    // Detect / commands
    useEffect(() => {
      if (value.startsWith('/') && value.length < 15) {
        setShowQuickActions(true)
      } else {
        setShowQuickActions(false)
      }
    }, [value])

    // Filtered mentions
    const filteredMentions = useMemo(() => {
      const items: MentionItem[] = []

      // Add mention types
      MENTION_TYPES.forEach(type => {
        if (!mentionQuery || type.label.toLowerCase().includes(mentionQuery.toLowerCase())) {
          items.push({
            id: `type-${type.type}`,
            type: type.type,
            label: type.label,
            icon: type.icon
          })
        }
      })

      // Add matching files
      if (mentionType === 'file' || !mentionType) {
        projectFiles
          .filter(f => !mentionQuery || f.name.toLowerCase().includes(mentionQuery.toLowerCase()))
          .slice(0, 5)
          .forEach(file => {
            items.push({
              id: `file-${file.id}`,
              type: 'file',
              label: file.name,
              description: file.path,
              icon: 'description'
            })
          })
      }

      return items.slice(0, 8)
    }, [mentionQuery, mentionType, projectFiles])

    // Filtered quick actions
    const filteredQuickActions = useMemo(() => {
      const query = value.slice(1).toLowerCase()
      return QUICK_ACTIONS.filter(
        action =>
          action.id.includes(query) ||
          action.label.toLowerCase().includes(query)
      )
    }, [value])

    // Handle input change
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value
        if (newValue.length <= maxLength) {
          onChange(newValue)
        }
      },
      [onChange, maxLength]
    )

    // Handle key down
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Enter to submit (without shift)
        if (e.key === 'Enter' && !e.shiftKey) {
          if (showMentions && filteredMentions.length > 0) {
            e.preventDefault()
            handleMentionSelect(filteredMentions[selectedMentionIndex])
            return
          }
          if (showQuickActions && filteredQuickActions.length > 0) {
            e.preventDefault()
            handleQuickActionSelect(filteredQuickActions[selectedMentionIndex])
            return
          }
          e.preventDefault()
          if (value.trim() && !disabled && !isStreaming) {
            onSubmit()
          }
        }

        // Arrow navigation in mentions/actions
        if (showMentions || showQuickActions) {
          const items = showMentions ? filteredMentions : filteredQuickActions
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedMentionIndex(i => (i + 1) % items.length)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedMentionIndex(i => (i - 1 + items.length) % items.length)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            setShowMentions(false)
            setShowQuickActions(false)
          }
        }
      },
      [
        value,
        disabled,
        isStreaming,
        onSubmit,
        showMentions,
        showQuickActions,
        filteredMentions,
        filteredQuickActions,
        selectedMentionIndex
      ]
    )

    // Handle mention selection
    const handleMentionSelect = useCallback(
      (mention: MentionItem) => {
        // Replace @query with mention
        const newValue = value.replace(/@\w*$/, `@${mention.label} `)
        onChange(newValue)
        setShowMentions(false)
        onMentionSelect?.(mention)
        textareaRef.current?.focus()
      },
      [value, onChange, onMentionSelect]
    )

    // Handle quick action selection
    const handleQuickActionSelect = useCallback(
      (action: QuickAction) => {
        onChange(action.prompt)
        setShowQuickActions(false)
        textareaRef.current?.focus()
      },
      [onChange]
    )

    // Character count color
    const charCountColor = useMemo(() => {
      const ratio = value.length / maxLength
      if (ratio > 0.9) return 'var(--red-50)'
      if (ratio > 0.75) return 'var(--yellow-50)'
      return 'var(--content-secondary)'
    }, [value.length, maxLength])

    return (
      <div
        ref={containerRef}
        className={classNames('enhanced-chat-input', {
          'is-focused': isFocused,
          'is-streaming': isStreaming,
          'is-disabled': disabled
        })}
      >
        {/* Quick Actions Toolbar */}
        <div className="enhanced-input-toolbar">
          <div className="enhanced-input-actions-left">
            {QUICK_ACTIONS.slice(0, 4).map(action => (
              <button
                key={action.id}
                className="enhanced-action-chip"
                onClick={() => handleQuickActionSelect(action)}
                title={action.description}
                disabled={disabled || isStreaming}
              >
                <MaterialIcon type={action.icon} />
                <span>{action.label}</span>
              </button>
            ))}
          </div>

          <div className="enhanced-input-actions-right">
            {/* Model Selector */}
            <div className="enhanced-model-selector">
              <button
                className="enhanced-model-btn"
                onClick={() => setShowModelSelector(!showModelSelector)}
                disabled={disabled || isStreaming}
              >
                <span className="enhanced-model-icon">{selectedModel.icon}</span>
                <span className="enhanced-model-name">{selectedModel.name}</span>
                <MaterialIcon type="expand_more" />
              </button>

              {showModelSelector && (
                <div className="enhanced-model-dropdown">
                  {availableModels.map(model => (
                    <button
                      key={model.id}
                      className={classNames('enhanced-model-option', {
                        selected: model.id === selectedModel.id
                      })}
                      onClick={() => {
                        onModelChange(model)
                        setShowModelSelector(false)
                      }}
                    >
                      <span className="enhanced-model-icon">{model.icon}</span>
                      <span className="enhanced-model-info">
                        <span className="enhanced-model-name">{model.name}</span>
                        <span className="enhanced-model-provider">{model.provider}</span>
                      </span>
                      {model.tier !== 'free' && (
                        <span className={`enhanced-tier-badge tier-${model.tier}`}>
                          {model.tier.toUpperCase()}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Input Area */}
        <div className="enhanced-input-main">
          {/* Attachment Button */}
          <button
            className="enhanced-attach-btn"
            title={t('attach_file', 'Attach file')}
            disabled={disabled || isStreaming}
          >
            <MaterialIcon type="attach_file" />
          </button>

          {/* Textarea */}
          <div className="enhanced-textarea-wrapper">
            <textarea
              ref={textareaRef}
              className="enhanced-textarea"
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              disabled={disabled || isStreaming}
              rows={1}
            />

            {/* Mention Popup */}
            {showMentions && filteredMentions.length > 0 && (
              <div className="enhanced-mentions-popup">
                <div className="enhanced-mentions-header">
                  <MaterialIcon type="alternate_email" />
                  <span>Mention</span>
                </div>
                {filteredMentions.map((mention, index) => (
                  <button
                    key={mention.id}
                    className={classNames('enhanced-mention-item', {
                      selected: index === selectedMentionIndex
                    })}
                    onClick={() => handleMentionSelect(mention)}
                  >
                    <MaterialIcon type={mention.icon} />
                    <span className="enhanced-mention-label">{mention.label}</span>
                    {mention.description && (
                      <span className="enhanced-mention-desc">{mention.description}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Quick Actions Popup */}
            {showQuickActions && filteredQuickActions.length > 0 && (
              <div className="enhanced-quick-actions-popup">
                <div className="enhanced-quick-actions-header">
                  <MaterialIcon type="bolt" />
                  <span>Commands</span>
                </div>
                {filteredQuickActions.map((action, index) => (
                  <button
                    key={action.id}
                    className={classNames('enhanced-quick-action-item', {
                      selected: index === selectedMentionIndex
                    })}
                    onClick={() => handleQuickActionSelect(action)}
                  >
                    <MaterialIcon type={action.icon} />
                    <span className="enhanced-action-label">/{action.id}</span>
                    <span className="enhanced-action-desc">{action.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Side Actions */}
          <div className="enhanced-input-right">
            {/* Character Count */}
            {value.length > 0 && (
              <span
                className="enhanced-char-count"
                style={{ color: charCountColor }}
              >
                {value.length.toLocaleString()}
              </span>
            )}

            {/* Submit/Stop Button */}
            {isStreaming ? (
              <button
                className="enhanced-stop-btn"
                onClick={onStop}
                title={t('stop', 'Stop')}
              >
                <div className="enhanced-stop-icon">
                  <MaterialIcon type="stop" />
                </div>
              </button>
            ) : (
              <button
                className="enhanced-send-btn"
                onClick={onSubmit}
                disabled={!value.trim() || disabled}
                title={t('send', 'Send message')}
              >
                <MaterialIcon type="arrow_upward" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom Hints */}
        <div className="enhanced-input-hints">
          <span className="enhanced-hint">
            <kbd>@</kbd> mention files
          </span>
          <span className="enhanced-hint">
            <kbd>/</kbd> commands
          </span>
          <span className="enhanced-hint">
            <kbd>Enter</kbd> send
          </span>
          <span className="enhanced-hint">
            <kbd>Shift+Enter</kbd> new line
          </span>
        </div>
      </div>
    )
  }
)

EnhancedChatInput.displayName = 'EnhancedChatInput'

export default EnhancedChatInput
