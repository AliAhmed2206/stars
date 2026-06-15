"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { User, LogOut, Mail, Loader2, Trophy, Gamepad2, CalendarDays, Check, X } from "lucide-react"
import Link from "next/link"
import type { User as UserType } from "@supabase/supabase-js"
import type { Match, Tournament } from "@/lib/types"
import { cn } from "@/lib/utils"

export default function ProfilePage() {
  const [user, setUser] = useState<UserType | null>(null)
  const [username, setUsername] = useState("")
  const [bio, setBio] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [myMatches, setMyMatches] = useState<(Match & { tournament?: Tournament })[]>([])
  const [stats, setStats] = useState({ wins: 0, losses: 0, draws: 0, points: 0 })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/auth"); return }
      setUser(data.user)
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single()
      if (profile) { setUsername(profile.username || ""); setBio(profile.bio || "") }

      // Load match history
      const { data: matches } = await supabase
        .from("matches")
        .select("*, player1:profiles!player1_id(*), player2:profiles!player2_id(*), winner:profiles!winner_id(*), tournament:tournaments(id, name, game:games(name))")
        .or(`player1_id.eq.${data.user.id},player2_id.eq.${data.user.id}`)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(20)
      if (matches) {
        setMyMatches(matches as any)
        let w = 0, l = 0, d = 0
        matches.forEach((m: any) => {
          if (m.winner_id === data.user.id) w++
          else if (m.winner_id && m.winner_id !== data.user.id) l++
          else if (m.status === "completed" && !m.winner_id) d++
        })
        setStats({ wins: w, losses: l, draws: d, points: w * 3 + d * 1 })
      }
      setLoading(false)
    })
  }, [])

  async function handleSave() {
    if (!user) return
    setSaving(true)
    await supabase.from("profiles").upsert({ id: user.id, username, bio })
    setSaving(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/"); router.refresh()
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-accent animate-spin" /></div>
  if (!user) return null

  return (
    <div className="min-h-screen">
      <div className="particles-bg">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="particle" />)}</div>
      <div className="max-w-3xl mx-auto px-4 py-8 relative z-10">
        <div className="glass rounded-3xl p-8 mb-8 animate-slide-up">
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent via-accent2 to-accent3 animate-gradient flex items-center justify-center mb-4 animate-glow">
              <User className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold"><span className="text-gradient">Profile</span></h1>
          </div>

          <div className="space-y-5 max-w-md mx-auto">
            <div>
              <label className="text-sm text-muted mb-2 block">Email</label>
              <div className="flex items-center gap-3 glass rounded-2xl px-4 py-3">
                <Mail className="w-4 h-4 text-muted" />
                <span className="text-sm">{user.email}</span>
              </div>
            </div>
            <div>
              <label className="text-sm text-muted mb-2 block">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-background border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors" />
            </div>
            <div>
              <label className="text-sm text-muted mb-2 block">Bio</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
                placeholder="Tell the crew about yourself..."
                className="w-full bg-background border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 resize-none transition-colors" />
            </div>
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving}
                className="btn-primary flex-1 py-3 rounded-2xl text-sm flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save Changes
              </button>
              <button onClick={handleSignOut} className="btn-secondary py-3 px-6 rounded-2xl text-sm flex items-center gap-2 text-danger">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8 animate-slide-up">
          <div className="glass rounded-2xl p-5 text-center">
            <p className="text-3xl font-bold text-success">{stats.wins}</p>
            <p className="text-xs text-muted mt-1">Wins</p>
          </div>
          <div className="glass rounded-2xl p-5 text-center">
            <p className="text-3xl font-bold text-danger">{stats.losses}</p>
            <p className="text-xs text-muted mt-1">Losses</p>
          </div>
          <div className="glass rounded-2xl p-5 text-center">
            <p className="text-3xl font-bold text-accent">{stats.points}</p>
            <p className="text-xs text-muted mt-1">Points</p>
          </div>
        </div>

        {/* Match History */}
        <div className="glass rounded-3xl p-6 animate-slide-up">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-accent" /> Match History
          </h2>
          {myMatches.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">No matches played yet</p>
          ) : (
            <div className="space-y-2">
              {myMatches.map((match, i) => {
                const isWinner = match.winner_id === user?.id
                const isDraw = match.status === "completed" && !match.winner_id
                return (
                  <div key={match.id} className={cn(
                    "glass rounded-xl p-4 flex items-center gap-4 transition-all animate-slide-up",
                    isWinner && "border-success/20",
                    isDraw && "border-yellow-500/20"
                  )} style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs",
                      isWinner ? "bg-success/20 text-success" : isDraw ? "bg-yellow-500/20 text-yellow-400" : "bg-danger/20 text-danger"
                    )}>
                      {isWinner ? <Check className="w-4 h-4" /> : isDraw ? "-" : <X className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {(match as any).player1?.username || "?"} vs {(match as any).player2?.username || "?"}
                      </p>
                      <p className="text-xs text-muted">
                        {(match as any).tournament?.name || "Tournament"} {(match as any).tournament?.game?.name && ` - ${(match as any).tournament.game.name}`}
                      </p>
                    </div>
                    <div className="text-sm font-mono font-bold">
                      <span className={isWinner ? "text-success" : ""}>{match.score1}</span>
                      <span className="text-muted mx-1">-</span>
                      <span className={!isWinner && !isDraw ? "text-success" : ""}>{match.score2}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
