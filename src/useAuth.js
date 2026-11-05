import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { auth } from './firebase.js'

export const signIn = () => signInWithPopup(auth, new GoogleAuthProvider())
export const signOutUser = () => signOut(auth)

/** The signed-in user, null when signed out, undefined while still checking. */
export function useAuth() {
  const [user, setUser] = useState(undefined)
  useEffect(() => onAuthStateChanged(auth, setUser), [])
  return user
}
