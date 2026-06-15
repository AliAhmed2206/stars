"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useProfile } from "@/lib/useProfile"
import { useRouter } from "next/navigation"
import { Shield, Users, Gamepad2, Trophy, Trash2, Loader2, UserCog } from "lucide-react"
import type { Profile, Game, Tournament } from "@/lib/types"
import { cn } from "@/lib/utils"

type Tab = "overview" | "games" | "users" | "tournaments"

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview")
  const { profile, loading: profileLoading } = useProfile()
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const [allUsers, setAllUsers] = useState<Profile[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])

  useEffect(() => {
    if (!profileLoading && (!profile || profile.role !== "admin")) {
      router.push("/")
      return
    }
    if (profile?.role === "admin") loadData()
  }, [profile, profileLoading])

  async function loadData() {
    const [u, g, t] = await Promise.all([
      supabase.from("profiles").select("*").order("username"),
      supabase.from("games").select("*").order("name"),
      supabase.from("tournaments").select("*, game:games(*)").order("created_at", { ascending: false }),
    ])
    if (u.data) setAllUsers(u.data as Profile[])
    if (g.data) setGames(g.data as Game[])
    if (t.data) setTournaments(t.data as Tournament[])
    setLoading(false)
  }

  async function toggleUserRole(userId: string, currentRole: string) {
    const newRole = currentRole === "admin" ? "user" : "admin"
    await supabase.from("profiles").update({ role: newRole }).eq("id", userId)
    loadData()
  }

  async function deleteGame(gameId: string) {
    await supabase.from("games").delete().eq("id", gameId)
    loadData()
  }

  async function deleteTournament(tId: string) {
    await supabase.from("tournaments").delete().eq("id", tId)
    loadData()
  }

  if (loading || profileLoading) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    )
  }

  if (!profile || profile.role !== "admin") return null

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: Shield },
    { id: "games", label: "Games", icon: Gamepad2 },
    { id: "users", label: "Users", icon: Users },
    { id: "tournaments", label: "Tournaments", icon: Trophy },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent2 flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            <span className="text-gradient">Admin</span> Panel
          </h1>
          <p className="text-xs text-muted">Control center for STARS</p>
        </div>
      </div>

      <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-hide">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-5 py-2.5 rounded-2xl text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap",
              tab === t.id
                ? "btn-primary"
                : "glass text-muted hover:text-foreground"
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="glass rounded-2xl p-6">
            <Users className="w-8 h-8 text-accent mb-3" />
            <p className="text-3xl font-bold">{allUsers.length}</p>
            <p className="text-sm text-muted">Total Users</p>
          </div>
          <div className="glass rounded-2xl p-6">
            <Gamepad2 className="w-8 h-8 text-accent2 mb-3" />
            <p className="text-3xl font-bold">{games.length}</p>
            <p className="text-sm text-muted">Games</p>
          </div>
          <div className="glass rounded-2xl p-6">
            <Trophy className="w-8 h-8 text-accent3 mb-3" />
            <p className="text-3xl font-bold">{tournaments.length}</p>
            <p className="text-sm text-muted">Tournaments</p>
          </div>
        </div>
      )}

      {tab === "games" && (
        <div className="space-y-3">
          {games.map((game) => (
            <div key={game.id} className="glass rounded-2xl p-4 flex items-center gap-4">
              {game.image_url ? (
                <img src={game.image_url} alt={game.name} className="w-12 h-12 rounded-xl object-cover bg-card" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-card flex items-center justify-center text-2xl">
                  {game.icon}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{game.name}</p>
                <p className="text-xs text-muted">{game.category} — {game.description || "No description"}</p>
              </div>
              <button onClick={() => deleteGame(game.id)} className="p-2 rounded-xl hover:bg-danger/10 text-muted hover:text-danger transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "users" && (
        <div className="glass rounded-3xl overflow-hidden">
          <div className="divide-y divide-border">
            {allUsers.map((p) => (
              <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-card-hover transition-colors">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-accent2 flex items-center justify-center text-sm font-bold">
                  {p.username?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{p.username}</p>
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border",
                  p.role === "admin" ? "border-accent/30 text-accent" : "border-border text-muted"
                )}>
                  {p.role}
                </span>
                <button
                  onClick={() => toggleUserRole(p.id, p.role)}
                  className={cn(
                    "p-2 rounded-xl transition-colors",
                    p.role === "admin"
                      ? "hover:bg-danger/10 text-danger hover:text-danger"
                      : "hover:bg-accent/10 text-accent hover:text-accent"
                  )}
                  title={p.role === "admin" ? "Remove admin" : "Make admin"}
                >
                  <UserCog className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "tournaments" && (
        <div className="space-y-3">
          {tournaments.map((t) => (
            <div key={t.id} className="glass rounded-2xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center text-lg">
                {t.game?.icon || "🏆"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{t.name}</p>
                <p className="text-xs text-muted">
                  {t.game?.name || "Unknown"} — {t.status} — {t.created_at?.slice(0, 10)}
                </p>
              </div>
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-medium border",
                t.status === "open" && "border-accent/30 text-accent",
                t.status === "ongoing" && "border-yellow-500/30 text-yellow-400",
                t.status === "completed" && "border-success/30 text-success",
              )}>
                {t.status}
              </span>
              <button onClick={() => deleteTournament(t.id)} className="p-2 rounded-xl hover:bg-danger/10 text-muted hover:text-danger transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
