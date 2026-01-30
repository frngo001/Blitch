# Claude Code Guidelines for Overleaf Development

This document provides guidelines and context for Claude when working on this Overleaf Community Edition local development setup.

> **IMPORTANT:** When making changes to this project, always update:
> 1. `CHANGELOG.md` - Document all changes with dates and file references
> 2. `CLAUDE.md` (this file) - Update when adding features, services, or changing project structure

---

## 🤖 AI Scientific Agent Chat - WICHTIG

> **CRITICAL:** Vor der Implementierung von AI-Agent Features MUSS der Implementierungsplan gelesen werden!

### Pflichtlektüre

**Bevor du am AI-Chat oder Agent-Features arbeitest, lies:**

📄 **[AGENT_CHAT_PLAN.md](./AGENT_CHAT_PLAN.md)** - Vollständiger Implementierungsplan

### Wichtige Entscheidungen (bereits getroffen)

| Aspekt | Entscheidung |
|--------|--------------|
| **LLM-Provider** | Multi-Provider (Anthropic, OpenAI, Google, Ollama, Groq, etc.) |
| **Document Editing** | Apply Button + Track Changes Integration |
| **Lizenzmodell** | Freemium (Free → Pro €15 → Team €12/User) |
| **Chat-Architektur** | **SEPARATER** AI-Chat (nicht den Team-Chat erweitern!) |

### Kritische Architektur-Regeln

1. **AI-Chat ist SEPARAT vom Team-Chat**
   - Team-Chat: `services/web/frontend/js/features/chat/` → Bleibt unverändert
   - AI-Chat: `services/web/frontend/js/features/ai-chat/` → Neu erstellen
   - Verschiedene Collections: `messages` (Team) vs `ai_chat_sessions` (AI)

2. **Neuer Service: ai-agent**
   - Location: `services/ai-agent/`
   - Port: 3020
   - Enthält LLM Gateway mit Multi-Provider Support

3. **Frontend-Struktur**
   ```
   features/
   ├── chat/        # BESTEHEND - Team-Chat (NICHT ÄNDERN!)
   └── ai-chat/     # NEU - AI-Assistant-Chat
   ```

### Plan-Referenz nach Thema

| Wenn du arbeitest an... | Lies Abschnitt... |
|-------------------------|-------------------|
| LLM Gateway / Provider | 2.3, 4.1.2, 4.1.3 |
| Frontend AI-Chat | 4.1.3, 7.0-7.6 |
| Document Editing | 4.4 |
| Track Changes | 4.4.2, 4.4.4 |
| Datenbank Schema | 4.2 |
| API Endpoints | 4.3 |
| Docker Setup | 4.5, 4.6 |
| Freemium / Billing | 9.1-9.8 |
| Implementierungs-Phasen | 5, 10.3 |

---

## Project Overview

This is a local development setup for [Overleaf](https://github.com/overleaf/overleaf), the open-source online LaTeX editor. The setup uses Docker Compose to run all services locally.

## Directory Structure

```
overleaf/
├── develop/                    # Local development configuration
│   ├── docker-compose.yml      # Main Docker Compose configuration
│   ├── dev.env                 # Environment variables
│   ├── git-bridge-config.json  # Git Bridge configuration
│   └── webpack.config.dev-env.js
├── services/                   # Microservices
│   ├── ai-agent/               # 🤖 AI Scientific Agent Service (Port 3020)
│   │   ├── app/js/             # Main application code
│   │   │   ├── server.js       # Express server
│   │   │   ├── Infrastructure/ # Core infrastructure
│   │   │   │   ├── LLMGateway/ # Multi-provider LLM abstraction
│   │   │   │   └── Skills/     # Skill loading system
│   │   │   └── Features/       # Feature controllers
│   │   └── lib/                # External skill libraries
│   │       ├── claude-scientific-writer/   # 22 Writing Skills (K-Dense)
│   │       └── claude-scientific-skills/   # 141 Scientific Skills (K-Dense)
│   ├── chat/                   # Chat service (Team-Kollaboration)
│   ├── clsi/                   # Compile LaTeX Service Interface
│   ├── contacts/               # Contacts service
│   ├── docstore/               # Document storage
│   ├── document-updater/       # Real-time document updates
│   ├── filestore/              # File storage
│   ├── git-bridge/             # Git synchronization bridge
│   ├── history-v1/             # Version history service
│   ├── notifications/          # Notification service
│   ├── project-history/        # Project history tracking
│   ├── real-time/              # WebSocket real-time service
│   └── web/                    # Main web application
│       └── frontend/js/features/
│           ├── ai-chat/        # 🤖 AI Chat Frontend (NEU)
│           │   └── hooks/useApplyToDocument.ts
│           └── ide-redesign/components/ai-chat/
├── libraries/                  # Shared libraries
├── AGENT_CHAT_PLAN.md          # 🤖 AI Agent Implementierungsplan (WICHTIG!)
├── CHANGELOG.md                # Change log (MUST be updated)
└── CLAUDE.md                   # This file
```

## Key Configuration Files

### Docker Compose
- **Location:** `develop/docker-compose.yml`
- **Bestehende Services:** chat, clsi, contacts, docstore, document-updater, filestore, git-bridge, history-v1, mongo, notifications, project-history, real-time, redis, web, webpack
- **Neue Services (AI-Agent):** ai-agent (Port 3020), ollama (Port 11434), skill-worker

### Web Service Settings
- **Location:** `services/web/config/settings.defaults.js`
- **Purpose:** Default configuration for the web service
- **Key settings:** `defaultFeatures`, `enabledLinkedFileTypes`, `enableGitBridge`

### History-v1 Persistor
- **Location:** `services/history-v1/storage/lib/persistor.js`
- **Important:** Uses `useSubdirectories` for nested file storage

### AI-Agent Service (IMPLEMENTIERT ✅)
- **Location:** `services/ai-agent/`
- **Port:** 3020
- **Plan:** Siehe [AGENT_CHAT_PLAN.md](./AGENT_CHAT_PLAN.md) für vollständige Architektur

#### Architektur-Übersicht

```
services/ai-agent/
├── app/js/
│   ├── server.js                          # Express Server mit REST API & SSE
│   ├── mongodb.js                         # MongoDB connection & indexes
│   ├── Models/
│   │   └── Message.js                     # Message schema & helpers (tool calls)
│   ├── Infrastructure/
│   │   ├── LLMGateway/                    # Multi-Provider Abstraction
│   │   │   ├── LLMGateway.js              # Gateway Factory
│   │   │   └── providers/
│   │   │       ├── anthropic.js           # Claude Models
│   │   │       ├── openai.js              # GPT Models
│   │   │       ├── google.js              # Gemini Models
│   │   │       ├── ollama.js              # Local Models
│   │   │       └── groq.js                # Groq Models
│   │   └── Skills/
│   │       └── SkillLoader.js             # 160+ K-Dense Skills Loader
│   └── Features/
│       ├── Completion/                    # AI Completion & Streaming
│       │   └── CompletionController.js
│       ├── Session/                       # Chat Session & History Management
│       │   ├── SessionController.js       # REST endpoints for sessions
│       │   └── SessionManager.js          # MongoDB CRUD + history
│       ├── Skills/                        # Skills API Endpoints
│       │   └── SkillController.js
│       └── Health/
│           └── HealthController.js
└── lib/
    ├── claude-scientific-writer/          # 22 Writing Skills (K-Dense)
    └── claude-scientific-skills/          # 141 Scientific Skills (K-Dense)
```

#### K-Dense Scientific Skills (160+ Skills)

Die Skills werden automatisch aus zwei K-Dense Repositories geladen:

| Repository | Skills | Kategorien |
|------------|--------|------------|
| **claude-scientific-writer** | 22 | Writing, Grants, Posters, Clinical Reports |
| **claude-scientific-skills** | 141 | Bioinformatics, Chemistry, Clinical, Imaging, etc. |

**Skill-Kategorien:**
- `bioinformatics/` - Genomics, Proteomics, Systems Biology
- `chemistry/` - Computational Chemistry, Drug Design
- `clinical/` - Treatment Plans, Decision Support
- `imaging/` - Medical Imaging, Computer Vision
- `writing/` - Scientific Writing, Literature Review
- `grants/` - Research Proposals
- `latex/` - Posters, Slides, Templates

**Skill Loader System:**
```javascript
// Infrastructure/Skills/SkillLoader.js
import SkillLoader from '../../Infrastructure/Skills/SkillLoader.js'

// Get system prompt with relevant skills
const systemPrompt = SkillLoader.getAgentSystemPrompt(userQuery)

// Search for skills by query
const skills = SkillLoader.findRelevantSkills('drug discovery', 10)

// Get specific skill
const skill = SkillLoader.getSkill('hypothesis-generation')
```

#### API Endpoints

**Messages & Completion:**

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/project/:id/agent/message` | POST | Send message to AI agent |
| `/project/:id/agent/tool-results` | POST | Submit tool results (agentic loop) |
| `/project/:id/agent/stream` | GET | SSE streaming response |

**Session Management:**

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/project/:id/agent/session` | GET/POST/DELETE | Session CRUD |
| `/project/:id/agent/sessions` | GET | List user sessions |
| `/project/:id/agent/session/:sessionId/history` | GET | Get conversation history |
| `/project/:id/agent/session/:sessionId/tool-calls` | GET | Get tool calls with results |
| `/project/:id/agent/session/:sessionId/export` | GET | Export session as JSON |
| `/project/:id/agent/session/:sessionId/search` | GET | Search messages (?q=query) |
| `/project/:id/agent/session/:sessionId` | PATCH | Update session (title, model) |

**User & Provider:**

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/agent/user/stats` | GET | Get user statistics |
| `/agent/providers` | GET | List LLM providers |
| `/agent/models` | GET | List available models |

**Skills:**

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/project/:id/agent/skills` | GET | List all 160+ skills |
| `/project/:id/agent/skills/search` | GET | Search skills by query |
| `/project/:id/agent/skill/:skillId` | GET | Get specific skill |
| `/agent/skills/categories` | GET | Get skill categories |

**Project File Bridge (AI ↔ Overleaf Files):**

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/project/:id/agent/files` | GET | List all project files |
| `/project/:id/agent/docs` | GET | Get all documents with content |
| `/project/:id/agent/doc/:docId` | GET | Get single document |
| `/project/:id/agent/doc` | POST | Create/update document |
| `/project/:id/agent/doc/:docId` | PUT | Update existing document |
| `/project/:id/agent/file` | POST | Upload file (base64) |
| `/project/:id/agent/folder` | POST | Create folder |
| `/project/:id/agent/entity/:entityId` | DELETE | Delete doc/file/folder |
| `/project/:id/agent/structure` | GET | Get project structure |

**ProjectBridge Usage:**
```javascript
// Infrastructure/ProjectBridge/ProjectBridge.js
import { ProjectBridge } from '../../Infrastructure/ProjectBridge/ProjectBridge.js'

// Read all docs from project
const docs = await ProjectBridge.getAllDocs(projectId)

// Create/update a document
await ProjectBridge.upsertDoc(projectId, 'root', 'chapter1.tex', lines, userId)

// Upload generated figure
await ProjectBridge.uploadFile(projectId, 'figures', 'diagram.png', base64Content, userId)

// Create folder
await ProjectBridge.createFolder(projectId, 'root', 'figures', userId)
```

#### Message Schema (MongoDB)

**Session Document:**
```javascript
{
  _id: ObjectId,
  project_id: ObjectId,
  user_id: ObjectId,
  title: String,
  status: 'active' | 'archived',
  model_preference: { provider: String, model: String },
  messages: Array<Message>,
  total_tokens: { input: Number, output: Number },
  total_cost_usd: Number,
  message_count: Number,
  tool_call_count: Number,
  created_at: Date,
  updated_at: Date
}
```

**Message Types:**
```javascript
// User Message
{
  id: String,
  role: 'user',
  content: String,
  timestamp: Date,
  metadata: { document_context: Object }
}

// Assistant Message (with optional tool calls)
{
  id: String,
  role: 'assistant',
  content: String,
  timestamp: Date,
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens',
  tool_calls: [{           // Only if stop_reason === 'tool_use'
    id: String,
    type: 'function',
    name: String,
    input: Object
  }],
  metadata: {
    model: String,
    provider: String,
    tokens_used: { input: Number, output: Number },
    latency_ms: Number
  }
}

// Tool Result Message
{
  id: String,
  role: 'tool',
  tool_call_id: String,    // References tool_calls[].id
  tool_name: String,
  content: String,         // JSON stringified result
  is_error: Boolean,
  timestamp: Date
}
```

**Message Model Usage:**
```javascript
import {
  createUserMessage,
  createAssistantMessage,
  createToolResultMessage,
  convertToLLMFormat,
  MessageRole
} from '../../Models/Message.js'

// Create messages
const userMsg = createUserMessage('Help me with LaTeX', context)
const assistantMsg = createAssistantMessage(llmResponse)
const toolResult = createToolResultMessage(toolCallId, 'search', result)

// Convert for LLM API (handles tool_use/tool_result blocks)
const llmMessages = convertToLLMFormat(session.messages)
```

#### Umgebungsvariablen
```bash
# LLM Providers
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=...
DEEPSEEK_API_KEY=sk-...
OLLAMA_HOST=http://ollama:11434
GROQ_API_KEY=gsk_...

# MCP Integration
MCP_ENABLED=true
MCP_COMMAND=uvx
MCP_ARGS=claude-skills-mcp

# Business Model
STRIPE_SECRET_KEY=sk_...

# Service Config
AI_AGENT_PORT=3020
```

---

## 🔧 Vercel AI SDK Integration (PFLICHT!)

> **WICHTIG:** Bei Arbeiten am AI-Agent Service MUSS das Vercel AI SDK verwendet werden!

### Installierte Packages

| Package | Version | Zweck |
|---------|---------|-------|
| `ai` | ^4.0.0 | Vercel AI SDK Core - `generateText`, `streamText` |
| `@ai-sdk/deepseek` | ^1.0.0 | **Native DeepSeek Provider** (NICHT OpenAI-kompatibel!) |
| `@ai-sdk/anthropic` | ^1.0.0 | Claude Models |
| `@ai-sdk/google` | ^1.0.0 | Gemini Models |
| `zod` | ^3.23.0 | Schema Validation für Tool Definitions |

### DeepSeek mit AI SDK (Korrekte Verwendung)

```javascript
// ✅ RICHTIG - Native DeepSeek Provider
import { createDeepSeek } from '@ai-sdk/deepseek'
import { generateText, streamText } from 'ai'
import { z } from 'zod'

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY
})

// Mit Tool Calling
const result = await generateText({
  model: deepseek('deepseek-chat'),
  messages: [...],
  tools: {
    search: {
      description: 'Search for information',
      parameters: z.object({
        query: z.string().describe('Search query')
      })
    }
  },
  toolChoice: 'auto'
})

// ❌ FALSCH - OpenAI-kompatibel funktioniert NICHT
import { createOpenAI } from '@ai-sdk/openai'
const deepseek = createOpenAI({ baseURL: 'https://api.deepseek.com/v1' })
// Dies führt zu "Not Found" Fehlern!
```

### Verfügbare DeepSeek Modelle

| Modell | Beschreibung | Tool Support |
|--------|--------------|--------------|
| `deepseek-chat` | DeepSeek V3 - Schnell & günstig | ✅ Ja |
| `deepseek-reasoner` | DeepSeek R1 - Reasoning Model | ✅ Ja (V3.2+) |

### Tool/Function Calling mit Zod

```javascript
import { z } from 'zod'

// Tool Definition mit Zod Schema
const tools = {
  find_helpful_skills: {
    description: 'Find relevant skills for a task',
    parameters: z.object({
      query: z.string().describe('What you want to accomplish'),
      limit: z.number().optional().describe('Max results')
    })
  }
}

// Automatische Konvertierung von JSON Schema zu Zod
function jsonSchemaToZod(schema) {
  // Siehe DeepSeekAISDKAdapter.js für Implementation
}
```

### Dokumentation & Ressourcen

- **Vercel AI SDK Docs:** https://ai-sdk.dev/docs/introduction
- **DeepSeek Provider:** https://ai-sdk.dev/providers/ai-sdk-providers/deepseek
- **DeepSeek R1 Guide:** https://sdk.vercel.ai/docs/guides/r1
- **npm @ai-sdk/deepseek:** https://www.npmjs.com/package/@ai-sdk/deepseek

---

## 🛠️ Installierte Claude Code Skills (IMMER NUTZEN!)

> **KRITISCH:** Diese Skills sind installiert und MÜSSEN bei relevanten Aufgaben verwendet werden!

### Skill-Verzeichnis
```
~/.agents/skills/
└── ai-sdk/          # Vercel AI SDK Best Practices
```

### Pflicht-Skills

| Skill | Trigger | Wann nutzen |
|-------|---------|-------------|
| **ai-sdk** | AI SDK, LLM Integration, Tool Calling | Bei JEDER Arbeit am AI-Agent LLM Gateway |

### Skill-Nutzung

```bash
# Skills suchen
npx skills find "vercel ai sdk"

# Skill installieren
npx skills add vercel/ai@ai-sdk -g -y

# Installierte Skills prüfen
ls ~/.agents/skills/
```

### Wann Skills nutzen?

**IMMER wenn:**
- Am LLM Gateway gearbeitet wird → `ai-sdk` Skill
- Tool Calling implementiert wird → `ai-sdk` Skill
- Neue Provider hinzugefügt werden → `ai-sdk` Skill
- Streaming implementiert wird → `ai-sdk` Skill

**Skills finden für andere Aufgaben:**
```bash
npx skills find "react performance"  # Frontend Optimierung
npx skills find "testing"            # Test Patterns
npx skills find "docker"             # Container Patterns
```

---

## Development Commands

```bash
# Navigate to develop directory
cd develop

# Build a service
docker compose build <service-name>

# Start services
docker compose up -d

# View logs
docker compose logs <service-name>
docker compose logs --tail=50 <service-name>

# Restart a service
docker compose restart <service-name>

# Execute command in container
docker compose exec <service-name> <command>

# MongoDB shell
docker compose exec mongo mongosh sharelatex
```

## Important Conventions

### 1. Dockerfile Context
All Dockerfiles in `services/` use the repository root as context (`context: ..` in docker-compose.yml). COPY commands must use paths relative to the root:
```dockerfile
# Correct
COPY services/git-bridge/start.sh start.sh

# Incorrect (will fail)
COPY start.sh start.sh
```

### 2. Environment Variables
- Define in `develop/docker-compose.yml` under `environment:`
- Use `process.env.VAR_NAME` in settings files
- Boolean conversions: `process.env.VAR === 'true'`

### 3. Feature Flags
- Check `services/web/app/src/infrastructure/Features.mjs` for feature detection
- Features are controlled by settings and user subscription features
- Default features in `settings.defaults.js` under `defaultFeatures`

### 4. API Routes
- Routes defined in `services/web/app/src/router.mjs`
- Controllers in `services/web/app/src/Features/<Feature>/`
- Use `expressify()` wrapper for async handlers

### 5. MongoDB Operations
```javascript
// Add OAuth application
db.oauthApplications.updateOne(
  { id: "app-id" },
  { $set: { /* fields */ }},
  { upsert: true }
)

// Query projects
db.projects.find({ owner_ref: ObjectId("...") })
```

### 6. AI-Chat vs Team-Chat (KRITISCH!)

**NIEMALS den bestehenden Team-Chat für AI-Features verwenden!**

| Aspekt | Team-Chat | AI-Chat |
|--------|-----------|---------|
| **Pfad** | `features/chat/` | `features/ai-chat/` (NEU) |
| **Context** | `ChatContext` | `AIChatContext` |
| **Collection** | `messages`, `rooms` | `ai_chat_sessions` |
| **API** | `/project/:id/messages` | `/project/:id/agent/message` |
| **Sichtbarkeit** | Alle Teammitglieder | Privat pro User |

```javascript
// FALSCH - Bestehenden Chat erweitern
// features/chat/components/chat-pane.tsx
// ❌ NICHT hier AI-Features hinzufügen!

// RICHTIG - Neuen AI-Chat erstellen
// features/ai-chat/components/AIChatPanel.tsx
// ✅ Hier AI-Features implementieren
```

### 7. AI-Chat Frontend Architektur (IMPLEMENTIERT ✅)

#### Verzeichnisstruktur

```
services/web/frontend/js/features/
├── ai-chat/
│   ├── components/
│   │   └── ... (React Components)
│   ├── context/
│   │   └── ai-chat-context.tsx          # React Context
│   └── hooks/
│       └── useApplyToDocument.ts        # Apply to Editor Hook
├── ide-redesign/components/ai-chat/
│   └── ai-chat-rail.tsx                 # Main Chat UI in Editor
└── source-editor/extensions/
    └── expose-editor-view.ts            # CodeMirror EditorView Export
```

#### Document Editing mit Track Changes

Der `useApplyToDocument` Hook ermöglicht das Einfügen von AI-generierten Inhalten:

```typescript
// features/ai-chat/hooks/useApplyToDocument.ts
import { useApplyToDocument } from '../hooks/useApplyToDocument'

const {
  applyToDocument,      // Apply content (replacement)
  insertAtCursor,       // Insert at cursor position
  replaceSelection,     // Replace selected text
  appendToDocument,     // Append at end
  insertWithTrackChanges,   // Insert with Track Changes
  replaceWithTrackChanges,  // Replace with Track Changes
  getSelectedText,      // Get current selection
  getCursorInfo,        // Get cursor position
  isEditorAvailable,    // Check editor availability
  isApplying,           // Loading state
  lastApplyResult       // Result of last operation
} = useApplyToDocument()

// Usage
await insertWithTrackChanges(content, 'insert')
await replaceWithTrackChanges(selection, newContent, 'replace')
```

#### CodeMirror Integration

Der Editor wird über eine Extension global verfügbar gemacht:

```typescript
// source-editor/extensions/expose-editor-view.ts
import { getEditorView } from './expose-editor-view'

const view = getEditorView()
if (view) {
  // Direct CodeMirror operations
  view.dispatch({ changes: { from, to, insert: text } })
}
```

#### Apply Button Optionen

| Option | Funktion | Track Changes |
|--------|----------|---------------|
| **Replace Selection** | Ersetzt markierten Text | ✅ Ja |
| **Insert at Cursor** | Fügt an Cursor-Position ein | ✅ Ja |
| **Append to Document** | Fügt am Ende hinzu | ✅ Ja |
| **Insert as Comment** | Fügt als LaTeX-Kommentar ein | ❌ Nein |

#### SSE Streaming

Das Frontend nutzt Server-Sent Events für Echtzeit-Streaming:

```typescript
// SSE Connection
const eventSource = new EventSource(
  `/project/${projectId}/agent/stream?message=${encodeURIComponent(message)}`
)

eventSource.addEventListener('token', (e) => {
  const data = JSON.parse(e.data)
  // Update UI with streamed token
  setMessage(prev => prev + data.content)
})

eventSource.addEventListener('done', (e) => {
  const data = JSON.parse(e.data)
  // Handle completion
  eventSource.close()
})
```

## Known Limitations

### Server Pro Features (Not Available)
These are proprietary and cannot be enabled in Community Edition:
- GitHub OAuth Integration
- Dropbox Integration
- Mendeley/Zotero/Papers Integration
- Some advanced collaboration features

### Local Development Specifics
- Redis must be version 6.2+ (currently v7) for `getdel` command
- History-v1 uses filesystem storage with nested directories (`USE_SUBDIRECTORIES=true`)
- CLSI uses custom Dockerfile with TeX Live (`Dockerfile.texlive`)

## Changelog Maintenance

**CRITICAL:** Always update `CHANGELOG.md` when making changes:

1. Add entries under `## [Unreleased]`
2. Use categories: `### Added`, `### Changed`, `### Fixed`, `### Removed`
3. Include date in format (YYYY-MM-DD)
4. Reference modified files
5. Provide brief but clear descriptions

Example:
```markdown
### Added

- **Feature Name** (2026-01-29)
  - Description of what was added
  - Files modified: `path/to/file.js`
```

## CLAUDE.md Maintenance

**CRITICAL:** This file (`CLAUDE.md`) must also be kept up-to-date:

### When to Update

1. **New Feature Added**
   - Add to "Key Configuration Files" if new config files created
   - Add to "Known Limitations" if feature has restrictions
   - Add to "Troubleshooting" if common issues expected

2. **New Service Added**
   - Update "Directory Structure" tree
   - Add service to Docker Compose services list
   - Document any new conventions or configurations

3. **AI-Agent Features**
   - Update `AGENT_CHAT_PLAN.md` für Architektur-Änderungen
   - Update dieses Dokument wenn neue Services/Conventions hinzugefügt werden
   - Dokumentiere neue LLM-Provider in der Provider-Tabelle

3. **Structure Changes**
   - Update "Directory Structure" section
   - Update file paths in examples

4. **New Conventions Established**
   - Add to "Important Conventions" section
   - Provide code examples

5. **New Environment Variables**
   - Document in relevant configuration section

### Update Checklist

When making significant changes, verify:
- [ ] Directory structure is accurate
- [ ] All services listed in Docker Compose section
- [ ] Key configuration files documented
- [ ] New conventions explained with examples
- [ ] Troubleshooting section covers new potential issues

## Troubleshooting

### PDF Compilation Fails
- Check CLSI logs: `docker compose logs clsi`
- Verify compiler setting (pdflatex vs latex)
- Ensure TeX Live is installed in CLSI container

### History Not Loading
- Verify `USE_SUBDIRECTORIES=true` in history-v1 environment
- Check if files need migration from flat to nested structure
- Check history-v1 logs: `docker compose logs history-v1`

### Redis Command Errors
- Ensure Redis version is 6.2 or higher
- Check: `docker compose logs redis`

### Service Connection Issues
- Verify all services are running: `docker compose ps`
- Check service dependencies in docker-compose.yml
- Ensure internal hostnames match service names

### AI-Agent Troubleshooting

#### Skills Not Loading
- Verify K-Dense repositories are cloned:
  ```bash
  ls services/ai-agent/lib/claude-scientific-writer/skills/
  ls services/ai-agent/lib/claude-scientific-skills/skills/
  ```
- Check SkillLoader logs: `docker compose logs ai-agent | grep -i skill`
- Ensure SKILL.md files have valid YAML frontmatter

#### LLM Provider Connection Failed
- Check API keys are set in environment:
  ```bash
  docker compose exec ai-agent env | grep -E "(ANTHROPIC|OPENAI|GOOGLE|GROQ)"
  ```
- Verify provider is available: `curl http://localhost:3020/agent/providers`
- For Ollama: Check `docker compose logs ollama`

#### SSE Streaming Issues
- Verify nginx buffering is disabled (`X-Accel-Buffering: no`)
- Check browser console for EventSource errors
- Test endpoint directly:
  ```bash
  curl -N "http://localhost:3020/project/test/agent/stream?message=hello"
  ```

#### Apply Button Not Working
- Check CodeMirror EditorView is exposed:
  ```javascript
  // Browser console
  window.__editorView // Should not be undefined
  ```
- Verify Track Changes mode is active if using TC functions
- Check browser console for insertion errors

#### Session Not Persisting
- Check MongoDB connection: `docker compose logs mongo`
- Verify `ai_chat_sessions` collection exists:
  ```bash
  docker compose exec mongo mongosh sharelatex --eval "db.ai_chat_sessions.find().limit(1)"
  ```

## Code Style

- JavaScript/TypeScript: Follow existing patterns in codebase
- Use async/await for asynchronous operations
- Express handlers should use `expressify()` wrapper
- Prefer `.mjs` extension for ES modules

## Testing Changes

After making changes:
1. Rebuild affected service: `docker compose build <service>`
2. Restart service: `docker compose up -d <service>`
3. Check logs for errors: `docker compose logs <service>`
4. Test functionality in browser at `http://localhost`
