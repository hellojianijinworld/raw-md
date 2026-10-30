import { useEffect, useState } from 'react'

/**
 * iOS Safari 스타일 스크롤 툴바.
 * - 모바일(≤768px): 스크롤 다운 → 숨김, 스크롤 업 → 표시
 * - 데스크탑: 항상 표시
 */
export function useScrollToolbar(threshold = 10): boolean {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const isMobile = () => window.innerWidth <= 768 && window.matchMedia('(orientation: portrait)').matches

    // 데스크탑이면 항상 보이기
    if (!isMobile()) return

    let lastScrollY = window.scrollY
    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY
          const diff = lastScrollY - currentY

          if (Math.abs(diff) < threshold) {
            ticking = false
            return
          }

          // 맨 위에 있으면 항상 보이기
          if (currentY <= 0) {
            setVisible(true)
          } else if (diff > 0) {
            // 스크롤 업 → 표시
            setVisible(true)
          } else {
            // 스크롤 다운 → 숨김
            setVisible(false)
          }

          lastScrollY = currentY
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [threshold])

  return visible
}
