/**
 * MongoDB Connection
 *
 * Database connection for AI-Agent service
 */

import { MongoClient } from 'mongodb'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'

const mongoUrl = Settings.mongo?.url || process.env.MONGO_CONNECTION_STRING || 'mongodb://mongo:27017/sharelatex'

let client = null
let db = null

export async function connect() {
  if (db) return db

  try {
    client = new MongoClient(mongoUrl)
    await client.connect()
    db = client.db()

    logger.info({ url: mongoUrl.replace(/\/\/.*@/, '//***@') }, 'MongoDB connected')

    // Ensure indexes
    await ensureIndexes(db)

    return db
  } catch (error) {
    logger.error({ error }, 'MongoDB connection failed')
    throw error
  }
}

export async function close() {
  if (client) {
    await client.close()
    client = null
    db = null
    logger.info('MongoDB connection closed')
  }
}

async function ensureIndexes(database) {
  try {
    // ai_chat_sessions indexes
    await database.collection('ai_chat_sessions').createIndexes([
      { key: { project_id: 1, user_id: 1 }, name: 'project_user' },
      { key: { user_id: 1, status: 1 }, name: 'user_status' },
      { key: { updated_at: -1 }, name: 'updated_at' }
    ])

    // ai_chat_quick_actions indexes
    await database.collection('ai_chat_quick_actions').createIndexes([
      { key: { user_id: 1 }, name: 'user_id' },
      { key: { user_id: 1, project_id: 1 }, name: 'user_project' }
    ])

    // agent_skills indexes
    await database.collection('agent_skills').createIndexes([
      { key: { category: 1 }, name: 'category' },
      { key: { tier_required: 1 }, name: 'tier' }
    ])

    // user_subscriptions indexes
    await database.collection('user_subscriptions').createIndexes([
      { key: { user_id: 1 }, name: 'user_id', unique: true }
    ])

    // usage_logs indexes (for cost tracking)
    await database.collection('usage_logs').createIndexes([
      { key: { user_id: 1, created_at: -1 }, name: 'user_date' },
      { key: { project_id: 1, created_at: -1 }, name: 'project_date' },
      { key: { created_at: 1 }, name: 'created_at', expireAfterSeconds: 90 * 24 * 60 * 60 } // 90 days TTL
    ])

    logger.info('MongoDB indexes ensured')
  } catch (error) {
    logger.warn({ error }, 'Failed to ensure some indexes')
  }
}

export { db }
