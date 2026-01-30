/**
 * useApplyToDocument Hook
 *
 * Hook for applying AI-generated content to the editor document
 * Supports both direct insertion and Track Changes mode
 */

import { useCallback, useState, useEffect } from 'react'
import { EditorSelection, Transaction } from '@codemirror/state'
import { getGlobalEditorView } from '@/features/source-editor/extensions/expose-editor-view'

type ApplyMode = 'insert' | 'replace' | 'append'

type ApplyOptions = {
  mode?: ApplyMode
  withTrackChanges?: boolean
  position?: 'cursor' | 'start' | 'end' | number
}

type ApplyResult = {
  success: boolean
  error?: string
  position?: number
}

/**
 * Get the CodeMirror view from the global scope
 * The AI Chat is in the rail, outside the CodeMirror context,
 * so we need to access it via a different method
 */
function getEditorView() {
  // First try the global reference from the extension
  const globalView = getGlobalEditorView()
  if (globalView) {
    return globalView
  }

  // Fallback: Access via the DOM element
  const editorElement = document.querySelector('.cm-editor')
  if (editorElement && (editorElement as any).cmView) {
    return (editorElement as any).cmView as import('@codemirror/view').EditorView
  }

  // Last resort: Try to get via custom event
  let view: import('@codemirror/view').EditorView | null = null
  const event = new CustomEvent('get-editor-view', {
    detail: { callback: (v: import('@codemirror/view').EditorView) => { view = v } }
  })
  window.dispatchEvent(event)

  return view
}

/**
 * Format content before applying (handle LaTeX code blocks, etc.)
 */
function formatContentForEditor(content: string): string {
  // Remove markdown code block markers if present
  let formatted = content

  // Handle ```latex or ```tex code blocks
  formatted = formatted.replace(/```(?:latex|tex)?\n?([\s\S]*?)```/g, '$1')

  // Trim leading/trailing whitespace
  formatted = formatted.trim()

  return formatted
}

export function useApplyToDocument() {
  const [isApplying, setIsApplying] = useState(false)
  const [lastApplyResult, setLastApplyResult] = useState<ApplyResult | null>(null)

  /**
   * Apply content to the document
   */
  const applyToDocument = useCallback(async (
    content: string,
    options: ApplyOptions = {}
  ): Promise<ApplyResult> => {
    const {
      mode = 'insert',
      withTrackChanges = false,
      position = 'cursor'
    } = options

    setIsApplying(true)
    setLastApplyResult(null)

    try {
      const view = getEditorView()
      if (!view) {
        const result: ApplyResult = {
          success: false,
          error: 'Editor not available. Please open a document first.'
        }
        setLastApplyResult(result)
        return result
      }

      // Format the content (remove markdown code blocks, etc.)
      const formattedContent = formatContentForEditor(content)

      const state = view.state
      const doc = state.doc
      let insertPosition: number

      // Determine insertion position
      if (typeof position === 'number') {
        insertPosition = Math.min(Math.max(0, position), doc.length)
      } else if (position === 'start') {
        insertPosition = 0
      } else if (position === 'end') {
        insertPosition = doc.length
      } else {
        // 'cursor' - use current selection/cursor position
        insertPosition = state.selection.main.head
      }

      // Get selection range for replace mode
      const selectionFrom = state.selection.main.from
      const selectionTo = state.selection.main.to
      const hasSelection = selectionFrom !== selectionTo

      // Build the change spec based on mode
      let changes: { from: number; to?: number; insert: string }

      switch (mode) {
        case 'replace':
          if (hasSelection) {
            changes = { from: selectionFrom, to: selectionTo, insert: formattedContent }
            insertPosition = selectionFrom
          } else {
            changes = { from: insertPosition, insert: formattedContent }
          }
          break
        case 'append':
          // Add newline before content if not at end of document
          const prefix = doc.length > 0 && !doc.sliceString(doc.length - 1).endsWith('\n') ? '\n' : ''
          changes = { from: doc.length, insert: prefix + formattedContent }
          insertPosition = doc.length + prefix.length
          break
        case 'insert':
        default:
          changes = { from: insertPosition, insert: formattedContent }
          break
      }

      // Enable track changes if requested and not already on
      if (withTrackChanges) {
        // Dispatch event to enable track changes for current user
        // The toggle-track-changes event will enable track changes if it's not already on
        window.dispatchEvent(new CustomEvent('toggle-track-changes'))
        // Small delay to ensure track changes state is updated
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // Apply the change
      // The change will be tracked automatically if track changes is enabled for the user
      view.dispatch({
        changes,
        selection: EditorSelection.cursor(insertPosition + formattedContent.length),
        scrollIntoView: true,
        // Mark as user action (not remote) - this ensures it goes into history
        annotations: [
          Transaction.userEvent.of('ai-apply'),
          Transaction.addToHistory.of(true),
        ],
      })

      // Focus the editor
      view.focus()

      const result: ApplyResult = {
        success: true,
        position: insertPosition
      }
      setLastApplyResult(result)
      return result

    } catch (error) {
      const result: ApplyResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to apply content'
      }
      setLastApplyResult(result)
      return result
    } finally {
      setIsApplying(false)
    }
  }, [])

  /**
   * Insert content at cursor position
   */
  const insertAtCursor = useCallback((content: string) => {
    return applyToDocument(content, { mode: 'insert', position: 'cursor' })
  }, [applyToDocument])

  /**
   * Replace selected text with content
   */
  const replaceSelection = useCallback((content: string) => {
    return applyToDocument(content, { mode: 'replace' })
  }, [applyToDocument])

  /**
   * Append content at the end of document
   */
  const appendToDocument = useCallback((content: string) => {
    return applyToDocument(content, { mode: 'append' })
  }, [applyToDocument])

  /**
   * Insert with Track Changes enabled
   */
  const insertWithTrackChanges = useCallback((content: string) => {
    return applyToDocument(content, { mode: 'insert', withTrackChanges: true })
  }, [applyToDocument])

  /**
   * Replace with Track Changes enabled
   */
  const replaceWithTrackChanges = useCallback((content: string) => {
    return applyToDocument(content, { mode: 'replace', withTrackChanges: true })
  }, [applyToDocument])

  /**
   * Get current editor selection text
   */
  const getSelectedText = useCallback((): string | null => {
    const view = getEditorView()
    if (!view) return null

    const { from, to } = view.state.selection.main
    if (from === to) return null

    return view.state.sliceDoc(from, to)
  }, [])

  /**
   * Get cursor position info
   */
  const getCursorInfo = useCallback(() => {
    const view = getEditorView()
    if (!view) return null

    const pos = view.state.selection.main.head
    const line = view.state.doc.lineAt(pos)

    return {
      position: pos,
      line: line.number,
      column: pos - line.from,
      hasSelection: view.state.selection.main.from !== view.state.selection.main.to
    }
  }, [])

  /**
   * Check if editor is available
   */
  const isEditorAvailable = useCallback(() => {
    return getEditorView() !== null
  }, [])

  return {
    applyToDocument,
    insertAtCursor,
    replaceSelection,
    appendToDocument,
    insertWithTrackChanges,
    replaceWithTrackChanges,
    getSelectedText,
    getCursorInfo,
    isEditorAvailable,
    isApplying,
    lastApplyResult,
  }
}
