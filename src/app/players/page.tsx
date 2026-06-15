"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profile, Match } from "@/lib/types"
import { Users, Trophy, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface PlayerWithStats extends Profile {
  wins: number
  losses: number
  tournaments: number
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadPlayers()
  }, [])

  async function loadPlayers() {
    const { data: profiles } = await supabase.from("profiles").select("*")
    const { data: allMatches } = await supabase
      .from("matches")
      .select("winner_id, player1_id, player2_id")
      .eq("status", "completed")

    const { data: participants } = await supabase
      .from("tournament_participants")
      .select("user_id")

    if (profiles && allMatches) {
      const winCounts: Record<string, number> = {}
      const lossCounts: Record<string, number> = {}
      const tournamentCounts: Record<string, Set<string>> = {}

      allMatches.forEach((m: any) => {
        if (m.winner_id) {
          winCounts[m.winner_id] = (winCounts[m.winner_id] || 0) + 1
        }
        if (m.player1_id && m.winner_id && m.winner_id !== m.player1_id) {
          lossCounts[m.player1_id] = (lossCounts[m.player1_id] || 0) + 1
        }
        if (m.player2_id && m.winner_id && m.winner_id !== m.player2_id) {
          lossCounts[m.player2_id] = (lossCounts[m.player2_id] || 0) + 1
        }
        if (!m.winner_id) {
          if (m.player1_id) lossCounts[m.player1_id] = (lossCounts[m.player1_id] || 0) + 1
          if (m.player2_id) lossCounts[m.player2_id] = (lossCounts[m.player2_id] || 0) + 1
        }
      })

      if (participants) {
        participants.forEach((p: any) => {
          if (!tournamentCounts[p.user_id]) tournamentCounts[p.user_id] = new Set()
          tournamentCounts[p.user_id].add(p.tournament_id)
        })
      }

      const playersWithStats: PlayerWithStats[] = (profiles as Profile[]).map((p) => ({
        ...p,
        wins: winCounts[p.id] || 0,
        losses: lossCounts[p.id] || 0,
        tournaments: tournamentCounts[p.id]?.size || 0,
      }))

      playersWithStats.sort((a, b) => b.wins - a.wins || a.losses - b.losses)
      setPlayers(playersWithStats)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          <span className="text-gradient">Player</span> Rankings
        </h1>
        <p className="text-muted text-sm mt-1">Leaderboard & stats</p>
      </div>

      {players.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center">
          <Users className="w-12 h-12 text-muted mx-auto mb-4" />
          <p className="text-muted">No players yet</p>
        </div>
      ) : (
        <div className="glass rounded-3xl overflow-hidden">
          <div className="divide-y divide-border">
            {players.map((player, i) => (
              <div key={player.id} className="flex items-center gap-4 p-5 hover:bg-card-hover transition-colors">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                  i === 0 ? "bg-yellow-500/20 text-yellow-400" :
                  i === 1 ? "bg-gray-400/20 text-gray-300" :
                  i === 2 ? "bg-orange-500/20 text-orange-400" :
                  "bg-card text-muted"
                )}>
                  {i === 0 ? <Trophy className="w-4 h-4" /> : i + 1}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{player.username}</p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="text-success font-bold">{player.wins}</p>
                    <p className="text-xs text-muted">Wins</p>
                  </div>
                  <div className="text-center">
                    <p className="text-danger font-bold">{player.losses}</p>
                    <p className="text-xs text-muted">Losses</p>
                  </div>
                  <div className="text-center">
                    <p className="text-accent font-bold">{player.tournaments}</p>
                    <p className="text-xs text-muted">Events</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
