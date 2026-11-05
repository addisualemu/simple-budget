import { useState } from 'react'
import { signIn } from './useAuth.js'

const CLOSED = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request']

export default function SignIn() {
  const [error, setError] = useState(null)

  const start = async () => {
    setError(null)
    try {
      await signIn()
    } catch (e) {
      if (!CLOSED.includes(e.code)) {
        console.error('Could not sign in', e)
        setError('Could not sign in. Please try again.')
      }
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Budget</h1>
      </header>
      <main className="card empty">
        <p>Sign in to see your budget.</p>
        <button className="button" onClick={start}>
          Sign in with Google
        </button>
        {error && (
          <p className="over import-message" role="alert">
            {error}
          </p>
        )}
      </main>
    </div>
  )
}
