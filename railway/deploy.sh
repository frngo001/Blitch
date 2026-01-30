#!/bin/bash
# ===========================================
# Railway Deployment Script for Overleaf
# ===========================================
# This script helps deploy all services to Railway
#
# Prerequisites:
# - Railway CLI installed: npm install -g @railway/cli
# - Logged in: railway login
# - Environment variables set (see .env.example)
#
# Usage: ./railway/deploy.sh

set -e

echo "🚀 Overleaf Railway Deployment Script"
echo "======================================"

# Check Railway CLI
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Install with: npm install -g @railway/cli"
    exit 1
fi

# Check login
if ! railway whoami &> /dev/null; then
    echo "❌ Not logged in to Railway. Run: railway login"
    exit 1
fi

echo "✅ Railway CLI ready"

# Load environment variables if .env exists
if [ -f .env ]; then
    echo "📁 Loading .env file..."
    export $(grep -v '^#' .env | xargs)
fi

# Required variables check
REQUIRED_VARS="SESSION_SECRET DEEPSEEK_API_KEY"
for var in $REQUIRED_VARS; do
    if [ -z "${!var}" ]; then
        echo "❌ Missing required variable: $var"
        echo "   Please set it in .env or export it"
        exit 1
    fi
done

echo "✅ Required variables present"

# Create Railway project if not exists
if ! railway status &> /dev/null; then
    echo "📦 Creating new Railway project..."
    railway init --name overleaf
fi

PROJECT_ID=$(railway status --json | jq -r '.projectId')
echo "📦 Project ID: $PROJECT_ID"

# Function to create and deploy a service
deploy_service() {
    local name=$1
    local dockerfile=$2
    local health_path=$3

    echo ""
    echo "🔧 Deploying $name..."

    # Check if service exists
    if railway service list | grep -q "$name"; then
        echo "   Service exists, updating..."
    else
        echo "   Creating new service..."
        railway service create "$name"
    fi

    # Link to service
    railway service link "$name"

    # Set common variables
    railway variables set \
        NODE_ENV=production \
        LISTEN_ADDRESS=0.0.0.0

    # Deploy
    railway up --detach

    echo "✅ $name deployed"
}

# ===========================================
# Deploy Databases (use Railway addons)
# ===========================================
echo ""
echo "📊 Setting up databases..."
echo "   Please add MongoDB and Redis in the Railway dashboard:"
echo "   1. Click 'New Service' → 'Database' → 'MongoDB'"
echo "   2. Click 'New Service' → 'Database' → 'Redis'"
echo ""
read -p "Press Enter when databases are ready..."

# Get database URLs from Railway
echo "   Fetching database connection strings..."
MONGO_URL=$(railway variables get MONGO_URL 2>/dev/null || echo "")
REDIS_URL=$(railway variables get REDIS_URL 2>/dev/null || echo "")

if [ -z "$MONGO_URL" ]; then
    echo "⚠️  MONGO_URL not found. Please set it manually in Railway dashboard."
fi

if [ -z "$REDIS_URL" ]; then
    echo "⚠️  REDIS_URL not found. Please set it manually in Railway dashboard."
fi

# ===========================================
# Deploy Services
# ===========================================

# 1. AI Agent
echo ""
echo "🤖 Deploying AI Agent..."
railway service create ai-agent 2>/dev/null || true
railway service link ai-agent
railway variables set \
    AI_AGENT_PORT=3020 \
    DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY" \
    MCP_ENABLED=true \
    MCP_COMMAND=uvx \
    MCP_ARGS=claude-skills-mcp \
    AI_DEFAULT_PROVIDER=deepseek \
    AI_DEFAULT_MODEL=deepseek-chat
railway up --detach

# 2. CLSI (LaTeX Compiler)
echo ""
echo "📝 Deploying CLSI (this may take a while due to TeX Live)..."
railway service create clsi 2>/dev/null || true
railway service link clsi
railway variables set \
    SANDBOXED_COMPILES=false
railway up --detach

# 3. Supporting Services
for service in chat contacts docstore document-updater filestore history-v1 notifications project-history real-time; do
    echo ""
    echo "🔧 Deploying $service..."
    railway service create "$service" 2>/dev/null || true
    railway service link "$service"
    railway up --detach
done

# 4. Web (Main Application) - Deploy last
echo ""
echo "🌐 Deploying Web (main application)..."
railway service create web 2>/dev/null || true
railway service link web

# Set service hostnames for private networking
railway variables set \
    APP_NAME=Overleaf \
    PORT=3000 \
    SESSION_SECRET="$SESSION_SECRET" \
    WEB_API_USER=overleaf \
    WEB_API_PASSWORD="${WEB_API_PASSWORD:-overleaf}" \
    EMAIL_CONFIRMATION_DISABLED=true \
    OVERLEAF_ALLOW_PUBLIC_ACCESS=true \
    AI_AGENT_ENABLED=true \
    AI_AGENT_HOST=ai-agent.railway.internal \
    AI_AGENT_PORT=3020 \
    CHAT_HOST=chat.railway.internal \
    CLSI_HOST=clsi.railway.internal \
    CONTACTS_HOST=contacts.railway.internal \
    DOCSTORE_HOST=docstore.railway.internal \
    DOCUMENT_UPDATER_HOST=document-updater.railway.internal \
    FILESTORE_HOST=filestore.railway.internal \
    HISTORY_V1_HOST=history-v1.railway.internal \
    NOTIFICATIONS_HOST=notifications.railway.internal \
    PROJECT_HISTORY_HOST=project-history.railway.internal \
    REALTIME_HOST=real-time.railway.internal

railway up --detach

# ===========================================
# Summary
# ===========================================
echo ""
echo "======================================"
echo "🎉 Deployment initiated!"
echo "======================================"
echo ""
echo "📊 Check deployment status:"
echo "   railway status"
echo ""
echo "📋 View logs:"
echo "   railway logs --service web"
echo "   railway logs --service ai-agent"
echo ""
echo "🌐 Get your app URL:"
echo "   railway domain"
echo ""
echo "⚠️  Remember to:"
echo "   1. Verify MongoDB and Redis are connected"
echo "   2. Add a custom domain in Railway dashboard"
echo "   3. Check all services are healthy"
echo ""
echo "Happy writing! 📝"
