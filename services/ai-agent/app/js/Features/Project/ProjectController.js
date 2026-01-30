/**
 * Project Controller
 *
 * REST API endpoints for AI-Agent to interact with Overleaf projects.
 * Exposes file reading, creation, and upload capabilities to the AI.
 */

import logger from '@overleaf/logger'
import { ProjectBridge } from '../../Infrastructure/ProjectBridge/ProjectBridge.js'

export const ProjectController = {
  /**
   * List all files in a project
   * GET /project/:projectId/agent/files
   *
   * Returns: { files: [{ _id, name, path, type, extension }] }
   */
  async listFiles(req, res) {
    try {
      const { projectId } = req.params
      const userId = req.headers['x-user-id']

      logger.info({ projectId, userId }, 'Listing project files')

      const files = await ProjectBridge.listAllFiles(projectId)

      res.json({
        projectId,
        files,
        count: files.length
      })
    } catch (error) {
      logger.error({ error }, 'Failed to list files')
      res.status(500).json({ error: 'Failed to list project files' })
    }
  },

  /**
   * Get all documents with content
   * GET /project/:projectId/agent/docs
   *
   * Returns: { docs: [{ _id, path, content, lines }] }
   */
  async getAllDocs(req, res) {
    try {
      const { projectId } = req.params
      const userId = req.headers['x-user-id']

      logger.info({ projectId, userId }, 'Getting all docs')

      const docs = await ProjectBridge.getAllDocs(projectId)

      // Transform to include content as string
      const docsWithContent = docs.map(doc => ({
        _id: doc._id,
        path: doc.path,
        lines: doc.lines,
        content: Array.isArray(doc.lines) ? doc.lines.join('\n') : doc.lines,
        rev: doc.rev
      }))

      res.json({
        projectId,
        docs: docsWithContent,
        count: docsWithContent.length
      })
    } catch (error) {
      logger.error({ error }, 'Failed to get docs')
      res.status(500).json({ error: 'Failed to get project documents' })
    }
  },

  /**
   * Get a single document by ID
   * GET /project/:projectId/agent/doc/:docId
   */
  async getDoc(req, res) {
    try {
      const { projectId, docId } = req.params

      const doc = await ProjectBridge.getDoc(projectId, docId)

      res.json({
        _id: doc._id,
        lines: doc.lines,
        content: Array.isArray(doc.lines) ? doc.lines.join('\n') : doc.lines,
        rev: doc.rev,
        version: doc.version
      })
    } catch (error) {
      if (error.statusCode === 404) {
        return res.status(404).json({ error: 'Document not found' })
      }
      logger.error({ error }, 'Failed to get doc')
      res.status(500).json({ error: 'Failed to get document' })
    }
  },

  /**
   * Create or update a document
   * POST /project/:projectId/agent/doc
   *
   * Body: { name, content, folderId? }
   * - name: Document filename (e.g., 'chapter1.tex')
   * - content: Document content as string
   * - folderId: Optional folder ID (defaults to root)
   */
  async upsertDoc(req, res) {
    try {
      const { projectId } = req.params
      const { name, content, folderId = 'root' } = req.body
      const userId = req.headers['x-user-id']

      if (!name) {
        return res.status(400).json({ error: 'Document name is required' })
      }

      if (content === undefined) {
        return res.status(400).json({ error: 'Document content is required' })
      }

      // Convert content string to lines array
      const lines = typeof content === 'string'
        ? content.split('\n')
        : content

      logger.info({ projectId, name, folderId, lineCount: lines.length }, 'Creating/updating document')

      const result = await ProjectBridge.upsertDoc(
        projectId,
        folderId,
        name,
        lines,
        userId,
        'ai-agent'
      )

      res.json({
        success: true,
        doc: result
      })
    } catch (error) {
      logger.error({ error }, 'Failed to upsert doc')
      res.status(500).json({ error: 'Failed to create/update document' })
    }
  },

  /**
   * Update an existing document by ID
   * PUT /project/:projectId/agent/doc/:docId
   *
   * Body: { content }
   */
  async updateDoc(req, res) {
    try {
      const { projectId, docId } = req.params
      const { content } = req.body

      if (content === undefined) {
        return res.status(400).json({ error: 'Content is required' })
      }

      // First get the current doc to get version
      const currentDoc = await ProjectBridge.getDoc(projectId, docId)

      const lines = typeof content === 'string'
        ? content.split('\n')
        : content

      const result = await ProjectBridge.updateDoc(
        projectId,
        docId,
        lines,
        currentDoc.version
      )

      res.json({
        success: true,
        modified: result.modified,
        rev: result.rev
      })
    } catch (error) {
      if (error.statusCode === 404) {
        return res.status(404).json({ error: 'Document not found' })
      }
      logger.error({ error }, 'Failed to update doc')
      res.status(500).json({ error: 'Failed to update document' })
    }
  },

  /**
   * Upload a file (image, PDF, etc.)
   * POST /project/:projectId/agent/file
   *
   * Body: { name, content, folderId?, contentType? }
   * - name: Filename (e.g., 'figure1.png')
   * - content: Base64 encoded file content
   * - folderId: Optional folder ID
   * - contentType: Optional MIME type
   */
  async uploadFile(req, res) {
    try {
      const { projectId } = req.params
      const { name, content, folderId = 'root' } = req.body
      const userId = req.headers['x-user-id']

      if (!name) {
        return res.status(400).json({ error: 'Filename is required' })
      }

      if (!content) {
        return res.status(400).json({ error: 'File content is required' })
      }

      logger.info({ projectId, name, folderId }, 'Uploading file')

      const result = await ProjectBridge.uploadFile(
        projectId,
        folderId,
        name,
        content, // Expects base64
        userId
      )

      res.json({
        success: true,
        file: result
      })
    } catch (error) {
      logger.error({ error }, 'Failed to upload file')
      res.status(500).json({ error: 'Failed to upload file' })
    }
  },

  /**
   * Create a folder
   * POST /project/:projectId/agent/folder
   *
   * Body: { name, parentFolderId? }
   */
  async createFolder(req, res) {
    try {
      const { projectId } = req.params
      const { name, parentFolderId = 'root' } = req.body
      const userId = req.headers['x-user-id']

      if (!name) {
        return res.status(400).json({ error: 'Folder name is required' })
      }

      logger.info({ projectId, name, parentFolderId }, 'Creating folder')

      const result = await ProjectBridge.createFolder(
        projectId,
        parentFolderId,
        name,
        userId
      )

      res.json({
        success: true,
        folder: result
      })
    } catch (error) {
      logger.error({ error }, 'Failed to create folder')
      res.status(500).json({ error: 'Failed to create folder' })
    }
  },

  /**
   * Delete a document or file
   * DELETE /project/:projectId/agent/entity/:entityId
   *
   * Query: type (doc|file|folder)
   */
  async deleteEntity(req, res) {
    try {
      const { projectId, entityId } = req.params
      const { type } = req.query
      const userId = req.headers['x-user-id']

      if (!type || !['doc', 'file', 'folder'].includes(type)) {
        return res.status(400).json({ error: 'Valid entity type required (doc, file, folder)' })
      }

      logger.info({ projectId, entityId, type }, 'Deleting entity')

      await ProjectBridge.deleteEntity(projectId, entityId, type, userId)

      res.json({ success: true })
    } catch (error) {
      if (error.statusCode === 404) {
        return res.status(404).json({ error: 'Entity not found' })
      }
      logger.error({ error }, 'Failed to delete entity')
      res.status(500).json({ error: 'Failed to delete entity' })
    }
  },

  /**
   * Get project structure
   * GET /project/:projectId/agent/structure
   */
  async getStructure(req, res) {
    try {
      const { projectId } = req.params

      const structure = await ProjectBridge.getProjectStructure(projectId)

      res.json({
        projectId,
        structure
      })
    } catch (error) {
      logger.error({ error }, 'Failed to get structure')
      res.status(500).json({ error: 'Failed to get project structure' })
    }
  }
}

export default ProjectController
