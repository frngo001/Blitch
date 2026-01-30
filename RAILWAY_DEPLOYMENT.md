# Railway Deployment Guide

Dieses Dokument beschreibt, wie du das komplette Overleaf Community Edition Stack auf [Railway](https://railway.app) deployen kannst.

## Voraussetzungen

- Railway Account (https://railway.app)
- Railway CLI installiert: `npm install -g @railway/cli`
- Git Repository gepusht (GitHub, GitLab, etc.)

## Architektur-Übersicht

Das Overleaf Stack besteht aus mehreren Microservices:

| Service | Beschreibung | Port |
|---------|--------------|------|
| **web** | Haupt-Webapplikation | 3000 |
| **ai-agent** | AI Scientific Agent (LLM Gateway) | 3020 |
| **clsi** | LaTeX Compile Service | 3013 |
| **real-time** | WebSocket Service | 3026 |
| **docstore** | Document Storage | 3016 |
| **document-updater** | Real-time Updates | 3003 |
| **filestore** | File Storage | 3009 |
| **chat** | Team Chat | 3010 |
| **contacts** | Contacts Service | 3036 |
| **notifications** | Notifications | 3042 |
| **project-history** | Project History | 3054 |
| **history-v1** | History V1 | 3100 |

Plus Datenbanken:
- **MongoDB** - Hauptdatenbank
- **Redis** - Caching & Pub/Sub

---

## Option 1: Railway Template (Empfohlen)

### Schritt 1: Railway Projekt erstellen

```bash
# Login bei Railway
railway login

# Neues Projekt erstellen
railway init
```

### Schritt 2: Datenbanken hinzufügen

Im Railway Dashboard:

1. **MongoDB hinzufügen:**
   - Klick auf "New Service" → "Database" → "MongoDB"
   - Notiere die `MONGO_URL` aus den Verbindungsdetails

2. **Redis hinzufügen:**
   - Klick auf "New Service" → "Database" → "Redis"
   - Notiere die `REDIS_URL` aus den Verbindungsdetails

### Schritt 3: Services deployen

Für jeden Service ein separates Railway Service erstellen:

```bash
# Web Service
railway service create web
railway variables set \
  MONGO_URL=$MONGO_URL \
  REDIS_HOST=$REDIS_HOST \
  SESSION_SECRET=$(openssl rand -hex 32) \
  NODE_ENV=production

# AI Agent Service
railway service create ai-agent
railway variables set \
  DEEPSEEK_API_KEY=sk-your-key \
  MONGO_URL=$MONGO_URL \
  MCP_ENABLED=true
```

### Schritt 4: Private Networking konfigurieren

Railway bietet privates Networking zwischen Services. Die Hostnamen folgen dem Pattern:
```
<service-name>.railway.internal
```

Setze diese Umgebungsvariablen im `web` Service:
```bash
CHAT_HOST=chat.railway.internal
CLSI_HOST=clsi.railway.internal
AI_AGENT_HOST=ai-agent.railway.internal
# ... etc
```

---

## Option 2: Docker Compose Deployment

Railway unterstützt auch docker-compose.yml direkt:

### Schritt 1: Repo mit Railway verbinden

```bash
# Im Projektverzeichnis
railway link

# Compose-Datei spezifizieren
railway up --compose docker-compose.railway.yml
```

### Schritt 2: Umgebungsvariablen setzen

Kopiere `.env.example` zu `.env` und fülle die Werte aus:

```bash
cp .env.example .env
# Editiere .env mit deinen Werten
```

Im Railway Dashboard → Settings → Variables:
- Importiere die Variablen aus `.env`
- Oder setze sie manuell

---

## Option 3: Einzelne Services manuell deployen

Wenn du mehr Kontrolle brauchst:

### 1. MongoDB (Railway Addon)

```bash
railway add mongodb
export MONGO_URL=$(railway variables get MONGO_URL)
```

### 2. Redis (Railway Addon)

```bash
railway add redis
export REDIS_URL=$(railway variables get REDIS_URL)
```

### 3. Web Service

```bash
cd services/web
railway init --name overleaf-web
railway up
```

Dockerfile wird automatisch erkannt.

### 4. AI Agent Service

```bash
cd services/ai-agent
railway init --name overleaf-ai-agent
railway variables set DEEPSEEK_API_KEY=sk-xxx
railway up
```

### 5. CLSI (LaTeX Compiler)

```bash
cd services/clsi
railway init --name overleaf-clsi
railway up
```

**Wichtig:** Der CLSI Service ist groß (~3GB wegen TeX Live). Stelle sicher, dass dein Railway Plan genug Speicher hat.

---

## Wichtige Umgebungsvariablen

### Pflicht-Variablen

| Variable | Beschreibung | Beispiel |
|----------|--------------|----------|
| `MONGO_URL` | MongoDB Connection String | `mongodb://...` |
| `REDIS_HOST` | Redis Hostname | `redis.railway.internal` |
| `SESSION_SECRET` | Session Verschlüsselung | `openssl rand -hex 32` |
| `DEEPSEEK_API_KEY` | AI Provider API Key | `sk-...` |

### Optionale Variablen

| Variable | Beschreibung | Default |
|----------|--------------|---------|
| `ANTHROPIC_API_KEY` | Claude API Key | - |
| `OPENAI_API_KEY` | OpenAI API Key | - |
| `MCP_ENABLED` | Scientific Skills | `true` |
| `GIT_BRIDGE_ENABLED` | Git Integration | `false` |

---

## Kosten-Schätzung

Railway Pricing (Stand 2025):

| Plan | Preis | Empfohlen für |
|------|-------|---------------|
| Hobby | $5/Monat | Entwicklung, kleine Teams |
| Pro | $20/Monat | Produktion, mehr Ressourcen |
| Team | Custom | Enterprise |

**Geschätzte Ressourcen für Overleaf:**

| Service | RAM | CPU | Storage |
|---------|-----|-----|---------|
| web | 512MB | 0.5 vCPU | - |
| ai-agent | 256MB | 0.25 vCPU | - |
| clsi | 2GB | 1 vCPU | 5GB |
| MongoDB | 1GB | 0.5 vCPU | 10GB |
| Redis | 256MB | 0.25 vCPU | - |
| Andere | 128MB each | 0.1 vCPU | - |

**Gesamt:** ~5GB RAM, 3 vCPU, 15GB Storage

---

## Troubleshooting

### Service startet nicht

```bash
# Logs prüfen
railway logs --service web

# Container Shell
railway shell --service web
```

### MongoDB Verbindung fehlgeschlagen

Prüfe:
1. `MONGO_URL` ist korrekt gesetzt
2. Private Networking ist aktiviert
3. MongoDB Service läuft

```bash
railway variables --service web
```

### CLSI zu langsam

Der CLSI braucht viel RAM für TeX Live:
- Mindestens 2GB RAM empfohlen
- Erste Kompilierung dauert länger (Cache aufbauen)

### AI Agent antwortet nicht

Prüfe:
1. `DEEPSEEK_API_KEY` ist gesetzt
2. `AI_AGENT_HOST` zeigt auf den richtigen Host
3. MCP startet erfolgreich (Logs prüfen)

```bash
railway logs --service ai-agent | grep -i "mcp\|deepseek"
```

---

## Produktions-Checklist

- [ ] MongoDB Backup konfiguriert
- [ ] Redis Persistenz aktiviert
- [ ] Custom Domain eingerichtet
- [ ] SSL/TLS aktiviert (Railway macht das automatisch)
- [ ] Health Checks konfiguriert
- [ ] Monitoring eingerichtet (Railway Metrics)
- [ ] Secrets sicher gespeichert (nicht in Git!)
- [ ] Rate Limiting für AI-API konfiguriert

---

## Updates deployen

```bash
# Code pushen
git push origin main

# Railway deployed automatisch bei Git Push

# Oder manuell:
railway up
```

---

## Nützliche Railway CLI Befehle

```bash
# Projekt auflisten
railway status

# Logs live verfolgen
railway logs -f

# Variablen anzeigen
railway variables

# In Container einloggen
railway shell

# Service neustarten
railway restart

# Deployment History
railway deployments
```

---

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Overleaf Community: https://github.com/overleaf/overleaf
