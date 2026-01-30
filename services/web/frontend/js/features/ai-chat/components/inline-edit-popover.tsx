/**
 * Inline Edit Popover
 *
 * Floating input that appears when CMD+K is pressed
 * Allows quick AI edits without opening the chat panel
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import MaterialIcon from '@/shared/components/material-icon'
import { postJSON } from '@/infrastructure/fetch-json'
import type { EditorView } from '@codemirror/view'

type InlineEditPopoverProps = {
  projectId: string
  onClose: () => void
  onApply: (content: string) => void
  position: { from: number; to: number }
  selectedText: string
  editorView: EditorView | null
}

export function InlineEditPopover({
  projectId,
  onClose,
  onApply,
  position,
  selectedText,
  editorView
}: InlineEditPopoverProps) {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Calculate position based on editor selection
  const [coords, setCoords] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (editorView && position) {
      const coords = editorView.coordsAtPos(position.from)
      if (coords) {
        setCoords({
          top: coords.top - 60, // Above the selection
          left: coords.left
        })
      }
    }
  }, [editorView, position])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim() || isLoading) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await postJSON(`/project/${projectId}/agent/quick-edit`, {
        body: {
          prompt: prompt.trim(),
          selectedText,
          context: 'inline-edit'
        }
      })

      if (response.content) {
        onApply(response.content)
      }
    } catch (err) {
      console.error('Quick edit failed:', err)
      setError('Failed to generate edit')
    } finally {
      setIsLoading(false)
    }
  }, [prompt, projectId, selectedText, onApply, isLoading])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }, [handleSubmit, onClose])

  // Quick action buttons
  const quickActions = [
    { label: 'Improve', prompt: 'Improve this text, making it clearer and more concise' },
    { label: 'Fix grammar', prompt: 'Fix any grammar or spelling errors' },
    { label: 'Simplify', prompt: 'Simplify this text' },
    { label: 'Formal', prompt: 'Make this text more formal and academic' },
  ]

  const handleQuickAction = (actionPrompt: string) => {
    setPrompt(actionPrompt)
    // Auto-submit after setting prompt
    setTimeout(() => {
      handleSubmit()
    }, 100)
  }

  return createPortal(
    <div
      ref={containerRef}
      className="inline-edit-popover"
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        zIndex: 1000
      }}
    >
      <div className="inline-edit-header">
        <MaterialIcon type="auto_fix_high" />
        <span>{t('ai_edit', 'AI Edit')}</span>
        {selectedText && (
          <span className="inline-edit-selection-info">
            {selectedText.length} chars selected
          </span>
        )}
        <button className="inline-edit-close" onClick={onClose}>
          <MaterialIcon type="close" />
        </button>
      </div>

      <div className="inline-edit-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="inline-edit-input"
          placeholder={t('describe_change', 'Describe the change...')}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        <button
          className="inline-edit-submit"
          onClick={handleSubmit}
          disabled={!prompt.trim() || isLoading}
        >
          {isLoading ? (
            <MaterialIcon type="sync" className="spin" />
          ) : (
            <MaterialIcon type="send" />
          )}
        </button>
      </div>

      {/* Quick Actions */}
      <div className="inline-edit-quick-actions">
        {quickActions.map(action => (
          <button
            key={action.label}
            className="inline-edit-quick-action"
            onClick={() => handleQuickAction(action.prompt)}
            disabled={isLoading}
          >
            {action.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="inline-edit-error">
          <MaterialIcon type="error" />
          <span>{error}</span>
        </div>
      )}

      <div className="inline-edit-hint">
        {t('inline_edit_hint', 'Press Enter to submit, Escape to cancel')}
      </div>
    </div>,
    document.body
  )
}

/**
 * Hook to manage inline edit popover state
 */
export function useInlineEditPopover(projectId: string) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<{ from: number; to: number } | null>(null)
  const [selectedText, setSelectedText] = useState('')
  const [editorView, setEditorView] = useState<EditorView | null>(null)

  useEffect(() => {
    const handleOpen = (e: CustomEvent) => {
      const { from, to, selectedText, editorView } = e.detail
      setPosition({ from, to })
      setSelectedText(selectedText)
      setEditorView(editorView)
      setIsOpen(true)
    }

    const handleClose = () => {
      setIsOpen(false)
      setPosition(null)
      setSelectedText('')
      setEditorView(null)
    }

    window.addEventListener('ai-inline-edit-open', handleOpen as EventListener)
    window.addEventListener('ai-inline-edit-close', handleClose)

    return () => {
      window.removeEventListener('ai-inline-edit-open', handleOpen as EventListener)
      window.removeEventListener('ai-inline-edit-close', handleClose)
    }
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setPosition(null)
    setSelectedText('')
    setEditorView(null)
    window.dispatchEvent(new CustomEvent('ai-inline-edit-close'))
  }, [])

  return {
    isOpen,
    position,
    selectedText,
    editorView,
    close
  }
}

export default InlineEditPopover
