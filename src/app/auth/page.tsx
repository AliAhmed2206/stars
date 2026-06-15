"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useProfile } from "@/lib/useProfile"
import { Sparkles, Users, User, Loader2, Plus, Check } from "lucide-react"
import type { Profile } from "@/lib/types"

export default function AuthPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { selectProfile } = useProfile()

  useEffect(() => {
    supabase.from("profiles").select("*").order("username").then(({ data }) => {
      if (data) setProfiles(data as Profile[])
      setLoading(false)
    })
  }, [])

  function handleSelect(p: Profile) {
    selectProfile(p)
    router.push("/")
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    const { data } = await supabase.from("profiles").insert([{ username: newName.trim() }]).select().single()
    if (data) {
      selectProfile(data as Profile)
      router.push("/")
    }
    setCreating(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-accent animate-spin" /></div>

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="glass rounded-3xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent via-accent2 to-accent3 animate-gradient flex items-center justify-center mb-4 animate-glow">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold">
              <span className="text-gradient">Welcome to</span> STARS
            </h1>
            <p className="text-muted text-sm mt-1">Pick your name to get started</p>
          </div>

          {!showCreate ? (
            <>
              <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-hide mb-4">
                {profiles.map((p) => (
                  <button key={p.id} onClick={() => handleSelect(p)}
                    className="w-full glass rounded-2xl p-4 flex items-center gap-3 glass-hover transition-all text-left">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-accent2 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                      {p.username?.[0]?.toUpperCase() || "?"}
                    </div>
                    <span className="font-medium">{p.username}</span>
                    {p.role === "admin" && <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] border border-accent/30 text-accent">Admin</span>}
                  </button>
                ))}
              </div>

              <button onClick={() => setShowCreate(true)}
                className="w-full py-3 rounded-2xl text-sm text-muted hover:text-foreground border border-dashed border-border hover:border-accent/30 transition-all flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Add your name
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-background border border-border rounded-2xl py-3 pl-12 pr-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors"
                  autoFocus onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
              </div>
              <div className="flex gap-3">
                <button onClick={handleCreate} disabled={creating || !newName.trim()}
                  className="btn-primary flex-1 py-3 rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Join STARS
                </button>
                <button onClick={() => setShowCreate(false)} className="btn-secondary py-3 px-6 rounded-2xl text-sm">
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
