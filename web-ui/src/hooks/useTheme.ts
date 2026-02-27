import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

function getStored(): Theme {
  try {
    const v = localStorage.getItem('theme')
    if (v === 'dark' || v === 'light') return v
  } catch {}
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  // Short transition burst
  root.classList.add('theme-transitioning')
  root.setAttribute('data-theme', theme)
  setTimeout(() => root.classList.remove('theme-transitioning'), 350)
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getStored)

  useEffect(() => {
    applyTheme(theme)
    try { localStorage.setItem('theme', theme) } catch {}
  }, [theme])

  const toggle = () => setTheme(t => (t === 'light' ? 'dark' : 'light'))

  return { theme, toggle }
}
