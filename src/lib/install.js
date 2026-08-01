import { useEffect, useState } from 'react'

/* ============================================================
   Installing to an Android home screen
   ------------------------------------------------------------
   On Android an installed PWA is a real launcher entry: own icon, own task in
   recents, no browser chrome. That is what "make it an app" means here, and it
   updates itself — no store, no re-signing, no reinstall.

   Storage is the part worth being precise about. The 7-day eviction people
   worry about is a SAFARI rule and does not apply on Android. Android Chrome
   keeps localStorage until the user clears it or the device runs critically
   low on space — and `navigator.storage.persist()` exempts the site from that
   last case too. Installing the app makes the grant essentially automatic.
   ============================================================ */

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [installed, setInstalled] = useState(
    () =>
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true),
  )

  useEffect(() => {
    const onPrompt = (e) => {
      // Chrome shows its own mini-infobar unless we take the event
      e.preventDefault()
      setDeferred(e)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  return {
    /** Chrome has told us the app meets the install criteria. */
    canInstall: !!deferred,
    installed,
    async install() {
      if (!deferred) return 'unavailable'
      deferred.prompt()
      const { outcome } = await deferred.userChoice
      setDeferred(null)
      return outcome // 'accepted' | 'dismissed'
    },
  }
}

/**
 * Ask the browser to treat this site's storage as persistent. Without it the
 * trip is "best effort" data and can be cleared under storage pressure — which
 * matters because the trip only exists in localStorage.
 */
export async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist) return { supported: false, persisted: false }
    if (await navigator.storage.persisted()) return { supported: true, persisted: true }
    return { supported: true, persisted: await navigator.storage.persist() }
  } catch {
    return { supported: false, persisted: false }
  }
}

/** How much room the trip is actually using, for the settings pane. */
export async function storageEstimate() {
  try {
    if (!navigator.storage?.estimate) return null
    const { usage, quota } = await navigator.storage.estimate()
    return { usage, quota }
  } catch {
    return null
  }
}
