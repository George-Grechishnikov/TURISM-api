import { useEffect, useState } from 'react'

/**
 * Фото места с API: при пустом URL или ошибке загрузки (таймаут, блокировка CDN) — заглушка ◆.
 */
export function PlacePhotoImg({ src, alt = '', className, placeholderClassName }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (!src || failed) {
    return (
      <div className={placeholderClassName} aria-hidden>
        <span>◆</span>
      </div>
    )
  }

  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} loading="lazy" />
}
