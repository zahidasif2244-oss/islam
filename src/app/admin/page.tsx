'use client'

import AdminGate, { useAdminAuth } from './components/AdminGate'

export default function AdminHome() {
  return (
    <AdminGate>
      <Hub />
    </AdminGate>
  )
}

function Hub() {
  const { logout } = useAdminAuth()
  return (
    <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[680px]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1a5c3a]">🔒 Admin Pages</h1>
            <p className="text-xs text-[#666] mt-0.5">Choose a manager page below — each opens full-screen.</p>
          </div>
          <div className="flex gap-2">
            <a href="/" className="text-xs text-[#1a5c3a] bg-[#e8f5e9] border border-[#b5d6c0] rounded px-3 py-1.5 no-underline hover:bg-[#d0ead8]">← Site</a>
            <button onClick={logout} className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-1.5 cursor-pointer hover:bg-red-100">Logout</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a href="/admin/books"
            className="no-underline bg-white rounded-xl border border-[#d5e8da] p-6 hover:shadow-lg transition-shadow hover:border-[#1a5c3a]">
            <div className="text-4xl mb-3">📚</div>
            <h2 className="text-lg font-bold text-[#1a5c3a] mb-1">Books</h2>
            <p className="text-sm text-[#666]">Add, edit, delete books, import CSV, manage hidden books.</p>
            <div className="mt-4 text-sm text-[#1a5c3a] font-semibold">Open →</div>
          </a>
          <a href="/admin/duas"
            className="no-underline bg-white rounded-xl border border-[#d5e8da] p-6 hover:shadow-lg transition-shadow hover:border-[#1a5c3a]">
            <div className="text-4xl mb-3">🕌</div>
            <h2 className="text-lg font-bold text-[#1a5c3a] mb-1">Duas</h2>
            <p className="text-sm text-[#666]">Manage duas across Duas / More Duas / Prayers / Janaza / Roza.</p>
            <div className="mt-4 text-sm text-[#1a5c3a] font-semibold">Open →</div>
          </a>
        </div>
      </div>
    </div>
  )
}