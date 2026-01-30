# AI Scientific Agent Chat für Overleaf

## Umfassender Implementierungsplan

**Erstellt:** 2026-01-29
**Status:** Planung
**Aktualisiert:** 2026-01-29

### Getroffene Entscheidungen

| Entscheidung | Wahl | Begründung |
|--------------|------|------------|
| **LLM-Provider** | Multi-Provider (Auswählbar) | Flexibilität, Kostenoptimierung, Vendor-Unabhängigkeit |
| **Document Editing** | Apply-Button + Track Changes | Vollständige Integration, professioneller Workflow |
| **Lizenzmodell** | Freemium | Breite Nutzerbasis, Upselling-Potenzial |

---

## 1. Executive Summary

Dieses Dokument beschreibt die Integration eines KI-gestützten wissenschaftlichen Agenten in das Overleaf Chat-System. Der Agent kombiniert die Fähigkeiten von:

- **claude-scientific-skills**: 140 wissenschaftliche Skills für Bioinformatik, Cheminformatik, klinische Forschung, Multi-Omics
- **claude-scientific-writer**: Wissenschaftliches Schreiben mit LaTeX-Unterstützung, Paper-Generierung, Peer-Review

---

## 2. Architektur-Übersicht

### 2.1 Bestehende Chat-Architektur (Overleaf)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │ ChatContext │  │ MessageList  │  │ MessageInput            │ │
│  │ (State)     │  │ (UI)         │  │ (Eingabe)               │ │
│  └──────┬──────┘  └──────────────┘  └─────────────────────────┘ │
│         │                                                        │
│         │ Socket.IO (Echtzeit-Events)                           │
└─────────┼───────────────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────────────┐
│                        Web Service                               │
│  ┌─────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │ ChatController  │  │ ChatApiHandler │  │ EditorRealTime   │  │
│  │ (Routes)        │  │ (HTTP Client)  │  │ (Redis Pub/Sub)  │  │
│  └────────┬────────┘  └───────┬────────┘  └────────┬─────────┘  │
└───────────┼───────────────────┼────────────────────┼────────────┘
            │                   │                    │
┌───────────▼───────────────────▼────────────────────▼────────────┐
│                    Microservices Layer                           │
│  ┌─────────────┐  ┌────────────────┐  ┌─────────────────────┐   │
│  │ Chat Service│  │ Real-time      │  │ Redis               │   │
│  │ (Port 3010) │  │ Service        │  │ (Pub/Sub)           │   │
│  └──────┬──────┘  └────────────────┘  └─────────────────────┘   │
│         │                                                        │
│  ┌──────▼──────┐                                                │
│  │ MongoDB     │                                                │
│  │ (messages,  │                                                │
│  │  rooms)     │                                                │
│  └─────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Neue Architektur mit AI Agent

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────────────┐ │
│  │ ChatContext │  │ AgentPanel   │  │ MessageInput                    │ │
│  │ + AgentCtx  │  │ (Skills UI)  │  │ + @agent Trigger                │ │
│  └──────┬──────┘  └──────────────┘  └─────────────────────────────────┘ │
│         │                                                                │
│         │ Socket.IO + Agent Events                                      │
└─────────┼───────────────────────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────────────────────┐
│                        Web Service                                       │
│  ┌─────────────────┐  ┌────────────────┐  ┌────────────────────────┐    │
│  │ ChatController  │  │ AgentController│  │ AgentOrchestrator     │    │
│  │ (erweitert)     │  │ (NEU)          │  │ (Skill-Routing)       │    │
│  └────────┬────────┘  └───────┬────────┘  └───────────┬───────────┘    │
└───────────┼───────────────────┼───────────────────────┼─────────────────┘
            │                   │                       │
┌───────────▼───────────────────▼───────────────────────▼─────────────────┐
│                    Microservices Layer                                   │
│  ┌─────────────┐  ┌────────────────────┐  ┌─────────────────────────┐   │
│  │ Chat Service│  │ AI-Agent Service   │  │ Skill Workers           │   │
│  │ (Port 3010) │  │ (NEU - Port 3020)  │  │ (Python/UV)             │   │
│  └──────┬──────┘  └─────────┬──────────┘  └──────────┬──────────────┘   │
│         │                   │                        │                   │
│  ┌──────▼──────┐     ┌──────▼──────────┐    ┌───────▼──────────────┐   │
│  │ MongoDB     │     │ LLM Gateway     │    │ Scientific DBs       │   │
│  │ + agent_    │     │ (Multi-Provider)│    │ (PubMed, ChEMBL,    │   │
│  │   sessions  │     └────────┬────────┘    │  UniProt, etc.)      │   │
│  └─────────────┘              │             └──────────────────────┘   │
│                    ┌──────────┼──────────┐                             │
│                    ▼          ▼          ▼                             │
│              ┌─────────┐ ┌─────────┐ ┌─────────┐                       │
│              │Anthropic│ │ OpenAI  │ │ Ollama  │  ... weitere          │
│              │ Claude  │ │GPT-4/o1 │ │ (lokal) │                       │
│              └─────────┘ └─────────┘ └─────────┘                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Multi-Provider LLM Gateway

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        LLM Gateway Service                               │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     Provider Abstraction Layer                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │   │
│  │  │ UnifiedAPI  │  │ ModelRouter │  │ CostTracker │               │   │
│  │  │ Interface   │  │ (Selection) │  │ (Metering)  │               │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘               │   │
│  └─────────┼────────────────┼────────────────┼──────────────────────┘   │
│            │                │                │                          │
│  ┌─────────▼────────────────▼────────────────▼──────────────────────┐   │
│  │                        Provider Adapters                          │   │
│  │                                                                    │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐     │   │
│  │  │ Anthropic  │ │  OpenAI    │ │  Google    │ │  Ollama    │     │   │
│  │  │  Adapter   │ │  Adapter   │ │  Adapter   │ │  Adapter   │     │   │
│  │  │            │ │            │ │            │ │            │     │   │
│  │  │ • Claude 4 │ │ • GPT-4o   │ │ • Gemini   │ │ • Llama3   │     │   │
│  │  │ • Sonnet   │ │ • GPT-4    │ │ • Gemini   │ │ • Mistral  │     │   │
│  │  │ • Haiku    │ │ • o1       │ │   Pro      │ │ • Qwen     │     │   │
│  │  │            │ │ • o3-mini  │ │ • Flash    │ │ • DeepSeek │     │   │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘     │   │
│  │                                                                    │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐                    │   │
│  │  │ Groq       │ │ Together   │ │ OpenRouter │                    │   │
│  │  │  Adapter   │ │  Adapter   │ │  Adapter   │                    │   │
│  │  │            │ │            │ │            │                    │   │
│  │  │ • Llama    │ │ • Mixtral  │ │ • Any      │                    │   │
│  │  │ • Mixtral  │ │ • Llama    │ │   Model    │                    │   │
│  │  └────────────┘ └────────────┘ └────────────┘                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Feature-Analyse

### 3.1 Kern-Features (MVP)

| Feature | Beschreibung | Priorität |
|---------|--------------|-----------|
| **Agent-Aktivierung** | `@agent` Mention im Chat aktiviert AI | P0 |
| **Kontextbewusstsein** | Agent hat Zugriff auf aktuelles LaTeX-Dokument | P0 |
| **Streaming-Antworten** | Echtzeit-Token-Streaming im Chat | P0 |
| **Basis-Schreibhilfe** | Absätze verbessern, umformulieren | P0 |
| **LaTeX-Generierung** | Code-Snippets, Formeln, Tabellen | P0 |

### 3.2 Scientific Skills (claude-scientific-skills)

| Kategorie | Skills | Use Cases |
|-----------|--------|-----------|
| **Bioinformatik** | Sequenzanalyse, scRNA-seq, Phylogenetik | Biologische Papers |
| **Cheminformatik** | Molekül-Docking, ADMET, SAR | Chemie/Pharma Papers |
| **Klinische Forschung** | Varianten-Interpretation, Pharmakogenomik | Medizinische Papers |
| **Datenanalyse** | Statistik, Visualisierung, Netzwerke | Alle Wissenschaften |
| **Multi-Omics** | Datenintegration, Pathway-Analyse | Systembiologie |

### 3.3 Scientific Writer (claude-scientific-writer)

| Feature | Beschreibung | Integration |
|---------|--------------|-------------|
| **Paper-Struktur** | IMRaD (Nature, Science, NeurIPS) | Template-Vorschläge |
| **LaTeX-Poster** | beamerposter, tikzposter | Poster-Generierung |
| **Grant-Proposals** | NSF, NIH, DOE Formate | Grant-Schreiben |
| **Peer-Review** | ScholarEval 8-Dimensionen | Feedback-System |
| **Zitationen** | BibTeX-Management | Referenz-Hilfe |
| **Diagramme** | Wissenschaftliche Schemata | Figur-Generierung |

### 3.4 Erweiterte Features (Phase 2+)

| Feature | Beschreibung | Priorität |
|---------|--------------|-----------|
| **Dokumenten-Review** | Gesamtes Paper analysieren | P1 |
| **Literatur-Recherche** | PubMed, OpenAlex Integration | P1 |
| **Abbildungs-Generierung** | Plots, Diagramme direkt im Editor | P1 |
| **Kollaboratives Editing** | Agent-Vorschläge mit Track Changes | P2 |
| **Multi-Agent-Workflows** | Verkettete Aufgaben | P2 |
| **Custom Skills** | Benutzer-definierte Skills | P3 |

---

## 4. Technische Implementierung

### 4.1 Neue Services und Komponenten

#### 4.1.1 AI-Agent Service (Backend)

```
services/
└── ai-agent/
    ├── Dockerfile
    ├── package.json
    ├── app/
    │   └── js/
    │       ├── server.js
    │       ├── AgentManager.js
    │       ├── SkillRegistry.js
    │       ├── Features/
    │       │   ├── Completion/
    │       │   │   ├── CompletionController.js
    │       │   │   └── CompletionManager.js
    │       │   ├── Skills/
    │       │   │   ├── SkillLoader.js
    │       │   │   └── SkillExecutor.js
    │       │   ├── Context/
    │       │   │   ├── DocumentContext.js
    │       │   │   └── ProjectContext.js
    │       │   └── DocumentEdit/           # NEU: Document Editing
    │       │       ├── EditController.js
    │       │       ├── TrackChangesManager.js
    │       │       └── DiffGenerator.js
    │       └── Infrastructure/
    │           ├── LLMGateway/             # NEU: Multi-Provider
    │           │   ├── LLMGateway.js       # Unified Interface
    │           │   ├── ProviderRegistry.js
    │           │   ├── ModelRouter.js
    │           │   ├── CostTracker.js
    │           │   └── adapters/
    │           │       ├── AnthropicAdapter.js
    │           │       ├── OpenAIAdapter.js
    │           │       ├── GoogleAdapter.js
    │           │       ├── OllamaAdapter.js
    │           │       ├── GroqAdapter.js
    │           │       ├── TogetherAdapter.js
    │           │       └── OpenRouterAdapter.js
    │           └── StreamHandler.js
    └── skills/
        ├── scientific/      # von claude-scientific-skills
        └── writer/          # von claude-scientific-writer
```

#### 4.1.2 LLM Gateway - Unified Interface

```javascript
// services/ai-agent/app/js/Infrastructure/LLMGateway/LLMGateway.js

class LLMGateway {
  constructor(config) {
    this.providers = new Map();
    this.defaultProvider = config.defaultProvider || 'anthropic';
    this.costTracker = new CostTracker();
  }

  // Einheitliche API für alle Provider
  async complete(request) {
    const { provider, model, messages, options } = request;
    const adapter = this.getAdapter(provider);

    // Normalisiere Request für Provider
    const normalizedRequest = adapter.normalizeRequest({
      model,
      messages,
      ...options
    });

    // Führe Completion aus
    const response = await adapter.complete(normalizedRequest);

    // Tracke Kosten
    this.costTracker.track({
      provider,
      model,
      tokens: response.usage,
      userId: request.userId
    });

    return adapter.normalizeResponse(response);
  }

  // Streaming für Echtzeit-Antworten
  async *stream(request) {
    const adapter = this.getAdapter(request.provider);
    for await (const chunk of adapter.stream(request)) {
      yield adapter.normalizeChunk(chunk);
    }
  }

  // Modell-Empfehlung basierend auf Task
  recommendModel(taskType, userTier) {
    const recommendations = {
      'simple-edit': { provider: 'anthropic', model: 'claude-3-5-haiku' },
      'scientific-analysis': { provider: 'anthropic', model: 'claude-sonnet-4' },
      'complex-reasoning': { provider: 'anthropic', model: 'claude-opus-4' },
      'fast-local': { provider: 'ollama', model: 'llama3.2' },
      'cost-optimized': { provider: 'groq', model: 'llama-3.3-70b' }
    };

    // Freemium-Einschränkungen
    if (userTier === 'free') {
      return { provider: 'anthropic', model: 'claude-3-5-haiku' };
    }

    return recommendations[taskType] || recommendations['simple-edit'];
  }
}
```

#### 4.1.3 Provider Adapter Interface

```javascript
// services/ai-agent/app/js/Infrastructure/LLMGateway/adapters/BaseAdapter.js

class BaseAdapter {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
  }

  // Muss von jedem Adapter implementiert werden
  async complete(request) { throw new Error('Not implemented'); }
  async *stream(request) { throw new Error('Not implemented'); }

  // Normalisierung für einheitliches Format
  normalizeRequest(request) { return request; }
  normalizeResponse(response) { return response; }
  normalizeChunk(chunk) { return chunk; }

  // Modell-spezifische Informationen
  getModelInfo(modelId) {
    return this.models[modelId] || null;
  }

  // Kosten-Kalkulation
  calculateCost(usage) {
    const model = this.getModelInfo(usage.model);
    return {
      inputCost: (usage.inputTokens / 1_000_000) * model.inputPrice,
      outputCost: (usage.outputTokens / 1_000_000) * model.outputPrice,
      total: 0 // Berechnet
    };
  }
}
```

#### 4.1.4 Unterstützte Provider und Modelle

| Provider | Modelle | Stärken | Freemium |
|----------|---------|---------|----------|
| **Anthropic** | Claude Opus 4, Sonnet 4, Haiku 3.5 | Beste Qualität, wissenschaftliches Schreiben | Haiku nur |
| **OpenAI** | GPT-4o, GPT-4, o1, o3-mini | Breite Unterstützung, Function Calling | - |
| **Google** | Gemini 2.0 Pro, Flash | Lange Kontextfenster (1M tokens) | Flash nur |
| **Ollama** | Llama 3.3, Mistral, Qwen, DeepSeek | Lokal, Datenschutz, kostenlos | Alle |
| **Groq** | Llama 3.3, Mixtral | Ultra-schnell, günstig | Limitiert |
| **Together** | Mixtral, Llama, Code-Modelle | Günstig, viele Modelle | - |
| **OpenRouter** | Alle Modelle | Fallback, Routing | - |

#### 4.1.5 Web Service Erweiterungen

```
services/web/app/src/Features/
└── AIAgent/
    ├── AIAgentController.mjs
    ├── AIAgentApiHandler.mjs
    ├── AIAgentManager.mjs
    └── AIAgentRouter.mjs
```

#### 4.1.3 Frontend Komponenten (Separater AI-Chat)

**Wichtig:** Der AI-Chat ist ein eigenständiges Feature, komplett getrennt vom bestehenden Team-Chat (`services/web/frontend/js/features/chat/`).

```
services/web/frontend/js/features/
├── chat/                         # BESTEHEND: Team-Kollaborations-Chat
│   ├── context/
│   │   └── chat-context.tsx      # Unverändert - für Team-Nachrichten
│   └── components/
│       ├── chat-pane.tsx         # Unverändert
│       └── message-list.tsx      # Unverändert
│
└── ai-chat/                      # NEU: Separater AI-Assistant-Chat
    ├── context/
    │   ├── ai-chat-context.tsx   # State für AI-Konversation
    │   └── model-context.tsx     # Ausgewähltes LLM-Modell
    ├── components/
    │   ├── AIChatPanel.tsx       # Haupt-Container (linke Sidebar)
    │   ├── AIChatHeader.tsx      # Model-Selector, Settings
    │   ├── AIChatMessages.tsx    # Nachrichtenliste
    │   ├── AIChatMessage.tsx     # Einzelne Nachricht
    │   ├── AIChatInput.tsx       # Eingabefeld + Attach Selection
    │   ├── QuickActions.tsx      # Improve, Expand, Cite, etc.
    │   ├── SkillSelector.tsx     # Skill-Auswahl Modal
    │   ├── ModelSelector.tsx     # LLM-Modell-Auswahl
    │   ├── StreamingResponse.tsx # Streaming-Animation
    │   ├── AgentThinking.tsx     # Loading-Indicator
    │   ├── ApplyDropdown.tsx     # Apply Direct / Track Changes
    │   └── FloatingButton.tsx    # Minimierter AI-Button
    ├── hooks/
    │   ├── useAIChat.ts          # AI-Chat State Management
    │   ├── useDocumentContext.ts # Editor-Selection
    │   ├── useSkills.ts          # Verfügbare Skills
    │   ├── useModel.ts           # Model-Auswahl
    │   └── useStreaming.ts       # SSE-Streaming
    └── utils/
        ├── ai-chat-api.ts        # API-Calls zum AI-Agent Service
        ├── skill-utils.ts        # Skill-Kategorisierung
        └── context-utils.ts      # Dokument-Kontext Extraktion
```

#### 4.1.4 Trennung der Chat-Systeme

| Aspekt | Team-Chat (bestehend) | AI-Chat (neu) |
|--------|----------------------|---------------|
| **Context** | `ChatContext` | `AIChatContext` |
| **API** | `/project/:id/messages` | `/project/:id/agent/message` |
| **WebSocket** | `new-chat-message` | `ai-chat-token`, `ai-chat-done` |
| **Storage** | `messages` Collection | `agent_sessions` Collection |
| **Sichtbarkeit** | Alle Projektmitglieder | Nur der eigene User |
| **Position UI** | Rechte Sidebar | Linke Sidebar / Modal |

### 4.2 Datenbank-Schema (Separater AI-Chat)

**Wichtig:** Der AI-Chat verwendet eigene Collections, komplett getrennt vom Team-Chat.

```javascript
// ============================================================
// TEAM-CHAT (BESTEHEND - UNVERÄNDERT)
// Collections: messages, rooms
// Für Kollaboration zwischen Teammitgliedern
// ============================================================

// ============================================================
// AI-CHAT (NEU - SEPARATE COLLECTIONS)
// ============================================================

// Neue Collection: ai_chat_sessions
// Speichert AI-Konversationen pro User pro Projekt
{
  _id: ObjectId,
  project_id: ObjectId,
  user_id: ObjectId,              // AI-Chat ist privat pro User!
  created_at: Date,
  updated_at: Date,
  title: String,                  // Auto-generiert aus erster Nachricht
  model_preference: {
    provider: String,             // 'anthropic', 'openai', etc.
    model: String                 // 'claude-3-5-haiku', etc.
  },
  messages: [
    {
      id: String,
      role: 'user' | 'assistant' | 'system',
      content: String,
      timestamp: Date,
      metadata: {
        skill_used: String,
        tokens_used: { input: Number, output: Number },
        cost_usd: Number,
        model_used: String,
        document_context: {
          doc_id: ObjectId,
          doc_name: String,
          selection: {
            start_line: Number,
            end_line: Number,
            text_preview: String    // Erste 100 Zeichen
          }
        },
        applied_to_document: Boolean,
        track_change_id: ObjectId
      }
    }
  ],
  status: 'active' | 'archived',
  total_tokens: Number,
  total_cost_usd: Number
}

// Neue Collection: ai_chat_quick_actions
// User-spezifische Quick-Action Konfiguration
{
  _id: ObjectId,
  user_id: ObjectId,
  project_id: ObjectId,           // Optional: projekt-spezifisch
  actions: [
    {
      id: String,
      label: String,              // "Improve"
      prompt_template: String,    // "Improve the following text: {selection}"
      skill: String,              // 'scientific-writing'
      icon: String,               // 'pencil'
      order: Number
    }
  ]
}

// Neue Collection: agent_skills
{
  _id: ObjectId,
  name: String,
  category: String,               // 'writing', 'latex', 'scientific', 'research'
  description: String,
  tier_required: 'free' | 'pro' | 'team' | 'enterprise',
  enabled: Boolean,
  config: Object,
  usage_count: Number
}

// Keine Änderung an der bestehenden messages Collection!
// Team-Chat und AI-Chat sind vollständig getrennt.
```

### 4.2.1 Vergleich: Team-Chat vs AI-Chat Datenmodell

| Aspekt | Team-Chat | AI-Chat |
|--------|-----------|---------|
| **Collection** | `messages`, `rooms` | `ai_chat_sessions` |
| **Sichtbarkeit** | Alle Projektmitglieder | Nur eigener User |
| **Persistenz** | Permanent | Archivierbar |
| **Nachrichten-Struktur** | Einfach (content, user, timestamp) | Reich (metadata, context, cost) |
| **Kontext** | Kein Dokument-Kontext | Dokument-Selection, Line-Numbers |
| **Tokens/Kosten** | Nicht relevant | Wird getrackt |

### 4.3 API-Endpunkte

#### Agent-Endpunkte (Neue Routes)

| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| POST | `/project/:id/agent/message` | Nachricht an Agent senden |
| GET | `/project/:id/agent/session` | Aktuelle Session abrufen |
| POST | `/project/:id/agent/session` | Neue Session starten |
| DELETE | `/project/:id/agent/session` | Session beenden |
| GET | `/project/:id/agent/skills` | Verfügbare Skills auflisten |
| POST | `/project/:id/agent/skill/:skill/execute` | Skill direkt ausführen |
| GET | `/project/:id/agent/context` | Dokument-Kontext abrufen |

#### Streaming-Endpunkt (SSE)

```
GET /project/:id/agent/stream
Content-Type: text/event-stream

event: token
data: {"content": "Das", "done": false}

event: token
data: {"content": " ist", "done": false}

event: skill
data: {"skill": "latex-table", "status": "executing"}

event: done
data: {"tokens_used": 150, "skill_used": "scientific-writing"}
```

### 4.4 Document Editing System

#### 4.4.1 Übersicht

Der Agent kann Dokumente auf zwei Arten editieren:

1. **Apply Button** - Einmaliges Einfügen/Ersetzen von Text
2. **Track Changes** - Integrierte Änderungsverfolgung mit Accept/Reject

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Document Editing Flow                                │
│                                                                          │
│  User Request          Agent Response           Document Action          │
│  ────────────          ──────────────           ───────────────          │
│                                                                          │
│  "@agent improve       ┌──────────────────┐                              │
│   this paragraph"  →   │ Improved text... │                              │
│                        │                  │                              │
│                        │ [Copy] [Apply▼]  │                              │
│                        └────────┬─────────┘                              │
│                                 │                                        │
│                    ┌────────────┴────────────┐                          │
│                    ▼                         ▼                          │
│           ┌───────────────┐        ┌───────────────┐                    │
│           │ Apply Direct  │        │ Track Changes │                    │
│           │ (Replace)     │        │ (Review Mode) │                    │
│           └───────┬───────┘        └───────┬───────┘                    │
│                   │                        │                            │
│                   ▼                        ▼                            │
│           ┌───────────────┐        ┌───────────────────────┐            │
│           │ Text replaced │        │ Changes highlighted   │            │
│           │ immediately   │        │ ───────────────────── │            │
│           └───────────────┘        │ Old: [strikethrough]  │            │
│                                    │ New: [green highlight]│            │
│                                    │                       │            │
│                                    │ [Accept] [Reject]     │            │
│                                    └───────────────────────┘            │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 4.4.2 Track Changes Integration

```javascript
// services/ai-agent/app/js/Features/DocumentEdit/TrackChangesManager.js

class TrackChangesManager {
  constructor(projectId, docId) {
    this.projectId = projectId;
    this.docId = docId;
  }

  // Erstellt einen Track Change Eintrag
  async createChange(change) {
    const {
      originalText,
      newText,
      position,      // { start: line, end: line }
      userId,
      agentSessionId,
      changeType     // 'replace' | 'insert' | 'delete'
    } = change;

    // Generiere Diff
    const diff = this.generateDiff(originalText, newText);

    // Erstelle Track Change im Overleaf-Format
    const trackChange = {
      id: generateId(),
      op: {
        p: position.start,
        d: changeType === 'delete' ? originalText : undefined,
        i: changeType === 'insert' ? newText : undefined,
      },
      metadata: {
        user_id: userId,
        ts: new Date(),
        agent_generated: true,
        agent_session_id: agentSessionId
      }
    };

    // Speichere und broadcaste
    await this.saveChange(trackChange);
    await this.broadcastChange(trackChange);

    return trackChange;
  }

  // Akzeptiert eine Änderung
  async acceptChange(changeId) {
    const change = await this.getChange(changeId);
    await this.applyChange(change);
    await this.markChangeAccepted(changeId);

    EditorRealTimeController.emitToRoom(
      this.projectId,
      'accept-agent-change',
      { docId: this.docId, changeId }
    );
  }

  // Lehnt eine Änderung ab
  async rejectChange(changeId) {
    await this.markChangeRejected(changeId);

    EditorRealTimeController.emitToRoom(
      this.projectId,
      'reject-agent-change',
      { docId: this.docId, changeId }
    );
  }

  // Batch-Operationen
  async acceptAllChanges(sessionId) {
    const changes = await this.getChangesBySession(sessionId);
    for (const change of changes) {
      await this.acceptChange(change.id);
    }
  }

  async rejectAllChanges(sessionId) {
    const changes = await this.getChangesBySession(sessionId);
    for (const change of changes) {
      await this.rejectChange(change.id);
    }
  }
}
```

#### 4.4.3 Frontend Components für Document Editing

```typescript
// services/web/frontend/js/features/ai-agent/components/AgentEditActions.tsx

interface AgentEditActionsProps {
  content: string;
  originalContent?: string;
  docId: string;
  position: { start: number; end: number };
}

const AgentEditActions: React.FC<AgentEditActionsProps> = ({
  content,
  originalContent,
  docId,
  position
}) => {
  const [applyMode, setApplyMode] = useState<'direct' | 'track'>('track');
  const { applyEdit, createTrackChange } = useDocumentEdit();

  const handleApply = async () => {
    if (applyMode === 'direct') {
      await applyEdit({
        docId,
        position,
        newContent: content
      });
      showNotification('Text wurde eingefügt');
    } else {
      await createTrackChange({
        docId,
        position,
        originalText: originalContent,
        newText: content
      });
      showNotification('Änderung zur Review hinzugefügt');
    }
  };

  return (
    <div className="agent-edit-actions">
      <button onClick={() => copyToClipboard(content)}>
        <CopyIcon /> Copy
      </button>

      <DropdownButton label="Apply">
        <DropdownItem
          onClick={() => { setApplyMode('direct'); handleApply(); }}
        >
          <ReplaceIcon /> Apply Direct (Replace)
        </DropdownItem>
        <DropdownItem
          onClick={() => { setApplyMode('track'); handleApply(); }}
        >
          <TrackChangesIcon /> Apply with Track Changes
        </DropdownItem>
        <DropdownItem
          onClick={() => insertAtCursor(content)}
        >
          <InsertIcon /> Insert at Cursor
        </DropdownItem>
      </DropdownButton>
    </div>
  );
};
```

#### 4.4.4 Track Changes UI im Editor

```
┌─────────────────────────────────────────────────────────────────────────┐
│  main.tex                                                    [👤] [🤖]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  15 │  \section{Introduction}                                           │
│  16 │                                                                    │
│  17 │  ┌─────────────────────────────────────────────────────────────┐  │
│  18 │  │ 🤖 Agent Suggestion                              [×]        │  │
│  19 │  │ ─────────────────────────────────────────────────────────── │  │
│  20 │  │ ~~The results show that the method works well.~~            │  │
│  21 │  │ +Our findings demonstrate that the proposed methodology     │  │
│  22 │  │ +achieves statistically significant improvements (p<0.05).+ │  │
│  23 │  │                                                              │  │
│  24 │  │ [✓ Accept] [✗ Reject] [Edit] [💬 Comment]                   │  │
│  25 │  └─────────────────────────────────────────────────────────────┘  │
│  26 │                                                                    │
│  27 │  The data was collected from multiple sources...                  │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  🤖 Agent Changes (3)                          [Accept All] [Reject All]│
│  ├─ Line 17-18: Improved introduction clarity                           │
│  ├─ Line 45: Added statistical significance                             │
│  └─ Line 72: Fixed citation format                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 4.4.5 API-Endpunkte für Document Editing

| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| POST | `/project/:id/agent/edit/apply` | Direktes Anwenden einer Änderung |
| POST | `/project/:id/agent/edit/track` | Änderung als Track Change erstellen |
| POST | `/project/:id/agent/edit/:changeId/accept` | Track Change akzeptieren |
| POST | `/project/:id/agent/edit/:changeId/reject` | Track Change ablehnen |
| GET | `/project/:id/agent/edit/pending` | Ausstehende Änderungen abrufen |
| POST | `/project/:id/agent/edit/accept-all` | Alle Änderungen akzeptieren |
| POST | `/project/:id/agent/edit/reject-all` | Alle Änderungen ablehnen |

### 4.5 Docker-Compose Erweiterung

```yaml
# develop/docker-compose.yml

ai-agent:
  build:
    context: ..
    dockerfile: services/ai-agent/Dockerfile
  environment:
    # LLM Provider API Keys
    - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    - OPENAI_API_KEY=${OPENAI_API_KEY}
    - GOOGLE_API_KEY=${GOOGLE_API_KEY}
    - GROQ_API_KEY=${GROQ_API_KEY}
    - TOGETHER_API_KEY=${TOGETHER_API_KEY}
    - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}

    # Ollama (lokal)
    - OLLAMA_HOST=http://ollama:11434

    # Default Provider & Model
    - DEFAULT_LLM_PROVIDER=anthropic
    - DEFAULT_LLM_MODEL_FREE=claude-3-5-haiku-latest
    - DEFAULT_LLM_MODEL_PRO=claude-sonnet-4-20250514

    # Service Config
    - MONGO_URL=mongodb://mongo/sharelatex
    - REDIS_HOST=redis
    - WEB_API_URL=http://web:3000
    - LOG_LEVEL=info

    # Stripe (Freemium)
    - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
    - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
  ports:
    - "3020:3020"
  depends_on:
    - mongo
    - redis
    - web
    - ollama
  volumes:
    - ../services/ai-agent:/app
    - agent-skills:/app/skills

# Ollama für lokale Modelle (kostenlos für alle Tiers)
ollama:
  image: ollama/ollama:latest
  ports:
    - "11434:11434"
  volumes:
    - ollama-models:/root/.ollama
  # GPU-Support (optional, für schnellere lokale Inferenz)
  # deploy:
  #   resources:
  #     reservations:
  #       devices:
  #         - driver: nvidia
  #           count: all
  #           capabilities: [gpu]

skill-worker:
  build:
    context: ..
    dockerfile: services/ai-agent/Dockerfile.skills
  environment:
    - PYTHON_ENV=production
  volumes:
    - agent-skills:/skills
  depends_on:
    - ai-agent

volumes:
  agent-skills:
  ollama-models:
```

### 4.6 Environment Variables (.env)

```bash
# develop/.env.example

# === LLM Provider API Keys ===
# Mindestens einer erforderlich (oder nur Ollama für komplett lokale Nutzung)

# Anthropic (empfohlen für beste Qualität)
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI (optional)
OPENAI_API_KEY=sk-...

# Google (optional)
GOOGLE_API_KEY=...

# Groq (optional, schnell & günstig)
GROQ_API_KEY=gsk_...

# Together AI (optional)
TOGETHER_API_KEY=...

# OpenRouter (optional, Fallback für alle Modelle)
OPENROUTER_API_KEY=sk-or-...

# === Stripe (Freemium Billing) ===
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_TEAM_MONTHLY=price_...
```

---

## 5. Implementierungs-Phasen

### Phase 1: Foundation (2-3 Wochen)

**Ziel:** Basis-Agent-Integration mit Chat

- [ ] AI-Agent Service erstellen
- [ ] Anthropic API Integration
- [ ] Basis-Chat-Erweiterung (`@agent` Trigger)
- [ ] Streaming-Response Implementation
- [ ] MongoDB Schema-Erweiterungen
- [ ] Einfache LaTeX-Hilfe (Formeln, Tabellen)

**Deliverables:**
- Agent antwortet im Chat
- Einfache LaTeX-Generierung funktioniert
- Streaming-Antworten im Frontend

### Phase 2: Document Context (2 Wochen)

**Ziel:** Agent versteht aktuelles Dokument

- [ ] Document-Context-Service
- [ ] Selektion-Erkennung im Editor
- [ ] Kontext-Fenster-Management
- [ ] "Improve this paragraph" Feature
- [ ] "Explain this section" Feature

**Deliverables:**
- Agent kann selektierten Text verbessern
- Agent erklärt komplexe LaTeX-Konstrukte
- Kontextbewusste Vorschläge

### Phase 3: Scientific Skills (3-4 Wochen)

**Ziel:** Integration der wissenschaftlichen Skills

- [ ] Skill-Registry implementieren
- [ ] claude-scientific-skills Integration
- [ ] Skill-Auswahl UI
- [ ] Datenbank-Anbindungen (PubMed, etc.)
- [ ] Python-Skill-Worker

**Deliverables:**
- Literatur-Recherche funktioniert
- Bioinformatik-Skills verfügbar
- Chemie-Skills verfügbar

### Phase 4: Scientific Writer (2-3 Wochen)

**Ziel:** Vollständige Schreib-Unterstützung

- [ ] claude-scientific-writer Integration
- [ ] Paper-Template-Vorschläge
- [ ] Peer-Review Feature
- [ ] Zitations-Management
- [ ] Grant-Proposal-Hilfe

**Deliverables:**
- Agent kann Paper-Struktur vorschlagen
- Peer-Review-Feedback funktioniert
- BibTeX-Generierung

### Phase 5: Advanced Features (4+ Wochen)

**Ziel:** Erweiterte Kollaborations-Features

- [ ] Multi-Agent-Workflows
- [ ] Track Changes Integration
- [ ] Custom Skills
- [ ] Usage Analytics
- [ ] Performance-Optimierung

**Deliverables:**
- Vollständige Agent-Integration
- Analytics-Dashboard
- Custom-Skill-API

---

## 6. Skill-Kategorien und Befehle

### 6.1 Schreib-Skills

| Befehl | Beschreibung | Beispiel |
|--------|--------------|----------|
| `@agent improve` | Text verbessern | `@agent improve this paragraph` |
| `@agent expand` | Text erweitern | `@agent expand this introduction` |
| `@agent summarize` | Zusammenfassen | `@agent summarize the results` |
| `@agent rephrase` | Umformulieren | `@agent rephrase for clarity` |
| `@agent proofread` | Korrekturlesen | `@agent proofread my abstract` |

### 6.2 LaTeX-Skills

| Befehl | Beschreibung | Beispiel |
|--------|--------------|----------|
| `@agent latex table` | Tabelle erstellen | `@agent latex table with 3 columns` |
| `@agent latex figure` | Figur-Code | `@agent latex figure for my plot` |
| `@agent latex equation` | Formel formatieren | `@agent latex equation E=mc^2` |
| `@agent latex tikz` | TikZ-Diagramm | `@agent latex tikz flowchart` |
| `@agent latex beamer` | Präsentation | `@agent latex beamer slide` |

### 6.3 Recherche-Skills

| Befehl | Beschreibung | Beispiel |
|--------|--------------|----------|
| `@agent search pubmed` | PubMed-Suche | `@agent search pubmed CRISPR` |
| `@agent cite` | Zitation finden | `@agent cite machine learning survey` |
| `@agent explain` | Begriff erklären | `@agent explain p-value` |
| `@agent compare` | Vergleichen | `@agent compare RNA-seq methods` |

### 6.4 Analyse-Skills

| Befehl | Beschreibung | Beispiel |
|--------|--------------|----------|
| `@agent analyze structure` | Paper-Struktur | `@agent analyze structure of my paper` |
| `@agent review` | Peer-Review | `@agent review my methods section` |
| `@agent check citations` | Zitationen prüfen | `@agent check citations completeness` |
| `@agent suggest figures` | Figuren vorschlagen | `@agent suggest figures for results` |

### 6.5 Wissenschaftliche Skills (erweitert)

| Kategorie | Befehle | Beschreibung |
|-----------|---------|--------------|
| **Bioinformatik** | `@agent analyze sequence`, `@agent phylogeny` | DNA/Protein-Analyse |
| **Cheminformatik** | `@agent molecule`, `@agent docking` | Molekül-Analyse |
| **Statistik** | `@agent stats test`, `@agent power analysis` | Statistische Tests |
| **Visualisierung** | `@agent plot`, `@agent network graph` | Daten-Visualisierung |

---

## 7. UI/UX Design

### 7.0 Zwei Separate Chat-Systeme

**Wichtig:** Der AI-Agent-Chat ist ein **eigenständiges System**, getrennt vom bestehenden Kollaborations-Chat.

| Aspekt | Kollaborations-Chat | AI-Agent-Chat |
|--------|---------------------|---------------|
| **Zweck** | Kommunikation zwischen Teammitgliedern | Interaktion mit KI-Assistent |
| **Teilnehmer** | Projekt-Mitglieder | User ↔ AI Agent |
| **Position** | Rechte Sidebar (bestehend) | Linke Sidebar oder Modal |
| **Persistenz** | Dauerhaft für alle sichtbar | Pro User, pro Session |
| **Trigger** | Immer verfügbar | 🤖 Button oder Tastenkürzel |

### 7.1 Editor-Layout mit beiden Chats

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  📄 My Research Paper                                    [Share] [History] [Settings] │
├────────────────────┬─────────────────────────────────────────────┬───────────────────┤
│                    │                                             │                   │
│  🤖 AI Assistant   │              LATEX EDITOR                   │  💬 Team Chat    │
│  ────────────────  │  ─────────────────────────────────────────  │  ────────────────│
│                    │                                             │                   │
│  Wie kann ich dir  │  1  \documentclass{article}                 │  👤 Anna (14:30) │
│  heute helfen?     │  2  \usepackage{amsmath}                    │  Hat jemand die  │
│                    │  3                                          │  Einleitung      │
│  ┌──────────────┐  │  4  \begin{document}                        │  überprüft?      │
│  │ Quick Start  │  │  5                                          │                   │
│  │              │  │  6  \section{Introduction}                  │  👤 Max (14:32)  │
│  │ [Improve]    │  │  7  |                                       │  Ja, sieht gut   │
│  │ [Expand]     │  │  8  The results of our study...             │  aus!            │
│  │ [LaTeX]      │  │  9                                          │                   │
│  │ [Cite]       │  │  10 \section{Methods}                       │  👤 Du (14:35)   │
│  └──────────────┘  │  11                                         │  Danke! Ich      │
│                    │                                             │  arbeite gerade  │
│  ───────────────── │                                             │  an Methods.     │
│                    │                                             │                   │
│  💬 Chat History   │                                             │  ─────────────── │
│                    │                                             │                   │
│  You (10:15)       │                                             │  Type message... │
│  Help me improve   │                                             │  [Send]          │
│  the introduction  │                                             │                   │
│                    │                                             │                   │
│  🤖 Agent (10:15)  │              PDF PREVIEW                    │                   │
│  Here's a better   │  ┌─────────────────────────────────────┐    │                   │
│  version:          │  │                                     │    │                   │
│  [View Response]   │  │     Introduction                    │    │                   │
│                    │  │                                     │    │                   │
│  ───────────────── │  │  The results of our study...        │    │                   │
│                    │  │                                     │    │                   │
│  Ask AI anything   │  └─────────────────────────────────────┘    │                   │
│  ________________  │                                             │                   │
│           [Send]   │                                             │                   │
│                    │                                             │                   │
├────────────────────┴─────────────────────────────────────────────┴───────────────────┤
│  [🤖 AI] [💬 Chat] [📁 Files] [🔧 Settings]                          Ln 7, Col 1    │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 AI-Chat Panel (Detailliert)

```
┌─────────────────────────────────────────┐
│  🤖 AI Assistant              [─] [×]   │
│  Model: Claude 3.5 Haiku ▼    [⚙️]      │
├─────────────────────────────────────────┤
│                                         │
│  Hallo! Ich bin dein wissenschaftlicher │
│  Schreib-Assistent. Wie kann ich dir    │
│  bei deinem Paper helfen?               │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 💡 Quick Actions                │   │
│  │                                  │   │
│  │ [✏️ Improve Selection]          │   │
│  │ [📝 Expand Section]             │   │
│  │ [🔬 Literature Search]          │   │
│  │ [📊 Generate Table]             │   │
│  │ [📐 Create Equation]            │   │
│  │ [📖 Peer Review]                │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ─────────── Conversation ───────────  │
│                                         │
│  👤 You (10:15)                         │
│  Help me improve this paragraph about   │
│  the methodology                        │
│  ┌─────────────────────────────────┐   │
│  │ 📎 Selected: Lines 45-52        │   │
│  │ "We collected data from..."     │   │
│  └─────────────────────────────────┘   │
│                                         │
│  🤖 Agent (10:15)                       │
│  ┌─────────────────────────────────┐   │
│  │ 📝 Using: scientific-writing     │   │
│  │ Model: Claude 3.5 Haiku          │   │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │   │
│  │                                  │   │
│  │ Here's an improved version that │   │
│  │ follows academic conventions:    │   │
│  │                                  │   │
│  │ "Data collection was conducted  │   │
│  │ using a stratified sampling..." │   │
│  │                                  │   │
│  │ [Copy] [Apply ▼] [Regenerate]   │   │
│  │        ├─ Replace Selection     │   │
│  │        └─ Track Changes (PRO)   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  👤 You (10:18)                         │
│  Can you also add a citation for this? │
│                                         │
│  🤖 Agent (10:18)                       │
│  I found relevant sources...            │
│  [View Full Response ↓]                 │
│                                         │
├─────────────────────────────────────────┤
│  50/50 messages today (Free Tier)       │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │ Ask about your document...      │   │
│  │                                  │   │
│  │ [📎 Attach Selection]           │   │
│  └─────────────────────────────────┘   │
│  [🎤]                        [Send ▶️]  │
└─────────────────────────────────────────┘
```

### 7.3 Kollaborations-Chat (Bestehend - Unverändert)

```
┌─────────────────────────────────────────┐
│  💬 Team Chat                     [×]   │
├─────────────────────────────────────────┤
│                                         │
│  👤 Anna (14:30)                        │
│  Hat jemand die Einleitung überprüft?   │
│                                         │
│  👤 Max (14:32)                         │
│  Ja, sieht gut aus! Nur ein paar Typos. │
│                                         │
│  👤 Sarah (14:35)                       │
│  Ich arbeite gerade an der Methodik.    │
│  Kann mir jemand bei der Statistik      │
│  helfen?                                │
│                                         │
│  👤 Du (14:38)                          │
│  Klar! Welche Tests brauchst du?        │
│                                         │
├─────────────────────────────────────────┤
│  Type a message to your team...         │
│                              [Send ▶️]  │
└─────────────────────────────────────────┘

(Dieser Chat bleibt unverändert - er dient
nur der Kommunikation zwischen Teammitgliedern)
```

### 7.4 Toggle zwischen AI-Chat und Team-Chat

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Bottom Toolbar                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐             │
│  │  🤖 AI Chat    │  │  💬 Team Chat  │  │  📁 Files      │             │
│  │  ────────────  │  │  (3 unread)    │  │                │             │
│  │  [●] Active    │  │                │  │                │             │
│  └────────────────┘  └────────────────┘  └────────────────┘             │
│                                                                          │
│  Keyboard Shortcuts:                                                     │
│  • Cmd/Ctrl + Shift + A  →  Toggle AI Chat                              │
│  • Cmd/Ctrl + Shift + C  →  Toggle Team Chat                            │
│  • Cmd/Ctrl + Shift + I  →  Send Selection to AI                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.5 AI Chat - Compact Mode (als Floating Button)

```
                                          ┌───────────────────────────┐
                                          │  🤖 Ask AI                │
Editor Content                            │  ─────────────────────    │
─────────────────────────────────────     │                           │
                                          │  What would you like      │
\section{Introduction}                    │  help with?               │
                                          │                           │
The results show that...                  │  [________________]       │
                                          │           [Send ▶️]       │
                                          │                           │
                                          │  Quick: [Improve] [Cite]  │
                        ┌──┐              └───────────────────────────┘
                        │🤖│  ← Floating AI Button
                        └──┘     (Click to expand)
```

### 7.6 Context Menu Integration

```
┌─────────────────────────────────────────────────────────────────────────┐
│  User selects text in editor → Right-click context menu                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Selected: "The results of our experiment show that the method..."      │
│                                                                          │
│  ┌─────────────────────────────────┐                                    │
│  │  Cut                    Cmd+X   │                                    │
│  │  Copy                   Cmd+C   │                                    │
│  │  Paste                  Cmd+V   │                                    │
│  ├─────────────────────────────────┤                                    │
│  │  🤖 AI Actions            ▶    │───┐                                 │
│  ├─────────────────────────────────┤   │   ┌─────────────────────────┐  │
│  │  Comment                        │   └──▶│  ✏️ Improve Writing     │  │
│  │  Track Changes                  │       │  📝 Expand              │  │
│  └─────────────────────────────────┘       │  📖 Explain             │  │
│                                            │  🌐 Translate           │  │
│                                            │  📊 Convert to Table    │  │
│                                            │  📐 Convert to Equation │  │
│                                            │  ─────────────────────  │  │
│                                            │  💬 Ask AI about this...│  │
│                                            └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Skill-Selector

```
┌─────────────────────────────────────────┐
│  🔧 Skills                    [Search]  │
├─────────────────────────────────────────┤
│  📝 Writing                             │
│     • Improve Text                      │
│     • Expand Section                    │
│     • Proofread                         │
├─────────────────────────────────────────┤
│  📐 LaTeX                               │
│     • Generate Table                    │
│     • Create Figure                     │
│     • Format Equation                   │
├─────────────────────────────────────────┤
│  🔬 Scientific                          │
│     • Literature Search                 │
│     • Data Analysis                     │
│     • Peer Review                       │
└─────────────────────────────────────────┘
```

### 7.3 Streaming-Response Animation

```
┌─────────────────────────────────────────┐
│  🤖 Agent                               │
│  ┌─────────────────────────────────┐   │
│  │ 🔄 Thinking...                   │   │
│  │ ━━━━━━━░░░░░░░░░░░░░░░░░░░░░░░ │   │
│  │                                  │   │
│  │ Here's an improved|             │   │
│  │                    ▌ (blinking) │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 7.4 Model Selector UI

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🤖 AI Model                                              [Settings ⚙️] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Currently using: Claude 3.5 Haiku                                      │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  RECOMMENDED FOR YOUR TASK                                       │    │
│  │  ────────────────────────────────────────────────────────────── │    │
│  │  ⚡ Claude 3.5 Haiku          Fast, cost-effective    [FREE]   │    │
│  │     Best for: Quick edits, simple questions                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  CLOUD MODELS                                                           │
│  ─────────────────────────────────────────────────────────────────      │
│                                                                          │
│  ┌─ Anthropic ─────────────────────────────────────────────────────┐   │
│  │  ○ Claude 3.5 Haiku        Fast & affordable         [FREE]    │   │
│  │  ◉ Claude Sonnet 4         Balanced                  [PRO]     │   │
│  │  ○ Claude Opus 4           Most capable              [PRO]     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─ OpenAI ────────────────────────────────────────────────────────┐   │
│  │  ○ GPT-4o                  Fast & smart              [PRO]     │   │
│  │  ○ GPT-4 Turbo             High quality              [PRO]     │   │
│  │  ○ o1                      Deep reasoning            [PRO]     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─ Google ────────────────────────────────────────────────────────┐   │
│  │  ○ Gemini 2.0 Flash        Very fast                 [FREE]    │   │
│  │  ○ Gemini 2.0 Pro          Long context (1M)         [PRO]     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─ Groq ──────────────────────────────────────────────────────────┐   │
│  │  ○ Llama 3.3 70B           Ultra-fast inference      [FREE*]   │   │
│  │  ○ Mixtral 8x7B            Good for code             [FREE*]   │   │
│  │  * Limited requests per day                                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  LOCAL MODELS (via Ollama)                                  💻 Private  │
│  ─────────────────────────────────────────────────────────────────      │
│                                                                          │
│  ┌─ Installed ─────────────────────────────────────────────────────┐   │
│  │  ○ Llama 3.2 8B            Good general use          [FREE]    │   │
│  │  ○ Mistral 7B              Fast local                [FREE]    │   │
│  │  ○ DeepSeek Coder          Best for code             [FREE]    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─ Download More ─────────────────────────────────────────────────┐   │
│  │  + Qwen 2.5 72B            Large & capable                      │   │
│  │  + CodeLlama 34B           Specialized for code                 │   │
│  │  + Phi-3 Medium            Microsoft's efficient model          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  🔒 Upgrade to Pro for access to all cloud models               │    │
│  │     €15/month - Unlimited messages, all models                  │    │
│  │                                                   [Upgrade →]   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  [Cancel]                                           [Apply Selection]   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.5 Track Changes Panel

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🤖 Agent Changes                                    [Accept All] [×]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  3 pending changes from this session                                    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  📝 Line 17-18 · Introduction                                   │    │
│  │  ─────────────────────────────────────────────────────────────  │    │
│  │  - The results show that the method works well.                 │    │
│  │  + Our findings demonstrate that the proposed methodology       │    │
│  │  + achieves statistically significant improvements (p<0.05).    │    │
│  │                                                                  │    │
│  │  [✓ Accept] [✗ Reject] [View in Doc]                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  📝 Line 45 · Methods                                           │    │
│  │  ─────────────────────────────────────────────────────────────  │    │
│  │  - We used a sample of n=50.                                    │    │
│  │  + We recruited a sample of n=50 participants (25 male,         │    │
│  │  + 25 female, mean age 34.2 ± 8.1 years).                       │    │
│  │                                                                  │    │
│  │  [✓ Accept] [✗ Reject] [View in Doc]                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  📝 Line 72 · References                                        │    │
│  │  ─────────────────────────────────────────────────────────────  │    │
│  │  - [1] Smith et al, 2023                                        │    │
│  │  + \cite{smith2023method}                                       │    │
│  │                                                                  │    │
│  │  [✓ Accept] [✗ Reject] [View in Doc]                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ────────────────────────────────────────────────────────────────────   │
│  [Reject All]                                          [Accept All ✓]  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Sicherheit und Berechtigungen

### 8.1 API-Key Management

```javascript
// Umgebungsvariablen
ANTHROPIC_API_KEY=sk-ant-...
AGENT_RATE_LIMIT_PER_USER=100  // Anfragen pro Stunde
AGENT_MAX_TOKENS=4000          // Max Tokens pro Anfrage
```

### 8.2 Berechtigungen

| Rolle | Berechtigungen |
|-------|----------------|
| **Viewer** | Agent-Chat lesen |
| **Editor** | Agent nutzen, Basis-Skills |
| **Owner** | Alle Skills, Einstellungen |
| **Admin** | Skill-Management, Analytics |

### 8.3 Rate Limiting

```javascript
// Neue Rate Limiter
agentMessage: new RateLimiter('agent-message', {
  points: 50,     // 50 Nachrichten
  duration: 3600, // pro Stunde
}),
agentSkill: new RateLimiter('agent-skill', {
  points: 20,     // 20 Skill-Ausführungen
  duration: 3600, // pro Stunde
})
```

---

## 9. Freemium-Modell & Monetarisierung

### 9.1 Tier-Übersicht

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FREEMIUM TIERS                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │      FREE       │  │      PRO        │  │     TEAM        │          │
│  │    €0/Monat     │  │   €15/Monat     │  │   €12/User/Mo   │          │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤          │
│  │                 │  │                 │  │                 │          │
│  │ • 50 Nachr./Tag │  │ • Unbegrenzt    │  │ • Unbegrenzt    │          │
│  │ • Haiku only    │  │ • Alle Modelle  │  │ • Alle Modelle  │          │
│  │ • Basis-Skills  │  │ • Alle Skills   │  │ • Alle Skills   │          │
│  │ • Apply Button  │  │ • Track Changes │  │ • Track Changes │          │
│  │ • Community     │  │ • Priority      │  │ • Shared Usage  │          │
│  │                 │  │ • API Access    │  │ • Admin Panel   │          │
│  │                 │  │                 │  │ • SSO           │          │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘          │
│                                                                          │
│  ┌─────────────────┐                                                    │
│  │   ENTERPRISE    │                                                    │
│  │    Custom       │                                                    │
│  ├─────────────────┤                                                    │
│  │ • Self-hosted   │                                                    │
│  │ • Custom Models │                                                    │
│  │ • SLA           │                                                    │
│  │ • Dedicated     │                                                    │
│  └─────────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Feature-Matrix

| Feature | Free | Pro | Team | Enterprise |
|---------|------|-----|------|------------|
| **Nachrichten/Tag** | 50 | Unbegrenzt | Unbegrenzt | Unbegrenzt |
| **Modelle** | Haiku, Ollama | Alle | Alle | Alle + Custom |
| **Claude Opus 4** | ❌ | ✅ | ✅ | ✅ |
| **Claude Sonnet 4** | ❌ | ✅ | ✅ | ✅ |
| **GPT-4o / o1** | ❌ | ✅ | ✅ | ✅ |
| **Lokale Modelle (Ollama)** | ✅ | ✅ | ✅ | ✅ |
| **Basis-Skills** | ✅ | ✅ | ✅ | ✅ |
| **Scientific Skills** | ❌ | ✅ | ✅ | ✅ |
| **Writer Skills** | Begrenzt | ✅ | ✅ | ✅ |
| **Apply Button** | ✅ | ✅ | ✅ | ✅ |
| **Track Changes** | ❌ | ✅ | ✅ | ✅ |
| **Literatur-Recherche** | 5/Tag | Unbegrenzt | Unbegrenzt | Unbegrenzt |
| **Peer-Review** | ❌ | ✅ | ✅ | ✅ |
| **Custom Prompts** | ❌ | ✅ | ✅ | ✅ |
| **API-Zugang** | ❌ | ✅ | ✅ | ✅ |
| **Team-Verwaltung** | ❌ | ❌ | ✅ | ✅ |
| **SSO/SAML** | ❌ | ❌ | ✅ | ✅ |
| **Self-Hosting** | ❌ | ❌ | ❌ | ✅ |
| **SLA** | ❌ | ❌ | ❌ | ✅ |
| **Support** | Community | E-Mail | Priority | Dedicated |

### 9.3 Skill-Kategorien nach Tier

#### Free Tier Skills
```
✅ Basis-Schreiben
   • improve (Text verbessern)
   • expand (kurz, max 100 Wörter)
   • summarize
   • proofread

✅ Basis-LaTeX
   • latex table (einfach)
   • latex equation
   • latex figure (basic)

✅ Basis-Recherche
   • explain (Begriffe erklären)
   • 5 Literatur-Suchen/Tag
```

#### Pro/Team Skills
```
✅ Alle Free Skills +

✅ Erweiterte Schreiben
   • expand (unbegrenzt)
   • rephrase mit Stil-Optionen
   • academic-tone
   • translate

✅ Erweiterte LaTeX
   • latex tikz
   • latex beamer
   • latex poster
   • custom templates

✅ Scientific Skills (140+)
   • Bioinformatik
   • Cheminformatik
   • Statistik
   • Visualisierung

✅ Writer Skills
   • peer-review
   • citation-management
   • grant-writing
   • structure-analysis
```

### 9.4 API-Kosten pro Provider

| Provider | Modell | Input | Output | Verfügbar ab |
|----------|--------|-------|--------|--------------|
| **Anthropic** | Claude Opus 4 | $15/1M | $75/1M | Pro |
| **Anthropic** | Claude Sonnet 4 | $3/1M | $15/1M | Pro |
| **Anthropic** | Claude 3.5 Haiku | $0.80/1M | $4/1M | Free |
| **OpenAI** | GPT-4o | $2.50/1M | $10/1M | Pro |
| **OpenAI** | o1 | $15/1M | $60/1M | Pro |
| **Google** | Gemini 2.0 Pro | $1.25/1M | $5/1M | Pro |
| **Google** | Gemini 2.0 Flash | $0.075/1M | $0.30/1M | Free |
| **Groq** | Llama 3.3 70B | $0.59/1M | $0.79/1M | Free (limitiert) |
| **Ollama** | Alle lokalen | Kostenlos | Kostenlos | Free |

### 9.5 Geschätzte Kosten pro User

| Nutzertyp | Tier | Nachr./Monat | API-Kosten | Margin | Preis |
|-----------|------|--------------|------------|--------|-------|
| Gelegenheit | Free | ~100 | ~€0.50 | - | €0 |
| Aktiv | Pro | ~500 | ~€5 | €10 | €15 |
| Power User | Pro | ~2000 | ~€15 | €0 | €15* |
| Team (5) | Team | ~1000/User | ~€8/User | €4 | €12/User |

*Power User werden durch Gelegenheitsnutzer quersubventioniert

### 9.6 Datenbank-Schema für Billing

```javascript
// Neue Collection: user_subscriptions
{
  _id: ObjectId,
  user_id: ObjectId,
  tier: 'free' | 'pro' | 'team' | 'enterprise',
  status: 'active' | 'cancelled' | 'past_due',
  stripe_customer_id: String,
  stripe_subscription_id: String,
  current_period_start: Date,
  current_period_end: Date,
  usage: {
    messages_today: Number,
    messages_this_month: Number,
    tokens_this_month: Number,
    literature_searches_today: Number
  },
  limits: {
    messages_per_day: Number,      // 50 für Free, null für unbegrenzt
    literature_searches_per_day: Number,
    allowed_models: [String],
    allowed_skills: [String]
  }
}

// Neue Collection: usage_logs
{
  _id: ObjectId,
  user_id: ObjectId,
  project_id: ObjectId,
  timestamp: Date,
  action: 'message' | 'skill' | 'edit' | 'search',
  provider: String,
  model: String,
  tokens_input: Number,
  tokens_output: Number,
  cost_usd: Number,
  skill_used: String
}
```

### 9.7 Upgrade-Flow UI

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     🔒 Premium Feature                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Track Changes ist ein Pro-Feature                                       │
│                                                                          │
│  Mit Pro erhältst du:                                                   │
│  ✅ Track Changes für Agent-Vorschläge                                  │
│  ✅ Unbegrenzte Nachrichten                                             │
│  ✅ Claude Sonnet & Opus Modelle                                        │
│  ✅ 140+ wissenschaftliche Skills                                       │
│  ✅ Peer-Review & Zitations-Management                                  │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  €15/Monat         [Jetzt upgraden]                             │    │
│  │  oder €144/Jahr (20% sparen)                                    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  [Weiter mit Free] [Mehr erfahren]                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.8 Rate Limiting nach Tier

```javascript
// services/ai-agent/app/js/Infrastructure/RateLimiter.js

const tierLimits = {
  free: {
    messagesPerDay: 50,
    messagesPerHour: 20,
    tokensPerDay: 50_000,
    literatureSearchesPerDay: 5,
    skillExecutionsPerDay: 20,
    allowedModels: ['claude-3-5-haiku', 'gemini-2.0-flash', 'ollama/*'],
    trackChanges: false
  },
  pro: {
    messagesPerDay: null,  // unbegrenzt
    messagesPerHour: 100,
    tokensPerDay: null,
    literatureSearchesPerDay: null,
    skillExecutionsPerDay: null,
    allowedModels: ['*'],  // alle
    trackChanges: true
  },
  team: {
    // wie Pro, aber mit Team-Pool
    sharedTokenPool: true,
    poolTokensPerMonth: 5_000_000
  },
  enterprise: {
    // Custom Limits
  }
};
```

---

## 10. Getroffene Entscheidungen & Offene Fragen

### 10.1 ✅ Getroffene Entscheidungen

| Frage | Entscheidung | Details |
|-------|--------------|---------|
| **LLM-Provider** | Multi-Provider mit Auswahl | Alle großen Anbieter + Ollama lokal |
| **Document Editing** | Apply Button + Track Changes | Beide Optionen, Track Changes für Pro |
| **Lizenzmodell** | Freemium | Free (begrenzt) → Pro (€15) → Team (€12/User) |
| **Lokale Option** | Ja, via Ollama | Kostenlos für alle Tiers |
| **Default-Modell** | Claude 3.5 Haiku (Free), Sonnet (Pro) | Automatische Empfehlung je nach Task |

### 10.2 🔄 Noch zu klären

1. **Kontext-Fenster Management**
   - Option A: Gesamtes Dokument (bei kleinen Docs)
   - Option B: Smart-Chunking mit Sliding Window
   - Option C: User-Selektion + umgebender Kontext
   - **Empfehlung:** Hybrid - Selektion + 500 Zeilen Kontext

2. **Stripe vs. Alternative Payment Provider**
   - Stripe (Standard, gut dokumentiert)
   - Paddle (einfacher für EU)
   - LemonSqueezy (Creator-fokussiert)

3. **Self-Hosting für Enterprise**
   - Vollständiges Docker-Setup?
   - Kubernetes Helm Charts?
   - Terraform für Cloud-Deployment?

4. **Datenschutz & GDPR**
   - Wie lange werden Nachrichten gespeichert?
   - Opt-out für AI-Training?
   - Daten-Export für User?

5. **Ollama Default-Modelle**
   - Welche Modelle vorinstallieren?
   - Llama 3.2 (8B) vs Mistral vs Qwen?

### 10.3 Nächste Schritte (Priorisiert)

#### Phase 1: Foundation (Sofort starten)
1. [ ] AI-Agent Service Grundstruktur erstellen
2. [ ] LLM Gateway mit Anthropic + Ollama Adapter
3. [ ] Basis-Chat-Erweiterung (`@agent` Trigger)
4. [ ] Streaming-Response Implementation
5. [ ] MongoDB Schema-Erweiterungen

#### Phase 1.5: Document Editing
6. [ ] Apply Button Implementation
7. [ ] Track Changes Integration (Frontend)
8. [ ] Track Changes Integration (Backend)

#### Phase 2: Multi-Provider
9. [ ] OpenAI Adapter
10. [ ] Google Adapter
11. [ ] Groq Adapter
12. [ ] Model-Selector UI

#### Phase 3: Freemium
13. [ ] Stripe Integration
14. [ ] Subscription Management
15. [ ] Usage Tracking & Limits
16. [ ] Upgrade-Flow UI

---

## 11. Referenzen

- [claude-scientific-skills](https://github.com/K-Dense-AI/claude-scientific-skills)
- [claude-scientific-writer](https://github.com/K-Dense-AI/claude-scientific-writer)
- [Anthropic Claude API](https://docs.anthropic.com/)
- [Overleaf Architecture](./CLAUDE.md)

---

## Anhang A: Skill-Katalog (claude-scientific-skills)

### Bioinformatik & Genomik (16+ Skills)
- Sequenzanalyse
- Single-Cell RNA-seq (Scanpy)
- Phylogenetik
- Gen-Regulationsnetzwerke
- Variant-Calling
- Genome Assembly

### Cheminformatik & Drug Discovery (11+ Skills)
- Molekül-Docking
- Virtual Screening
- ADMET-Vorhersage
- Struktur-Aktivitäts-Beziehungen (SAR)
- Retrosynthese
- Compound-Ähnlichkeit

### Klinische Forschung
- Varianten-Interpretation
- Pharmakogenomik
- Clinical Trials Integration
- Drug Safety
- Patient Matching

### Multi-Omics & Systembiologie
- Datenintegration
- Pathway-Analyse
- Netzwerk-Rekonstruktion
- Biomarker-Discovery

### Datenanalyse & Visualisierung
- Statistische Analyse
- Publikationsreife Grafiken
- Netzwerk-Visualisierung
- Report-Generierung

---

## Anhang B: Writer-Features (claude-scientific-writer)

### Dokument-Typen
- Scientific Papers (IMRaD)
- Clinical Reports
- Research Posters (LaTeX)
- Grant Proposals
- Literature Reviews
- Technical Reports

### LaTeX-Templates
- Nature
- Science
- NeurIPS
- IEEE
- ACM
- Custom

### Peer-Review (ScholarEval)
1. Clarity
2. Originality
3. Methodology
4. Results
5. Discussion
6. References
7. Reproducibility
8. Impact
