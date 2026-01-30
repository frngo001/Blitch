/**
 * Inline Edit State Extension
 *
 * Manages the state for CMD+K inline editing
 */

import { StateField, StateEffect } from '@codemirror/state'

export type InlineEditPosition = {
  from: number
  to: number
  selectedText: string
}

export type InlineEditState = {
  isOpen: boolean
  position: InlineEditPosition | null
}

// Effects
export const openInlineEditEffect = StateEffect.define<InlineEditPosition>()
export const closeInlineEditEffect = StateEffect.define<void>()

// State Field
export const inlineEditState = StateField.define<InlineEditState>({
  create() {
    return {
      isOpen: false,
      position: null
    }
  },

  update(state, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(openInlineEditEffect)) {
        return {
          isOpen: true,
          position: effect.value
        }
      }
      if (effect.is(closeInlineEditEffect)) {
        return {
          isOpen: false,
          position: null
        }
      }
    }
    return state
  }
})

/**
 * Get the current inline edit state from the editor
 */
export function getInlineEditState(view: { state: { field: typeof inlineEditState extends StateField<infer T> ? (field: StateField<T>) => T : never } }): InlineEditState | undefined {
  try {
    return view.state.field(inlineEditState)
  } catch {
    return undefined
  }
}
