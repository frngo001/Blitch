import { useTranslation } from 'react-i18next'
import FileTreeCreateNewDoc from './modes/file-tree-create-new-doc'
import FileTreeImportFromUrl from './modes/file-tree-import-from-url'
import FileTreeImportFromProject from './modes/file-tree-import-from-project'
import FileTreeModalCreateFileMode from './file-tree-modal-create-file-mode'
import FileTreeCreateNameProvider from '../../contexts/file-tree-create-name'
import { useFileTreeActionable } from '../../contexts/file-tree-actionable'
import { useFileTreeData } from '../../../../shared/context/file-tree-data-context'

import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import { ElementType, lazy, Suspense } from 'react'
import { FullSizeLoadingSpinner } from '@/shared/components/loading-spinner'
import getMeta from '@/utils/meta'
import OLNotification from '@/shared/components/ol/ol-notification'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'

const createFileModeModules = importOverleafModules('createFileModes') as {
  import: { CreateFilePane: ElementType; CreateFileMode: ElementType }
  path: string
}[]

const FileTreeUploadDoc = lazy(() => import('./modes/file-tree-upload-doc'))

// Dark theme styles for new editor
const darkThemeStyles = {
  sidebar: {
    background: '#1C1C1C',
    borderRight: '1px solid rgba(255, 255, 255, 0.08)',
  },
  body: {
    background: '#0D0D0D',
  },
}

export default function FileTreeModalCreateFileBody() {
  const { t } = useTranslation()
  const newEditor = useIsNewEditorEnabled()

  const { newFileCreateMode } = useFileTreeActionable()
  const { fileCount } = useFileTreeData()
  const {
    hasLinkedProjectFileFeature,
    hasLinkedProjectOutputFileFeature,
    hasLinkUrlFeature,
  } = getMeta('ol-ExposedSettings')

  if (typeof fileCount !== 'number' && fileCount.status === 'error') {
    return (
      <div className="p-4">
        <OLNotification
          type="error"
          content={t('project_has_too_many_files_limit', {
            limit: fileCount.limit,
          })}
        />
      </div>
    )
  }

  if (!fileCount) {
    return null
  }

  return (
    <table style={newEditor ? { background: 'transparent' } : undefined}>
      <tbody>
        <tr>
          <td
            className="modal-new-file-list"
            style={newEditor ? darkThemeStyles.sidebar : undefined}
          >
            <ul className="list-unstyled">
              <FileTreeModalCreateFileMode
                mode="doc"
                icon="description"
                label={t('new_file')}
              />

              <FileTreeModalCreateFileMode
                mode="upload"
                icon="upload"
                label={t('upload')}
              />

              {(hasLinkedProjectFileFeature ||
                hasLinkedProjectOutputFileFeature) && (
                <FileTreeModalCreateFileMode
                  mode="project"
                  icon="folder_open"
                  label={t('from_another_project')}
                />
              )}

              {hasLinkUrlFeature && (
                <FileTreeModalCreateFileMode
                  mode="url"
                  icon="globe"
                  label={t('from_external_url')}
                />
              )}

              {createFileModeModules.map(
                ({ import: { CreateFileMode }, path }) => (
                  <CreateFileMode key={path} />
                )
              )}
            </ul>
          </td>

          <td
            className={`modal-new-file-body modal-new-file-body-${newFileCreateMode}`}
            style={newEditor ? darkThemeStyles.body : undefined}
          >
            {typeof fileCount !== 'number' &&
              fileCount.status === 'warning' && (
                <OLNotification
                  type="warning"
                  className={`mb-3 ${newFileCreateMode === 'upload' ? 'mt-0' : 'mt-3'}`}
                  content={
                    <>
                      {t('project_approaching_file_limit')} ({fileCount.value}/
                      {fileCount.limit})
                    </>
                  }
                />
              )}
            {newFileCreateMode === 'doc' && (
              <FileTreeCreateNameProvider initialName="name.tex">
                <FileTreeCreateNewDoc />
              </FileTreeCreateNameProvider>
            )}

            {newFileCreateMode === 'url' && (
              <FileTreeCreateNameProvider>
                <FileTreeImportFromUrl />
              </FileTreeCreateNameProvider>
            )}

            {newFileCreateMode === 'project' && (
              <FileTreeCreateNameProvider>
                <FileTreeImportFromProject />
              </FileTreeCreateNameProvider>
            )}

            {newFileCreateMode === 'upload' && (
              <Suspense fallback={<FullSizeLoadingSpinner delay={500} />}>
                <FileTreeUploadDoc />
              </Suspense>
            )}

            {createFileModeModules.map(
              ({ import: { CreateFilePane }, path }) => (
                <CreateFilePane key={path} />
              )
            )}
          </td>
        </tr>
      </tbody>
    </table>
  )
}
