import { useRef, useImperativeHandle, forwardRef, useState } from 'react'
import Modal, { type MusicDownloadModalType as _ModalType, type DownloadSelectInfo } from './Modal'

export interface MusicDownloadModalProps {
  onDownloaded?: () => void
}
export interface MusicDownloadModalType {
  show: (info: DownloadSelectInfo) => void
}

/** 下载弹窗的挂载壳：第一次用到时才真正渲染内部 Dialog */
export default forwardRef<MusicDownloadModalType, MusicDownloadModalProps>(({ onDownloaded }, ref) => {
  const modalRef = useRef<_ModalType>(null)
  const [visible, setVisible] = useState(false)

  useImperativeHandle(ref, () => ({
    show(info) {
      if (visible) modalRef.current?.show(info)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          modalRef.current?.show(info)
        })
      }
    },
  }))

  return (
    visible
      ? <Modal ref={modalRef} onDownloaded={onDownloaded} />
      : null
  )
})
