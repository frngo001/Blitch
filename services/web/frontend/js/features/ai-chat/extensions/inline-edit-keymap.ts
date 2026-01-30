/**
 * Inline Edit Keymap Extension
 *
 * Handles CMD+K (Mac) / Ctrl+K (Windows) to open inline AI edit
 */

import { keymap, EditorView } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { openInlineEditEffect, closeInlineEditEffect, inlineEditState } from './inline-edit-state'

/**
 * Custom event dispatched when CMD+K is pressed
 */
export type InlineEditOpenEvent = CustomEvent<{
  from: number
  to: number
  selectedText: string
  editorView: EditorView
}>

/**
 * High-priority keymap for inline AI editing
 */
export const inlineEditKeymap = Prec.highest(
  keymap.of([
    {
      key: 'Mod-k',
      preventDefault: true,
      run(view) {
        const { from, to } = view.state.selection.main
        const selectedText = from !== to
          ? view.state.sliceDoc(from, to)
          : ''

        // Dispatch state effect
        view.dispatch({
          effects: openInlineEditEffect.of({
            from,
            to,
            selectedText
          })
        })

        // Dispatch custom event for React to handle
        const event: InlineEditOpenEvent = new CustomEvent('ai-inline-edit-open', {
          detail: {
            from,
            to,
            selectedText,
            editorView: view
          }
        }) as InlineEditOpenEvent

        window.dispatchEvent(event)

        return true
      }
    },
    {
      key: 'Escape',
      run(view) {
        const state = view.state.field(inlineEditState, false)
        if (state?.isOpen) {
          view.dispatch({
            effects: closeInlineEditEffect.of(undefined)
          })

          // Dispatch close event
          window.dispatchEvent(new CustomEvent('ai-inline-edit-close'))

          return true
        }
        return false
      }
    }
  ])
)
