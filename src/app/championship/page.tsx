"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Tournament, Game } from "@/lib/types"
import Link from "next/link"
import { Plus, Trophy, Users, ArrowRight, Loader2, Gamepad2 } from "lucide-react"
import { cn } from "@/lib/utils"

const statusColors = {
  upcoming: "border-yellow-500/30 text-yellow-400",
  ongoing: "border-accent/30 text-accent",
  completed: "border-success/30 text-success",
}

const categoryIcons: Record<string, string> = {
  playstation: "🎮",
  football: "⚽",
  padel: "🎾",
  esports: "🎯",
  card_games: "🃏",
}

export default function ChampionshipPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [gameId, setGameId] = useState("")
  const [startDate, setStartDate] = useState("")
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    loadData()

    const channel = supabase
      .channel("tournaments-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, () => {
        loadData()
      })
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [])

  async function loadData() {
    const [tournamentsRes, gamesRes] = await Promise.all([
      supabase.from("tournaments").select("*, game:games(*)").order("created_at", { ascending: false }),
      supabase.from("games").select("*").order("name"),
    ])
    if (tournamentsRes.data) setTournaments(tournamentsRes.data as Tournament[])
    if (gamesRes.data) setGames(gamesRes.data as Game[])
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    await supabase.from("tournaments").insert([{
      name,
      description: description || null,
      game_id: gameId,
      start_date: startDate || null,
      status: "upcoming",
      created_by: user.id,
    }])

    setName("")
    setDescription("")
    setGameId("")
    setStartDate("")
    setShowForm(false)
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">
            <span className="text-gradient">Stars Sports</span> Championship
          </h1>
          <p className="text-muted text-sm mt-1">Tournaments, brackets & glory</p>
        </div>
        {user && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary px-5 py-2.5 rounded-2xl text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Tournament
          </button>
        )}
      </div>

      {showForm && (
        <div className="glass rounded-3xl p-6 mb-8 animate-glow">
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Tournament name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-background border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50"
              required
            />
            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-background border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 resize-none h-20"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <select
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
                className="bg-background border border-border rounded-2xl py-3 px-4 text-sm text-foreground focus:outline-none focus:border-accent/50"
                required
              >
                <option value="">Select a game</option>
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-background border border-border rounded-2xl py-3 px-4 text-sm text-foreground focus:outline-none focus:border-accent/50"
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary px-6 py-2.5 rounded-2xl text-sm">Create Tournament</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary px-6 py-2.5 rounded-2xl text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {tournaments.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center">
          <Trophy className="w-12 h-12 text-muted mx-auto mb-4" />
          <p className="text-muted mb-4">No tournaments yet</p>
          {user && (
            <button onClick={() => setShowForm(true)} className="btn-primary px-6 py-2.5 rounded-2xl text-sm inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create First Tournament
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tournaments.map((t) => (
            <Link
              key={t.id}
              href={`/championship/${t.id}`}
              className="glass rounded-2xl p-6 glass-hover transition-all duration-300 group"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{t.game ? categoryIcons[t.game.category] || "🎯" : "🎯"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted">{t.game?.name || "Unknown Game"}</p>
                  <p className="text-xs text-accent">{t.game?.category || ""}</p>
                </div>
              </div>
              <h3 className="font-semibold text-lg mb-2 truncate">{t.name}</h3>
              <div className="flex items-center justify-between">
                <span className={cn(
                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                  statusColors[t.status]
                )}>
                  {t.status}
                </span>
                <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
