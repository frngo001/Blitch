/**
 * AI Chat Context
 *
 * State management for the AI Scientific Agent Chat
 * IMPORTANT: This is SEPARATE from the team chat (features/chat)
 */

import {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useMemo,
  FC,
} from 'react'
import { useProjectContext } from '../../../shared/context/project-context'
import { postJSON, getJSON } from '../../../infrastructure/fetch-json'
import getMeta from '@/utils/meta'

// Message types for AI Chat
export type AIMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  pending?: boolean
  streaming?: boolean
  metadata?: {
    skill_used?: string
    tokens_used?: { input: number; output: number }
    model_used?: string
    document_context?: {
      doc_id: string
      doc_name: string
      selection?: {
        start_line: number
        end_line: number
        text: string
      }
    }
  }
}

export type AISession = {
  _id: string
  project_id: string
  user_id: string
  title: string
  messages: AIMessage[]
  model_preference: {
    provider: string
    model: string
  }
  status: 'active' | 'archived'
  total_tokens: number
  created_at: Date
  updated_at: Date
}

type State = {
  status: 'idle' | 'pending' | 'streaming' | 'error'
  session: AISession | null
  messages: AIMessage[]
  currentStreamContent: string
  selectedProvider: string
  selectedModel: string
  error: Error | null
}

type Action =
  | { type: 'SET_SESSION'; session: AISession }
  | { type: 'SEND_MESSAGE'; content: string }
  | { type: 'START_STREAMING' }
  | { type: 'STREAM_TOKEN'; content: string }
  | { type: 'STREAM_DONE'; message: AIMessage }
  | { type: 'RECEIVE_MESSAGE'; message: AIMessage }
  | { type: 'SET_PROVIDER'; provider: string }
  | { type: 'SET_MODEL'; model: string }
  | { type: 'SET_ERROR'; error: Error }
  | { type: 'CLEAR_ERROR' }
  | { type: 'CLEAR_SESSION' }

const initialState: State = {
  status: 'idle',
  session: null,
  messages: [],
  currentStreamContent: '',
  selectedProvider: 'anthropic',
  selectedModel: 'claude-3-5-haiku',
  error: null,
}

function aiChatReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_SESSION':
      return {
        ...state,
        session: action.session,
        messages: action.session.messages || [],
        selectedProvider: action.session.model_preference?.provider || state.selectedProvider,
        selectedModel: action.session.model_preference?.model || state.selectedModel,
      }

    case 'SEND_MESSAGE':
      const userMessage: AIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: action.content,
        timestamp: new Date(),
        pending: true,
      }
      return {
        ...state,
        status: 'pending',
        messages: [...state.messages, userMessage],
      }

    case 'START_STREAMING':
      return {
        ...state,
        status: 'streaming',
        currentStreamContent: '',
      }

    case 'STREAM_TOKEN':
      return {
        ...state,
        currentStreamContent: state.currentStreamContent + action.content,
      }

    case 'STREAM_DONE':
      return {
        ...state,
        status: 'idle',
        messages: [...state.messages, action.message],
        currentStreamContent: '',
      }

    case 'RECEIVE_MESSAGE':
      // Mark user message as not pending
      const updatedMessages = state.messages.map(msg =>
        msg.pending ? { ...msg, pending: false } : msg
      )
      return {
        ...state,
        status: 'idle',
        messages: [...updatedMessages, action.message],
      }

    case 'SET_PROVIDER':
      return {
        ...state,
        selectedProvider: action.provider,
      }

    case 'SET_MODEL':
      return {
        ...state,
        selectedModel: action.model,
      }

    case 'SET_ERROR':
      return {
        ...state,
        status: 'error',
        error: action.error,
      }

    case 'CLEAR_ERROR':
      return {
        ...state,
        status: 'idle',
        error: null,
      }

    case 'CLEAR_SESSION':
      return {
        ...initialState,
        selectedProvider: state.selectedProvider,
        selectedModel: state.selectedModel,
      }

    default:
      return state
  }
}

type AIChatContextValue = {
  status: State['status']
  session: State['session']
  messages: State['messages']
  currentStreamContent: State['currentStreamContent']
  selectedProvider: State['selectedProvider']
  selectedModel: State['selectedModel']
  error: State['error']
  sendMessage: (content: string, context?: AIMessage['metadata']['document_context']) => void
  loadSession: () => void
  createSession: () => void
  clearSession: () => void
  setProvider: (provider: string) => void
  setModel: (model: string) => void
}

export const AIChatContext = createContext<AIChatContextValue | undefined>(undefined)

export const AIChatProvider: FC<React.PropsWithChildren> = ({ children }) => {
  const aiAgentEnabled = getMeta('ol-aiAgentEnabled') || process.env.AI_AGENT_ENABLED === 'true'
  const { projectId } = useProjectContext()

  const [state, dispatch] = useReducer(aiChatReducer, initialState)

  const loadSession = useCallback(async () => {
    if (!aiAgentEnabled || !projectId) return

    try {
      const response = await getJSON(`/project/${projectId}/agent/session`)
      dispatch({ type: 'SET_SESSION', session: response.session })
    } catch (error) {
      dispatch({ type: 'SET_ERROR', error: error as Error })
    }
  }, [aiAgentEnabled, projectId])

  const createSession = useCallback(async () => {
    if (!aiAgentEnabled || !projectId) return

    try {
      const response = await postJSON(`/project/${projectId}/agent/session`, {
        body: {
          provider: state.selectedProvider,
          model: state.selectedModel,
        },
      })
      dispatch({ type: 'SET_SESSION', session: response.session })
    } catch (error) {
      dispatch({ type: 'SET_ERROR', error: error as Error })
    }
  }, [aiAgentEnabled, projectId, state.selectedProvider, state.selectedModel])

  const sendMessage = useCallback(
    async (content: string, context?: AIMessage['metadata']['document_context']) => {
      if (!aiAgentEnabled || !projectId || !content.trim()) return

      dispatch({ type: 'SEND_MESSAGE', content })

      try {
        const response = await postJSON(`/project/${projectId}/agent/message`, {
          body: {
            message: content,
            sessionId: state.session?._id,
            provider: state.selectedProvider,
            model: state.selectedModel,
            context,
          },
        })

        dispatch({
          type: 'RECEIVE_MESSAGE',
          message: response.message,
        })
      } catch (error) {
        dispatch({ type: 'SET_ERROR', error: error as Error })
      }
    },
    [aiAgentEnabled, projectId, state.session?._id, state.selectedProvider, state.selectedModel]
  )

  const clearSession = useCallback(() => {
    dispatch({ type: 'CLEAR_SESSION' })
  }, [])

  const setProvider = useCallback((provider: string) => {
    dispatch({ type: 'SET_PROVIDER', provider })
  }, [])

  const setModel = useCallback((model: string) => {
    dispatch({ type: 'SET_MODEL', model })
  }, [])

  const value = useMemo(
    () => ({
      status: state.status,
      session: state.session,
      messages: state.messages,
      currentStreamContent: state.currentStreamContent,
      selectedProvider: state.selectedProvider,
      selectedModel: state.selectedModel,
      error: state.error,
      sendMessage,
      loadSession,
      createSession,
      clearSession,
      setProvider,
      setModel,
    }),
    [
      state.status,
      state.session,
      state.messages,
      state.currentStreamContent,
      state.selectedProvider,
      state.selectedModel,
      state.error,
      sendMessage,
      loadSession,
      createSession,
      clearSession,
      setProvider,
      setModel,
    ]
  )

  return <AIChatContext.Provider value={value}>{children}</AIChatContext.Provider>
}

export function useAIChatContext() {
  const context = useContext(AIChatContext)
  if (!context) {
    throw new Error('useAIChatContext is only available inside AIChatProvider')
  }
  return context
}
