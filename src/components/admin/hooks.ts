'use client'
import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(false)
  useEffect(() => {
    const m = window.matchMedia(query)
    setMatch(m.matches)
    const on = () => setMatch(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [query])
  return match
}

/** Where a flick would come to rest (Apple's scroll deceleration, d = 0.998). */
export function project(velocity: number, deceleration = 0.998): number {
  return ((velocity / 1000) * deceleration) / (1 - deceleration)
}
