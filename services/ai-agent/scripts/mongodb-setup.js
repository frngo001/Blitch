/**
 * MongoDB Setup Script
 *
 * Run this script to set up indexes and initial data for AI-Agent service
 * Usage: node scripts/mongodb-setup.js
 */

import { MongoClient } from 'mongodb'

const mongoUrl = process.env.MONGO_CONNECTION_STRING || 'mongodb://localhost:27017/sharelatex'

async function setup() {
  console.log('Connecting to MongoDB...')
  const client = new MongoClient(mongoUrl)
  await client.connect()

  const db = client.db()
  console.log('Connected to MongoDB')

  // Create collections if they don't exist
  const collections = await db.listCollections().toArray()
  const collectionNames = collections.map(c => c.name)

  // AI Chat Sessions
  if (!collectionNames.includes('ai_chat_sessions')) {
    await db.createCollection('ai_chat_sessions')
    console.log('Created collection: ai_chat_sessions')
  }

  await db.collection('ai_chat_sessions').createIndexes([
    { key: { project_id: 1, user_id: 1 }, name: 'project_user' },
    { key: { user_id: 1, status: 1 }, name: 'user_status' },
    { key: { updated_at: -1 }, name: 'updated_at' }
  ])
  console.log('Created indexes for ai_chat_sessions')

  // AI Chat Quick Actions
  if (!collectionNames.includes('ai_chat_quick_actions')) {
    await db.createCollection('ai_chat_quick_actions')
    console.log('Created collection: ai_chat_quick_actions')
  }

  await db.collection('ai_chat_quick_actions').createIndexes([
    { key: { user_id: 1 }, name: 'user_id' },
    { key: { user_id: 1, project_id: 1 }, name: 'user_project' }
  ])
  console.log('Created indexes for ai_chat_quick_actions')

  // Agent Skills
  if (!collectionNames.includes('agent_skills')) {
    await db.createCollection('agent_skills')
    console.log('Created collection: agent_skills')
  }

  await db.collection('agent_skills').createIndexes([
    { key: { category: 1 }, name: 'category' },
    { key: { tier_required: 1 }, name: 'tier' },
    { key: { name: 1 }, name: 'name', unique: true }
  ])
  console.log('Created indexes for agent_skills')

  // User Subscriptions (Freemium tiers)
  if (!collectionNames.includes('user_subscriptions')) {
    await db.createCollection('user_subscriptions')
    console.log('Created collection: user_subscriptions')
  }

  await db.collection('user_subscriptions').createIndexes([
    { key: { user_id: 1 }, name: 'user_id', unique: true }
  ])
  console.log('Created indexes for user_subscriptions')

  // Usage Logs (for cost tracking)
  if (!collectionNames.includes('usage_logs')) {
    await db.createCollection('usage_logs')
    console.log('Created collection: usage_logs')
  }

  await db.collection('usage_logs').createIndexes([
    { key: { user_id: 1, created_at: -1 }, name: 'user_date' },
    { key: { project_id: 1, created_at: -1 }, name: 'project_date' },
    { key: { created_at: 1 }, name: 'created_at', expireAfterSeconds: 90 * 24 * 60 * 60 } // 90 days TTL
  ])
  console.log('Created indexes for usage_logs')

  // Insert default skills
  const defaultSkills = [
    {
      name: 'improve-text',
      category: 'writing',
      description: 'Improve clarity and scientific writing quality',
      tier_required: 'free',
      enabled: true,
      usage_count: 0
    },
    {
      name: 'expand-text',
      category: 'writing',
      description: 'Expand text with more detail and examples',
      tier_required: 'free',
      enabled: true,
      usage_count: 0
    },
    {
      name: 'summarize',
      category: 'writing',
      description: 'Create a concise summary',
      tier_required: 'free',
      enabled: true,
      usage_count: 0
    },
    {
      name: 'latex-table',
      category: 'latex',
      description: 'Create a LaTeX table from data or description',
      tier_required: 'free',
      enabled: true,
      usage_count: 0
    },
    {
      name: 'latex-equation',
      category: 'latex',
      description: 'Create LaTeX mathematical equations',
      tier_required: 'free',
      enabled: true,
      usage_count: 0
    },
    {
      name: 'latex-figure',
      category: 'latex',
      description: 'Generate LaTeX figure environment code',
      tier_required: 'pro',
      enabled: true,
      usage_count: 0
    },
    {
      name: 'literature-search',
      category: 'research',
      description: 'Help find relevant literature and citations',
      tier_required: 'pro',
      enabled: true,
      usage_count: 0
    },
    {
      name: 'peer-review',
      category: 'research',
      description: 'Simulate peer review feedback',
      tier_required: 'pro',
      enabled: true,
      usage_count: 0
    },
    {
      name: 'methods-check',
      category: 'scientific',
      description: 'Verify scientific methods description',
      tier_required: 'pro',
      enabled: true,
      usage_count: 0
    },
    {
      name: 'sequence-analysis',
      category: 'bioinformatics',
      description: 'Help with DNA/RNA/protein sequence analysis',
      tier_required: 'team',
      enabled: true,
      usage_count: 0
    },
    {
      name: 'translate',
      category: 'writing',
      description: 'Translate text while preserving scientific terminology',
      tier_required: 'free',
      enabled: true,
      usage_count: 0
    },
    {
      name: 'add-citations',
      category: 'research',
      description: 'Suggest appropriate citations for claims',
      tier_required: 'pro',
      enabled: true,
      usage_count: 0
    }
  ]

  for (const skill of defaultSkills) {
    await db.collection('agent_skills').updateOne(
      { name: skill.name },
      { $set: skill },
      { upsert: true }
    )
  }
  console.log(`Inserted/updated ${defaultSkills.length} default skills`)

  await client.close()
  console.log('MongoDB setup complete!')
}

setup().catch(error => {
  console.error('Setup failed:', error)
  process.exit(1)
})
