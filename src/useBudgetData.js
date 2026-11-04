import { initializeApp } from 'firebase/app'
import { doc, getFirestore, onSnapshot, setDoc } from 'firebase/firestore'
import { useCallback, useEffect, useRef, useState } from 'react'
import { emptyData } from './budget.js'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

// The whole budget is one document. It stays far below Firestore's 1 MiB limit.
const budgetDoc = doc(getFirestore(initializeApp(firebaseConfig)), 'budgets', 'main')

const SAVE_DELAY_MS = 500
const OLD_STORAGE_KEY = 'budget-data'

/** Data from before the move to Firestore, if this browser has any. */
function localData() {
  const saved = localStorage.getItem(OLD_STORAGE_KEY)
  return saved ? { ...emptyData(), ...JSON.parse(saved) } : emptyData()
}

/**
 * Loads the budget and keeps it in sync with Firestore, so other devices see
 * changes live. status is 'loading', 'saved', 'saving' or 'error'.
 */
export function useBudgetData() {
  const [data, setDataState] = useState(null)
  const [status, setStatus] = useState('loading')
  const latest = useRef(null)
  const unsaved = useRef(false)
  const timer = useRef(null)

  const save = useCallback(async () => {
    clearTimeout(timer.current)
    timer.current = null
    const sent = latest.current
    try {
      await setDoc(budgetDoc, sent)
      if (latest.current === sent) {
        unsaved.current = false
        setStatus('saved')
      }
    } catch (error) {
      console.error('Could not save budget', error)
      setStatus('error')
    }
  }, [])

  const setData = useCallback(
    (update) => {
      latest.current = typeof update === 'function' ? update(latest.current) : update
      unsaved.current = true
      setDataState(latest.current)
      setStatus('saving')
      clearTimeout(timer.current)
      timer.current = setTimeout(save, SAVE_DELAY_MS)
    },
    [save],
  )

  useEffect(
    () =>
      onSnapshot(
        budgetDoc,
        (snapshot) => {
          // Local edits win until saved, or a late snapshot would undo typing.
          if (snapshot.metadata.hasPendingWrites || unsaved.current) return
          if (snapshot.exists()) {
            latest.current = { ...emptyData(), ...snapshot.data() }
            setDataState(latest.current)
            setStatus('saved')
          } else if (!snapshot.metadata.fromCache) {
            // A brand new database: start from this browser's old data.
            setData(localData())
          }
        },
        (error) => {
          console.error('Could not load budget', error)
          setStatus('error')
        },
      ),
    [setData],
  )

  // Don't lose the last edit if the tab is closed during the save delay.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden' && timer.current) save()
    }
    document.addEventListener('visibilitychange', flush)
    return () => document.removeEventListener('visibilitychange', flush)
  }, [save])

  return { data, setData, status }
}
