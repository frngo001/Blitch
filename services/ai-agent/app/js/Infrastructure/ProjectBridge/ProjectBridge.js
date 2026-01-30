/**
 * ProjectBridge
 *
 * Connects AI-Agent to Overleaf's file system via internal APIs.
 * Provides read/write access to project documents and files.
 *
 * This bridge allows K-Dense skills to:
 * - Read existing project files (.tex, .bib, images)
 * - Create new documents
 * - Update existing documents
 * - Upload generated files (figures, PDFs)
 */

import logger from '@overleaf/logger'
import settings from '../../../../config/settings.defaults.cjs'

const TIMEOUT = 30000 // 30 seconds

/**
 * Make HTTP request to internal Overleaf services
 */
async function fetchInternal(url, options = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || TIMEOUT)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
      error.statusCode = response.status
      throw error
    }

    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

export const ProjectBridge = {
  /**
   * Get all documents in a project
   * Returns array of { _id, path, lines, rev }
   */
  async getAllDocs(projectId) {
    const url = `${settings.apis.docstore.url}/project/${projectId}/doc`

    logger.debug({ projectId }, 'Fetching all docs from docstore')

    try {
      const response = await fetchInternal(url)
      const docs = await response.json()

      logger.info({ projectId, docCount: docs.length }, 'Retrieved docs from docstore')

      return docs.map(doc => ({
        _id: doc._id,
        path: doc.path || `/${doc.name || 'unknown'}`,
        lines: doc.lines,
        rev: doc.rev,
        version: doc.version
      }))
    } catch (error) {
      logger.error({ error, projectId }, 'Failed to get docs from docstore')
      throw error
    }
  },

  /**
   * Get a single document by ID
   */
  async getDoc(projectId, docId) {
    const url = `${settings.apis.docstore.url}/project/${projectId}/doc/${docId}`

    try {
      const response = await fetchInternal(url)
      const doc = await response.json()

      return {
        _id: docId,
        lines: doc.lines,
        rev: doc.rev,
        version: doc.version,
        ranges: doc.ranges
      }
    } catch (error) {
      logger.error({ error, projectId, docId }, 'Failed to get doc')
      throw error
    }
  },

  /**
   * Get project structure (folders and files)
   */
  async getProjectStructure(projectId) {
    const url = `${settings.apis.web.url}/internal/ai-agent/project/${projectId}/structure`

    try {
      const response = await fetchInternal(url)
      return await response.json()
    } catch (error) {
      // Fallback: Try to get docs only if structure endpoint not available
      logger.warn({ error, projectId }, 'Structure endpoint not available, using docs only')

      const docs = await this.getAllDocs(projectId)
      return {
        rootFolder: [{
          _id: 'root',
          name: 'root',
          docs: docs,
          folders: [],
          fileRefs: []
        }]
      }
    }
  },

  /**
   * Create or update a document in the project
   *
   * @param {string} projectId - Project ID
   * @param {string} folderId - Folder ID (use 'root' for root folder)
   * @param {string} docName - Document name (e.g., 'chapter1.tex')
   * @param {string[]} lines - Document content as array of lines
   * @param {string} userId - User ID for tracking
   * @param {string} source - Source of the change (e.g., 'ai-agent')
   */
  async upsertDoc(projectId, folderId, docName, lines, userId, source = 'ai-agent') {
    const url = `${settings.apis.web.url}/internal/ai-agent/project/${projectId}/doc`

    logger.info({ projectId, folderId, docName, lineCount: lines.length }, 'Upserting document')

    try {
      const response = await fetchInternal(url, {
        method: 'POST',
        body: JSON.stringify({
          folder_id: folderId === 'root' ? null : folderId,
          name: docName,
          lines: lines,
          source: source
        }),
        headers: {
          'X-User-Id': userId
        }
      })

      const result = await response.json()
      logger.info({ projectId, docId: result.doc?._id }, 'Document upserted successfully')

      return result.doc
    } catch (error) {
      logger.error({ error, projectId, docName }, 'Failed to upsert document')
      throw error
    }
  },

  /**
   * Update an existing document's content
   */
  async updateDoc(projectId, docId, lines, version, ranges = {}) {
    const url = `${settings.apis.docstore.url}/project/${projectId}/doc/${docId}`

    try {
      const response = await fetchInternal(url, {
        method: 'POST',
        body: JSON.stringify({ lines, version, ranges })
      })

      const result = await response.json()
      return {
        modified: result.modified,
        rev: result.rev
      }
    } catch (error) {
      logger.error({ error, projectId, docId }, 'Failed to update document')
      throw error
    }
  },

  /**
   * Upload a file (image, PDF, etc.) to the project
   *
   * @param {string} projectId - Project ID
   * @param {string} folderId - Target folder ID
   * @param {string} fileName - File name (e.g., 'figure1.png')
   * @param {Buffer|string} content - File content (Buffer or base64 string)
   * @param {string} userId - User ID
   */
  async uploadFile(projectId, folderId, fileName, content, userId) {
    const url = `${settings.apis.web.url}/internal/ai-agent/project/${projectId}/file`

    // Keep content as base64 string for JSON body
    const base64Content = typeof content === 'string'
      ? content
      : content.toString('base64')

    logger.info({ projectId, folderId, fileName }, 'Uploading file')

    try {
      const response = await fetchInternal(url, {
        method: 'POST',
        body: JSON.stringify({
          name: fileName,
          content: base64Content,
          folder_id: folderId === 'root' ? null : folderId
        }),
        headers: {
          'X-User-Id': userId
        }
      })

      const result = await response.json()
      logger.info({ projectId, fileId: result.file?._id }, 'File uploaded successfully')

      return result.file
    } catch (error) {
      logger.error({ error, projectId, fileName }, 'Failed to upload file')
      throw error
    }
  },

  /**
   * Create a new folder in the project
   */
  async createFolder(projectId, parentFolderId, folderName, userId) {
    const url = `${settings.apis.web.url}/internal/ai-agent/project/${projectId}/folder`

    try {
      const response = await fetchInternal(url, {
        method: 'POST',
        body: JSON.stringify({
          parent_folder_id: parentFolderId === 'root' ? null : parentFolderId,
          name: folderName
        }),
        headers: {
          'X-User-Id': userId
        }
      })

      const result = await response.json()
      return result.folder
    } catch (error) {
      logger.error({ error, projectId, folderName }, 'Failed to create folder')
      throw error
    }
  },

  /**
   * Delete a document or file
   */
  async deleteEntity(projectId, entityId, entityType, userId) {
    const url = `${settings.apis.web.url}/internal/ai-agent/project/${projectId}/${entityType}/${entityId}`

    try {
      await fetchInternal(url, {
        method: 'DELETE',
        headers: {
          'X-User-Id': userId
        }
      })

      logger.info({ projectId, entityId, entityType }, 'Entity deleted')
      return { success: true }
    } catch (error) {
      logger.error({ error, projectId, entityId }, 'Failed to delete entity')
      throw error
    }
  },

  /**
   * Get file content by ID (for binary files like images)
   */
  async getFileContent(projectId, fileId) {
    const url = `${settings.apis.filestore.url}/project/${projectId}/file/${fileId}`

    try {
      const response = await fetchInternal(url)
      const buffer = await response.arrayBuffer()

      return {
        content: Buffer.from(buffer),
        contentType: response.headers.get('content-type')
      }
    } catch (error) {
      logger.error({ error, projectId, fileId }, 'Failed to get file content')
      throw error
    }
  },

  /**
   * List all files in a project (docs + binary files)
   * Combines docstore and project structure data
   */
  async listAllFiles(projectId) {
    try {
      const [docs, structure] = await Promise.all([
        this.getAllDocs(projectId).catch(() => []),
        this.getProjectStructure(projectId).catch(() => ({ rootFolder: [] }))
      ])

      // Build file tree from structure
      const files = []

      const processFolder = (folder, path = '') => {
        const folderPath = path ? `${path}/${folder.name}` : folder.name

        // Add docs
        if (folder.docs) {
          for (const doc of folder.docs) {
            files.push({
              _id: doc._id,
              name: doc.name,
              path: `${folderPath}/${doc.name}`,
              type: 'doc',
              extension: doc.name.split('.').pop()
            })
          }
        }

        // Add files (binary)
        if (folder.fileRefs) {
          for (const file of folder.fileRefs) {
            files.push({
              _id: file._id,
              name: file.name,
              path: `${folderPath}/${file.name}`,
              type: 'file',
              extension: file.name.split('.').pop()
            })
          }
        }

        // Process subfolders
        if (folder.folders) {
          for (const subfolder of folder.folders) {
            processFolder(subfolder, folderPath)
          }
        }
      }

      if (structure.rootFolder && structure.rootFolder[0]) {
        processFolder(structure.rootFolder[0])
      }

      // Fallback: If structure failed, use docs
      if (files.length === 0 && docs.length > 0) {
        for (const doc of docs) {
          files.push({
            _id: doc._id,
            name: doc.path?.split('/').pop() || 'unknown',
            path: doc.path || '/unknown',
            type: 'doc',
            extension: 'tex'
          })
        }
      }

      return files
    } catch (error) {
      logger.error({ error, projectId }, 'Failed to list all files')
      throw error
    }
  }
}

export default ProjectBridge
