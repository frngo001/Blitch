/**
 * Expose Editor View Extension
 *
 * This extension exposes the CodeMirror EditorView to external components
 * (like the AI Chat rail) that are outside the CodeMirror context.
 */

import { ViewPlugin, EditorView, ViewUpdate } from '@codemirror/view'

// Global reference to the current editor view
let globalEditorView: EditorView | null = null

/**
 * Get the current editor view (if available)
 */
export function getGlobalEditorView(): EditorView | null {
  return globalEditorView
}

/**
 * Extension that exposes the editor view globally
 */
export const exposeEditorView = ViewPlugin.fromClass(
  class {
    constructor(view: EditorView) {
      globalEditorView = view
      // Store reference on DOM element for direct access
      if (view.dom) {
        (view.dom as any).cmView = view
      }
      // Dispatch event to notify listeners
      window.dispatchEvent(new CustomEvent('editor-view-ready', { detail: { view } }))
    }

    update(update: ViewUpdate) {
      // Keep reference up to date
      globalEditorView = update.view
    }

    destroy() {
      globalEditorView = null
    }
  }
)

/**
 * Event listener setup for external components to request the editor view
 */
let listenerSetup = false

export function setupEditorViewListener() {
  if (listenerSetup) return

  window.addEventListener('get-editor-view', (event: Event) => {
    const customEvent = event as CustomEvent
    if (customEvent.detail?.callback && globalEditorView) {
      customEvent.detail.callback(globalEditorView)
    }
  })

  listenerSetup = true
}

// Auto-setup listener
setupEditorViewListener()
