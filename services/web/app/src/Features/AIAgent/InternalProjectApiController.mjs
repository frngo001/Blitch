/**
 * Internal Project API Controller
 *
 * Internal APIs for AI-Agent to interact with project files.
 * These endpoints are NOT exposed to external users.
 */

import OError from '@overleaf/o-error'
import logger from '@overleaf/logger'
import EditorController from '../Editor/EditorController.mjs'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import ProjectLocator from '../Project/ProjectLocator.mjs'
import DocstoreManager from '../Docstore/DocstoreManager.mjs'
import FileWriter from '../../infrastructure/FileWriter.mjs'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

/**
 * Get project structure (folders, docs, files)
 * GET /internal/ai-agent/project/:projectId/structure
 */
async function getProjectStructure(req, res) {
  const { projectId } = req.params

  try {
    const project = await ProjectGetter.promises.getProject(projectId, {
      name: true,
      rootFolder: true
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    res.json({
      projectId,
      name: project.name,
      rootFolder: project.rootFolder
    })
  } catch (error) {
    logger.error({ error, projectId }, 'Failed to get project structure')
    res.status(500).json({ error: 'Failed to get project structure' })
  }
}

/**
 * Create or update a document
 * POST /internal/ai-agent/project/:projectId/doc
 *
 * Body: { name, lines, folder_id?, source? }
 */
async function upsertDoc(req, res) {
  const { projectId } = req.params
  const { name, lines, folder_id, source = 'ai-agent' } = req.body
  const userId = req.headers['x-user-id'] || 'ai-agent'

  if (!name) {
    return res.status(400).json({ error: 'Document name is required' })
  }

  if (!lines || !Array.isArray(lines)) {
    return res.status(400).json({ error: 'Document lines array is required' })
  }

  try {
    // Get project to find root folder if no folder_id provided
    const project = await ProjectGetter.promises.getProject(projectId, {
      rootFolder: true
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const folderId = folder_id || project.rootFolder[0]._id

    // Use upsertDoc to create or update
    const doc = await new Promise((resolve, reject) => {
      EditorController.upsertDoc(
        projectId,
        folderId,
        name,
        lines,
        source,
        userId,
        (err, doc) => {
          if (err) reject(err)
          else resolve(doc)
        }
      )
    })

    logger.info({ projectId, docName: name, docId: doc?._id }, 'Document upserted via AI-Agent')

    res.json({
      success: true,
      doc: {
        _id: doc._id,
        name: name
      }
    })
  } catch (error) {
    logger.error({ error, projectId, name }, 'Failed to upsert document')
    res.status(500).json({ error: 'Failed to create/update document' })
  }
}

/**
 * Upload a binary file (image, PDF, etc.)
 * POST /internal/ai-agent/project/:projectId/file
 *
 * Body: { name, content (base64), folder_id? }
 */
async function uploadFile(req, res) {
  const { projectId } = req.params
  const { name, content, folder_id } = req.body
  const userId = req.headers['x-user-id'] || 'ai-agent'

  if (!name) {
    return res.status(400).json({ error: 'Filename is required' })
  }

  if (!content) {
    return res.status(400).json({ error: 'File content (base64) is required' })
  }

  try {
    // Get project to find root folder if no folder_id provided
    const project = await ProjectGetter.promises.getProject(projectId, {
      rootFolder: true
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const folderId = folder_id || project.rootFolder[0]._id

    // Decode base64 content and write to temp file
    const buffer = Buffer.from(content, 'base64')
    const tempDir = os.tmpdir()
    const tempPath = path.join(tempDir, `ai-upload-${Date.now()}-${name}`)

    await fs.promises.writeFile(tempPath, buffer)

    try {
      // Use upsertFile to create or replace
      const fileRef = await new Promise((resolve, reject) => {
        EditorController.upsertFile(
          projectId,
          folderId,
          name,
          tempPath,
          null, // linkedFileData
          'ai-agent',
          userId,
          (err, fileRef) => {
            if (err) reject(err)
            else resolve(fileRef)
          }
        )
      })

      logger.info({ projectId, fileName: name, fileId: fileRef?._id }, 'File uploaded via AI-Agent')

      res.json({
        success: true,
        file: {
          _id: fileRef._id,
          name: name
        }
      })
    } finally {
      // Clean up temp file
      await fs.promises.unlink(tempPath).catch(() => {})
    }
  } catch (error) {
    logger.error({ error, projectId, name }, 'Failed to upload file')
    res.status(500).json({ error: 'Failed to upload file' })
  }
}

/**
 * Create a folder
 * POST /internal/ai-agent/project/:projectId/folder
 *
 * Body: { name, parent_folder_id? }
 */
async function createFolder(req, res) {
  const { projectId } = req.params
  const { name, parent_folder_id } = req.body
  const userId = req.headers['x-user-id'] || 'ai-agent'

  if (!name) {
    return res.status(400).json({ error: 'Folder name is required' })
  }

  try {
    const project = await ProjectGetter.promises.getProject(projectId, {
      rootFolder: true
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const parentFolderId = parent_folder_id || project.rootFolder[0]._id

    const folder = await new Promise((resolve, reject) => {
      EditorController.addFolder(
        projectId,
        parentFolderId,
        name,
        'ai-agent',
        (err, folder) => {
          if (err) reject(err)
          else resolve(folder)
        }
      )
    })

    logger.info({ projectId, folderName: name, folderId: folder?._id }, 'Folder created via AI-Agent')

    res.json({
      success: true,
      folder: {
        _id: folder._id,
        name: name
      }
    })
  } catch (error) {
    logger.error({ error, projectId, name }, 'Failed to create folder')
    res.status(500).json({ error: 'Failed to create folder' })
  }
}

/**
 * Delete an entity (doc, file, or folder)
 * DELETE /internal/ai-agent/project/:projectId/:entityType/:entityId
 */
async function deleteEntity(req, res) {
  const { projectId, entityType, entityId } = req.params
  const userId = req.headers['x-user-id'] || 'ai-agent'

  if (!['doc', 'file', 'folder'].includes(entityType)) {
    return res.status(400).json({ error: 'Invalid entity type' })
  }

  try {
    await new Promise((resolve, reject) => {
      EditorController.deleteEntity(
        projectId,
        entityId,
        entityType,
        'ai-agent',
        userId,
        (err) => {
          if (err) reject(err)
          else resolve()
        }
      )
    })

    logger.info({ projectId, entityType, entityId }, 'Entity deleted via AI-Agent')

    res.json({ success: true })
  } catch (error) {
    logger.error({ error, projectId, entityType, entityId }, 'Failed to delete entity')
    res.status(500).json({ error: 'Failed to delete entity' })
  }
}

export default {
  getProjectStructure,
  upsertDoc,
  uploadFile,
  createFolder,
  deleteEntity
}
