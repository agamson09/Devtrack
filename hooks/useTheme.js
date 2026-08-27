import { useState, useEffect, useCallback } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    const isLight = document.documentElement.classList.contains('light')
    setTheme(isLight ? 'light' : 'dark')

    const observer = new MutationObserver(() => {
      const isLight = document.documentElement.classList.contains('light')
      setTheme(isLight ? 'light' : 'dark')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const toggleTheme = useCallback(() => {
    const next = document.documentElement.classList.contains('light') ? 'dark' : 'light'
    document.documentElement.classList.toggle('light', next === 'light')
    try { localStorage.setItem('devtrack_theme', next) } catch {}
  }, [])

  return { theme, isLight: theme === 'light', toggleTheme }
}
