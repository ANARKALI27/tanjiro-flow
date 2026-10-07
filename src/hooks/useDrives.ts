import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/ipc'
import type { DriveInfo, FlowError, Place } from '../lib/types'

/** Drives and user folders, refreshed on demand (and when a window regains focus). */
export function useSystemPlaces() {
  const [drives, setDrives] = useState<DriveInfo[]>([])
  const [places, setPlaces] = useState<Place[]>([])
  const [error, setError] = useState<FlowError | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    setLoading(true)
    Promise.all([api.drives(), api.places()])
      .then(([d, p]) => {
        setDrives(d)
        setPlaces(p)
        setError(null)
      })
      .catch((e: FlowError) => setError(e))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
    // A USB stick plugged in while the window was in the background should
    // show up when the user comes back to it.
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  return { drives, places, error, loading, refresh }
}
