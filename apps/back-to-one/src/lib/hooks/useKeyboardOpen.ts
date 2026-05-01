import { useEffect, useState } from 'react'

// Returns true while a text-input element is focused, which is the most
// reliable proxy for "the on-screen keyboard is up" — especially in iOS
// PWA standalone mode, where visualViewport resize events are unreliable.
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined') return

    const isTextInput = (el: Element | null): boolean => {
      if (!el) return false
      const html = el as HTMLElement
      if (html.isContentEditable) return true
      const tag = el.tagName
      if (tag === 'TEXTAREA') return true
      if (tag === 'INPUT') {
        const type = (el as HTMLInputElement).type
        const TEXT_TYPES = [
          'text', 'email', 'password', 'search', 'number', 'tel', 'url',
          'date', 'datetime-local', 'time', 'month', 'week', '',
        ]
        return TEXT_TYPES.includes(type)
      }
      return false
    }

    const update = () => setOpen(isTextInput(document.activeElement))
    update()

    const onFocusIn = () => update()
    const onFocusOut = () => {
      // focusout fires before focus actually moves; defer so activeElement
      // reflects the next focus target (or body).
      setTimeout(update, 0)
    }

    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    document.addEventListener('visibilitychange', update)
    window.addEventListener('pageshow', update)

    // Safety-net poll. In iOS PWA, a focused input that's removed from the
    // DOM (e.g. when a sheet closes) sometimes does not fire focusout, so
    // the hook can get stuck at open=true. A cheap 500ms re-check of
    // activeElement clears that state without relying on the missing event.
    const interval = setInterval(update, 500)

    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('pageshow', update)
      clearInterval(interval)
    }
  }, [])

  return open
}
