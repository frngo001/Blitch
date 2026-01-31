# Changelog

All notable changes to this Overleaf Community Edition local development setup will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **Railway Healthcheck Endpoints** (2026-01-31)
  - Added root `/` and `/health` endpoints to all services for Railway healthcheck compatibility
  - Services updated: docstore, clsi, web, ai-agent, contacts
  - Railway uses `/` as default healthcheck path
  - Files modified:
    - `services/docstore/app.js`
    - `services/clsi/app.js`
    - `services/web/app/src/router.mjs`

- **Railway Deployment Configuration** (2026-01-30)
  - Complete Railway.app deployment setup for the entire Overleaf stack
  - Files created:
    - `railway.json` - Railway build configuration
    - `railway.toml` - Alternative Railway configuration
    - `docker-compose.railway.yml` - Production Docker Compose for Railway
    - `.env.example` - Template for all environment variables
    - `Procfile` - Web service entry point
    - `nixpacks.toml` - Nixpacks build configuration
    - `Dockerfile.railway` - Simplified Dockerfile for web service
    - `RAILWAY_DEPLOYMENT.md` - Comprehensive deployment guide
    - `railway/deploy.sh` - Automated deployment script
    - `railway/web.railway.json` - Web service config
    - `railway/ai-agent.railway.json` - AI Agent service config
    - `railway/clsi.railway.json` - CLSI service config
  - Features:
    - Multi-service deployment support (web, ai-agent, clsi, etc.)
    - MongoDB and Redis Railway addon integration
    - Private networking configuration for internal services
    - Health check endpoints for all services
    - Production-optimized environment variables
    - Deployment automation script with Railway CLI
    - Comprehensive troubleshooting guide

- **Cursor-like AI Chat Features** (2026-01-30)
  - **Agentic Loops**: Automatic tool execution with LLM continuation
    - Fixed tool passing to LLM adapters (AnthropicAdapter, DeepSeekAdapter)
    - Created `AgenticLoopHandler.js` for automatic tool execution
    - Tools now properly forwarded to Claude and DeepSeek APIs
    - Added `streamAgentic` endpoint for full agentic streaming
  - **Diff Preview Modal**: Preview changes before applying to document
    - Created `diff-preview-modal.tsx` with unified/split view modes
    - Green highlighting for additions, red for deletions
    - "Apply" and "Apply with Track Changes" options
    - Created `diff-calculator.ts` for word-level diffing
  - **CMD+K Inline Editing**: Quick AI edits without chat panel
    - CodeMirror extensions: `inline-edit-state.ts`, `inline-edit-keymap.ts`
    - Floating `InlineEditPopover` component
    - Quick action buttons (Improve, Fix grammar, Simplify, Formal)
    - Added `/project/:projectId/agent/quick-edit` API endpoint
  - **Chat History Modal**: View and switch between old sessions
    - Created `chat-history-modal.tsx` with search/filter
    - Session list with title, date, message count
    - Load previous sessions, delete sessions
    - History button in chat header
  - **Message Action Buttons**: Copy and Apply buttons on AI responses
    - Copy to clipboard with visual feedback
    - Preview & Apply button opens diff preview
  - **Enhanced Chat Input Component**:
    - Beautiful dark-themed input with glass morphism effects
    - @ mentions for files, skills, web search
    - / commands for quick actions (improve, explain, fix, translate, etc.)
    - Integrated model selector dropdown
    - Character count with color warnings
    - Attachment button placeholder
    - Keyboard hints (@ mentions, / commands, Enter, Shift+Enter)
    - Smooth animations and hover effects
    - Created `enhanced-chat-input.tsx` with full TypeScript support
    - Created `enhanced-chat-input.scss` with modern SCSS styling
  - **Scroll Down Button & Shimmer Loading Animation**:
    - Floating scroll-down button appears when user scrolls up
    - Smooth bounce-in animation when button appears
    - Click to scroll smoothly to bottom of messages
    - Beautiful shimmer loading animation while waiting for AI response
    - "AI is thinking..." text with gradient shimmer effect
    - Bouncing dots animation for visual feedback
    - Streaming cursor blink effect during text generation
    - Three-line skeleton loader with staggered animation timing
  - Files created:
    - `services/ai-agent/app/js/Features/Completion/AgenticLoopHandler.js`
    - `services/web/frontend/js/features/ai-chat/components/chat-history-modal.tsx`
    - `services/web/frontend/js/features/ai-chat/components/diff-preview-modal.tsx`
    - `services/web/frontend/js/features/ai-chat/components/inline-edit-popover.tsx`
    - `services/web/frontend/js/features/ai-chat/components/enhanced-chat-input.tsx`
    - `services/web/frontend/js/features/ai-chat/extensions/inline-edit-state.ts`
    - `services/web/frontend/js/features/ai-chat/extensions/inline-edit-keymap.ts`
    - `services/web/frontend/js/features/ai-chat/hooks/useDiffPreview.ts`
    - `services/web/frontend/js/features/ai-chat/utils/diff-calculator.ts`
    - `services/web/frontend/js/features/ai-chat/types/diff.ts`
    - `services/web/frontend/stylesheets/app/ai-chat-features.scss`
    - `services/web/frontend/stylesheets/app/enhanced-chat-input.scss`
  - Files modified:
    - `services/ai-agent/app/js/Infrastructure/LLMGateway/adapters/AnthropicAdapter.js`
    - `services/ai-agent/app/js/Infrastructure/LLMGateway/adapters/DeepSeekAdapter.js`
    - `services/ai-agent/app/js/Features/Completion/CompletionController.js`
    - `services/ai-agent/app/js/server.js`
    - `services/web/frontend/js/features/ide-redesign/components/ai-chat/ai-chat-rail.tsx`
    - `services/web/frontend/js/features/source-editor/extensions/index.ts`
    - `services/web/frontend/stylesheets/pages/all.scss`
    - `services/web/frontend/stylesheets/pages/editor/ai-chat.scss`

- **AI Chat History & Tool Call Persistence** (2026-01-29)
  - Full conversation history persistence in MongoDB with tool call support
  - Created `services/ai-agent/app/js/Models/Message.js` - Message model with:
    - Support for user, assistant, and tool messages
    - Tool call structure (id, name, input)
    - Tool result structure (tool_call_id, content, is_error)
    - Helper functions: `createUserMessage`, `createAssistantMessage`, `createToolResultMessage`
    - LLM format conversion: `convertToLLMFormat` for Claude-compatible messages
    - Message validation and token calculation utilities
  - Enhanced `SessionManager.js`:
    - `addUserMessage(sessionId, content, context)` - persist user messages
    - `addAssistantMessage(sessionId, response)` - persist assistant responses with tool calls
    - `addToolResultMessage(sessionId, toolCallId, toolName, result, isError)` - persist tool results
    - `getSessionWithHistory(sessionId, userId, options)` - retrieve full conversation
    - `getConversationHistory(sessionId, userId, options)` - get message array
    - `getToolCalls(sessionId, userId)` - get all tool calls with their results
    - `exportSession(sessionId, userId)` - export session for backup
    - `searchMessages(sessionId, userId, query)` - search within conversation
    - Auto-increment counters for `message_count` and `tool_call_count`
    - Token tracking with `total_tokens.input` and `total_tokens.output`
  - Enhanced `CompletionController.js`:
    - Added `submitToolResults` endpoint for agentic tool use loops
    - Modified `buildLLMMessages` to include tool calls/results in history
    - Messages properly formatted for Claude API (tool_use, tool_result blocks)
    - Latency tracking in message metadata
    - Stop reason handling (end_turn, tool_use, max_tokens)
  - New API endpoints in `SessionController.js` and `server.js`:
    - `GET /project/:projectId/agent/session/:sessionId/history` - get conversation history
    - `GET /project/:projectId/agent/session/:sessionId/tool-calls` - get tool calls with results
    - `GET /project/:projectId/agent/session/:sessionId/export` - export session as JSON
    - `GET /project/:projectId/agent/session/:sessionId/search?q=` - search messages
    - `PATCH /project/:projectId/agent/session/:sessionId` - update session (title, model)
    - `POST /project/:projectId/agent/tool-results` - submit tool results
    - `GET /agent/user/stats` - get user statistics (sessions, tokens, costs, tool calls)
  - Session schema updated with new fields:
    - `total_tokens: { input: number, output: number }`
    - `message_count: number`
    - `tool_call_count: number`
  - Message schema:
    ```javascript
    // User message
    { id, role: 'user', content, timestamp, metadata: { document_context } }

    // Assistant message (with tool calls)
    { id, role: 'assistant', content, timestamp, stop_reason, tool_calls: [{ id, name, input }], metadata: { model, provider, tokens_used, latency_ms } }

    // Tool result message
    { id, role: 'tool', tool_call_id, tool_name, content, is_error, timestamp }
    ```
  - Files modified: `SessionManager.js`, `SessionController.js`, `CompletionController.js`, `server.js`
  - Files created: `Models/Message.js`

- **AI Scientific Agent Chat Service** (2026-01-29)
  - Created new `services/ai-agent/` microservice for AI-powered scientific writing assistance
  - Implemented Multi-Provider LLM Gateway with adapter pattern:
    - `DeepSeekAdapter` for DeepSeek models (Chat V3, Reasoner R1) - **Default Provider**
    - `AnthropicAdapter` for Claude models (Opus 4, Sonnet 4, Haiku 3.5)
    - `OllamaAdapter` for local models (Llama 3.2, Mistral, Qwen) - optional
  - Added infrastructure components:
    - `LLMGateway.js` - unified interface for all providers
    - `ProviderRegistry.js` - dynamic provider management
    - `CostTracker.js` - token usage and cost tracking per user/project
    - `ModelRouter.js` - intelligent model selection based on task type and tier
  - Added Feature controllers:
    - `CompletionController.js` - message handling and SSE streaming
    - `SessionController.js` - chat session management
    - `SkillController.js` - scientific skills (writing, LaTeX, research)
    - `HealthController.js` - service health endpoints
  - Added `SessionManager.js` for MongoDB session persistence
  - Configured `config/settings.defaults.cjs` with provider and rate limit settings
  - Added `ai-agent` service to docker-compose (Port 3020)
  - DeepSeek configured as default LLM provider via `DEEPSEEK_API_KEY` in `dev.env`
  - Ollama service optional (set `ENABLE_OLLAMA=true` to enable)
  - Added AI_AGENT environment variables to web service
  - **K-Dense Scientific Skills Integration (160+ Skills):**
    - Cloned `claude-scientific-writer` repository (22 writing skills)
    - Cloned `claude-scientific-skills` repository (141 scientific skills)
    - Repositories located at `services/ai-agent/lib/`
    - Created `Infrastructure/Skills/SkillLoader.js` - dynamic skill loading system:
      - Loads all SKILL.md files from both K-Dense repositories
      - Parses YAML frontmatter for metadata (name, description, tags)
      - Builds searchable index with keyword extraction
      - Automatic skill relevance matching based on user queries
    - Updated `SkillController.js` - dynamic skill endpoints:
      - `GET /skills` - list all 160+ skills with metadata
      - `GET /skills/search?q=` - semantic skill search
      - `GET /skill/:skillId` - get specific skill with full content
      - `GET /skill/:skillId/reference/:refName` - get skill reference docs
      - `GET /skills/categories` - get skill categories
    - Integrated SkillLoader into CompletionController for automatic skill context injection
    - Skill categories: bioinformatics, chemistry, clinical, imaging, writing, grants, latex
  - **Web Service Integration:**
    - `AIAgentApiHandler.mjs` - HTTP client for AI-Agent microservice
    - `AIAgentController.mjs` - Express route handlers
    - Added AI Agent routes to `router.mjs` (message, stream, session, skills endpoints)
  - **Frontend AI-Chat (SEPARATE from Team-Chat):**
    - `features/ai-chat/context/ai-chat-context.tsx` - state management
    - `features/ai-chat/components/ai-chat-pane.tsx` - main panel component
    - `features/ai-chat/components/ai-chat-header.tsx` - model selector
    - `features/ai-chat/components/ai-chat-messages.tsx` - message display
    - `features/ai-chat/components/ai-chat-input.tsx` - input field
    - `features/ai-chat/hooks/useAIStreaming.ts` - SSE streaming hook
    - `stylesheets/app/ai-chat.less` - styling (including dark mode)
  - **Document Editing with Apply Button:**
    - Created `features/ai-chat/hooks/useApplyToDocument.ts` - document editing hook
    - Functions: `applyToDocument`, `insertAtCursor`, `replaceSelection`, `appendToDocument`
    - Track Changes support: `insertWithTrackChanges`, `replaceWithTrackChanges`
    - Created `source-editor/extensions/expose-editor-view.ts` - CodeMirror access
    - Added Apply dropdown menu to AI-Chat message component
    - Options: Replace Selection, Insert at Cursor, Append, Insert as Comment
  - **Editor Rail Integration (New Editor):**
    - Added `ai-chat` to `RailTabKey` in `rail-context.tsx`
    - Created `ide-redesign/components/ai-chat/ai-chat-rail.tsx` - rail panel with streaming
    - Added AI Chat tab to rail with `smart_toy` icon
    - Created `stylesheets/app/ai-chat-rail.less` - rail-specific styling
  - **SSE Streaming:**
    - Real-time token streaming with EventSource
    - Stop button to cancel streaming
    - Visual streaming indicator
    - Token count display
  - **ProjectBridge - AI ↔ Overleaf File Access:**
    - Created `Infrastructure/ProjectBridge/ProjectBridge.js` - bridge for Overleaf file access
    - Functions: `getAllDocs`, `getDoc`, `upsertDoc`, `uploadFile`, `createFolder`, `deleteEntity`
    - Created `Features/Project/ProjectController.js` - REST API endpoints for file operations
    - New AI-Agent endpoints:
      - `GET /project/:id/agent/files` - list all project files
      - `GET /project/:id/agent/docs` - get all documents with content
      - `POST /project/:id/agent/doc` - create/update document
      - `POST /project/:id/agent/file` - upload file (base64)
      - `POST /project/:id/agent/folder` - create folder
      - `DELETE /project/:id/agent/entity/:entityId` - delete entity
    - Created `InternalProjectApiController.mjs` in web service for internal APIs
    - Added internal routes to `router.mjs` for AI-Agent to call
    - Enables K-Dense skills to read/write Overleaf project files
  - Files created: `services/ai-agent/`, `services/web/app/src/Features/AIAgent/`, `services/web/frontend/js/features/ai-chat/`, `services/web/frontend/js/features/ide-redesign/components/ai-chat/`
  - Reference: See `AGENT_CHAT_PLAN.md` for full implementation plan

- **Project Documentation** (2026-01-29)
  - Created `CHANGELOG.md` for tracking all project changes
  - Created `CLAUDE.md` with project guidelines, structure, and conventions
  - Added CLAUDE.md maintenance guidelines for keeping documentation current

- **Git Bridge Integration** (2026-01-29)
  - Added `git-bridge` service to `develop/docker-compose.yml`
  - Created `develop/git-bridge-config.json` configuration file
  - Added Git Bridge OAuth application to MongoDB
  - Modified `services/git-bridge/Dockerfile` to work with monorepo context
  - Added `GIT_BRIDGE_ENABLED`, `GIT_BRIDGE_HOST`, `GIT_BRIDGE_PORT` environment variables to web service
  - Added `enableGitBridge` and `gitBridgePublicBaseUrl` settings to `services/web/config/settings.defaults.js`

- **Review Panel / Track Changes** (2026-01-29)
  - Enabled `trackChangesAvailable: true` in `services/web/app/src/Features/Project/ProjectEditorHandler.mjs`
  - Set `trackChanges: true` in default features
  - Added `getThreads` endpoint to `services/web/app/src/Features/Chat/ChatController.mjs`
  - Added `/project/:project_id/threads` route to `services/web/app/src/router.mjs`
  - Added `/project/:project_id/changes/users` stub route (returns empty array for Community Edition)
  - Added `/project/:project_id/track_changes` POST endpoint for toggling track changes per user
  - Imports added: `EditorRealTimeController`, `Project` model in router.mjs
  - Added thread comment endpoints to ChatController and router:
    - `POST /project/:project_id/thread/:thread_id/messages` - send comment
    - `POST /project/:project_id/thread/:thread_id/messages/:message_id/edit` - edit comment
    - `DELETE /project/:project_id/thread/:thread_id/messages/:message_id` - delete comment
    - `POST /project/:project_id/thread/:thread_id/resolve` - resolve thread
    - `POST /project/:project_id/thread/:thread_id/reopen` - reopen thread
    - `DELETE /project/:project_id/thread/:thread_id` - delete thread
  - Added duplicate routes with `/doc/:doc_id/` path segment (used by review panel)

- **URL Linked Files** (2026-01-29)
  - Added `url` to `ENABLED_LINKED_FILE_TYPES` in `develop/docker-compose.yml`

### Changed

- **Redis Upgrade** (2026-01-29)
  - Upgraded Redis from version 5 to version 7 in `develop/docker-compose.yml`
  - Fixes `getdel` command not supported error

### Fixed

- **History Loading** (2026-01-29)
  - Added `useSubdirectories` configuration conversion in `services/history-v1/storage/lib/persistor.js`
  - Added `useSubdirectories` to `services/history-v1/config/custom-environment-variables.json`
  - Migrated existing blob/chunk files from flat to nested directory structure

- **Filestore/History-v1 Blob Storage** (2026-01-28)
  - Configured `USE_SUBDIRECTORIES=true` for history-v1 service
  - Set up shared volume `history-v1-buckets` between filestore and history-v1
  - Configured bucket paths for blobs, chunks, project_blobs, analytics, zips

- **CLSI TeX Live** (2026-01-28)
  - Created custom `services/clsi/Dockerfile.texlive` with full TeX Live installation
  - Enabled PDF compilation with pdflatex, xelatex, lualatex

## Notes

### Server Pro Features (Not Available)

The following integrations are proprietary Server Pro features and not available in Community Edition:
- GitHub OAuth Integration
- Dropbox Integration
- Mendeley Integration
- Zotero Integration
- Papers Integration

### Git Bridge Usage

```bash
# Clone a project
git clone http://localhost:8000/git/PROJECT_ID

# Authenticate with your Overleaf credentials
```

### Project Compiler Setting

If PDF compilation fails, check the project's compiler setting in the editor menu. Change from `latex` to `pdflatex` if needed.
