import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBanners } from '../../api/banners'
import { getImageUrl } from '../../api/media'

const ROTATE_INTERVAL_MS = 6000

export function BannerCarousel() {
  const { data: banners } = useBanners()
  const [activeIndex, setActiveIndex] = useState(0)

  const count = banners?.length ?? 0

  useEffect(() => {
    if (count < 2) return
    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % count)
    }, ROTATE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [count])

  if (!banners || banners.length === 0) return null

  return (
    <div className="relative mb-10 aspect-[3/1] w-full overflow-hidden rounded-ui bg-slate-100">
      {banners.map((banner, index) => (
        <Link
          key={banner.id}
          to={banner.target_url}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: index === activeIndex ? 1 : 0, zIndex: index === activeIndex ? 1 : 0 }}
          aria-hidden={index !== activeIndex}
          tabIndex={index === activeIndex ? 0 : -1}
        >
          <img
            src={getImageUrl(banner.image_path) ?? undefined}
            alt={`${banner.title} ${banner.discount_label}`}
            className="h-full w-full object-cover"
          />
        </Link>
      ))}
      {banners.length > 1 && (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {banners.map((banner, index) => (
            <button
              key={banner.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Банер ${index + 1}`}
              className={
                index === activeIndex
                  ? 'h-2 w-2 rounded-full bg-white'
                  : 'h-2 w-2 rounded-full bg-white/50'
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
