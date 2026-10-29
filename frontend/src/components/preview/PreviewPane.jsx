import { useEffect, useRef, useState } from 'react'
import { useReport } from '../../context/reportContext.js'

export default function PreviewPane() {
  const { previewBlob, previewStatus } = useReport()
  const [src, setSrc] = useState(null)
  const srcRef = useRef(null)

  useEffect(() => {
    if (!previewBlob) return undefined

    const url = URL.createObjectURL(previewBlob)
    let cancelled = false
    const image = new Image()

    image.onload = () => {
      if (cancelled) {
        URL.revokeObjectURL(url)
        return
      }

      const previous = srcRef.current
      srcRef.current = url
      setSrc(url)
      if (previous) URL.revokeObjectURL(previous)
    }

    image.src = url

    return () => {
      cancelled = true
      image.onload = null
      if (srcRef.current !== url) URL.revokeObjectURL(url)
    }
  }, [previewBlob])

  useEffect(
    () => () => {
      if (srcRef.current) URL.revokeObjectURL(srcRef.current)
    },
    [],
  )

  return (
    <section className="preview-pane">
      {previewStatus ? (
        <span className="preview-status" role="status">
          {previewStatus}
        </span>
      ) : null}

      <div className="preview-stage">
        {src ? (
          <img className="preview-img" src={src} alt="Vista previa del informe" />
        ) : null}
      </div>
    </section>
  )
}
