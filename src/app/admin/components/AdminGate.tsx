'use client'

import { createContext, useContext, useState, useEffect } from 'react'

const AUTH_KEY = 'islam360_admin_auth'
const ADMIN_EMAIL = 'REDACTED_EMAIL'
const ADMIN_PASS = 'REDACTED_CREDENTIAL'

const AuthCtx = createContext<any>(null)
export function useAdminAuth() { return useContext(AuthCtx) }

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    try { setAuthed(sessionStorage.getItem(AUTH_KEY) === '1') } catch {}
    setChecking(false)
  }, [])

  function handleLogin() {
    if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
      try { sessionStorage.setItem(AUTH_KEY, '1') } catch {}
      setLoginError('')
      setAuthed(true)
    } else {
      setLoginError('Invalid email or password')
    }
  }

  function logout() {
    try { sessionStorage.removeItem(AUTH_KEY) } catch {}
    setAuthed(false)
  }

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-[#999]">Loading…</div>
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-xl w-full max-w-[380px] border border-[#e0e0e0] shadow">
          <h3 className="text-lg font-bold text-[#1a5c3a] mb-4">🔒 Admin Login</h3>
          <div className="mb-3">
            <label className="text-xs text-[#666] block mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full p-2 border border-[#ccc] rounded text-sm" />
          </div>
          <div className="mb-3">
            <label className="text-xs text-[#666] block mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full p-2 border border-[#ccc] rounded text-sm" />
          </div>
          {loginError && <div className="text-red-500 text-sm mb-3">{loginError}</div>}
          <button onClick={handleLogin} className="w-full py-2 bg-[#1a5c3a] text-white border-none rounded font-bold cursor-pointer hover:bg-[#2a7a4e]">Login</button>
          <a href="/" className="block text-center text-xs text-[#999] mt-3 hover:text-[#1a5c3a]">← Back to site</a>
        </div>
      </div>
    )
  }

  return <AuthCtx.Provider value={{ logout }}>{children}</AuthCtx.Provider>
}