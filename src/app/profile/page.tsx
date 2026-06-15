"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { User, LogOut, Mail, Loader2 } from "lucide-react"
import Link from "next/link"
import type { User as UserType } from "@supabase/supabase-js"

export default function ProfilePage() {
  const [user, setUser] = useState<UserType | null>(null)
  const [username, setUsername] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/auth")
        return
      }
      setUser(data.user)
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", data.user.id)
        .single()
      if (profile) setUsername(profile.username || "")
      setLoading(false)
    })
  }, [])

  async function handleSave() {
    if (!user) return
    setSaving(true)
    await supabase
      .from("profiles")
      .upsert({ id: user.id, username })
    setSaving(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="glass rounded-3xl p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent via-accent2 to-accent3 animate-gradient flex items-center justify-center mb-4">
            <User className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold">
            <span className="text-gradient">Profile</span>
          </h1>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-sm text-muted mb-2 block">Email</label>
            <div className="flex items-center gap-3 glass rounded-2xl px-4 py-3">
              <Mail className="w-4 h-4 text-muted" />
              <span className="text-sm">{user.email}</span>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted mb-2 block">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-background border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-3 rounded-2xl text-sm flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
            <button onClick={handleSignOut} className="btn-secondary py-3 px-6 rounded-2xl text-sm flex items-center gap-2 text-danger">
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
