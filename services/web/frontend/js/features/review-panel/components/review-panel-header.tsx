import { FC, memo } from 'react'
import { ReviewPanelResolvedThreadsButton } from './review-panel-resolved-threads-button'
import { useTranslation } from 'react-i18next'
import { PanelHeading } from '@/shared/components/panel-heading'
import useReviewPanelLayout from '../hooks/use-review-panel-layout'
import { useRailContext } from '@/features/ide-redesign/contexts/rail-context'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'
import MaterialIcon from '@/shared/components/material-icon'
import OLTooltip from '@/shared/components/ol/ol-tooltip'

const ReviewPanelHeader: FC = () => {
  const { closeReviewPanel } = useReviewPanelLayout()
  const { t } = useTranslation()
  const newEditor = useIsNewEditorEnabled()
  const { handlePaneCollapse } = useRailContext()

  const handleClose = () => {
    handlePaneCollapse()
  }

  return (
    <div className="review-panel-header">
      {newEditor ? (
        // Custom header matching AI Chat style - no title, icons only
        <div className="review-panel-header-content">
          <div className="review-panel-header-left">
            <ReviewPanelResolvedThreadsButton />
          </div>
          <div className="review-panel-header-right">
            <OLTooltip
              id="close-review-panel"
              description={t('close')}
              overlayProps={{ placement: 'bottom' }}
            >
              <button
                className="review-panel-header-btn"
                onClick={handleClose}
                aria-label={t('close')}
              >
                <MaterialIcon type="close" />
              </button>
            </OLTooltip>
          </div>
        </div>
      ) : (
        <PanelHeading title={t('review')} handleClose={closeReviewPanel}>
          <ReviewPanelResolvedThreadsButton />
        </PanelHeading>
      )}
    </div>
  )
}

export default memo(ReviewPanelHeader)
