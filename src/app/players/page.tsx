"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profile, Match } from "@/lib/types"
import { Trophy, Loader2, Crown, Star, TrendingUp, Zap, Flame } from "lucide-react"
import { cn } from "@/lib/utils"

interface PlayerStats extends Profile {
  wins: number; losses: number; draws: number; tournaments: number; win_streak: number; points: number
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerStats[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { loadPlayers() }, [])

  async function loadPlayers() {
    const { data: profiles } = await supabase.from("profiles").select("*")
    const { data: allMatches } = await supabase.from("matches").select("winner_id, player1_id, player2_id, score1, score2").eq("status", "completed")
    const { data: participants } = await supabase.from("tournament_participants").select("user_id, tournament_id")

    if (profiles && allMatches) {
      const stats: Record<string, { wins: number; losses: number; draws: number; points: number; streak: number; max_streak: number; last_result: string | null }> = {}
      const tournamentCount: Record<string, Set<string>> = {}

      allMatches.forEach((m: any) => {
        const p1 = m.player1_id; const p2 = m.player2_id; const w = m.winner_id
        const s1 = m.score1 ?? 0; const s2 = m.score2 ?? 0
        if (!stats[p1]) stats[p1] = { wins: 0, losses: 0, draws: 0, points: 0, streak: 0, max_streak: 0, last_result: null }
        if (!stats[p2]) stats[p2] = { wins: 0, losses: 0, draws: 0, points: 0, streak: 0, max_streak: 0, last_result: null }
        if (w === p1) { stats[p1].wins++; stats[p2].losses++; stats[p1].points += 3; stats[p2].points += 1;
          stats[p1].streak = (stats[p1].last_result === "W" ? stats[p1].streak : 0) + 1; stats[p2].streak = 0;
          stats[p1].last_result = "W"; stats[p2].last_result = "L";
          if (stats[p1].streak > stats[p1].max_streak) stats[p1].max_streak = stats[p1].streak
        } else if (w === p2) { stats[p2].wins++; stats[p1].losses++; stats[p2].points += 3; stats[p1].points += 1;
          stats[p2].streak = (stats[p2].last_result === "W" ? stats[p2].streak : 0) + 1; stats[p1].streak = 0;
          stats[p2].last_result = "W"; stats[p1].last_result = "L";
          if (stats[p2].streak > stats[p2].max_streak) stats[p2].max_streak = stats[p2].streak
        } else if (s1 === s2) { stats[p1].draws++; stats[p2].draws++; stats[p1].points += 1; stats[p2].points += 1; }
      })

      if (participants) {
        participants.forEach((p: any) => {
          if (!tournamentCount[p.user_id]) tournamentCount[p.user_id] = new Set()
          tournamentCount[p.user_id].add(p.tournament_id)
        })
      }

      const playersWithStats: PlayerStats[] = (profiles as Profile[]).map((p) => ({
        ...p, wins: stats[p.id]?.wins || 0, losses: stats[p.id]?.losses || 0,
        draws: stats[p.id]?.draws || 0, points: stats[p.id]?.points || 0,
        win_streak: stats[p.id]?.streak || 0, tournaments: tournamentCount[p.id]?.size || 0,
      }))
      playersWithStats.sort((a, b) => b.points - a.points || b.wins - a.wins)
      setPlayers(playersWithStats)
    }
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-accent animate-spin" /></div>

  return (
    <div className="min-h-screen">
      <div className="particles-bg">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="particle" />)}</div>
      <div className="max-w-4xl mx-auto px-4 py-8 relative z-10">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold"><span className="text-gradient">Player</span> Rankings</h1>
          <p className="text-muted text-sm mt-1">Leaderboard, stats & glory</p>
        </div>

        {players.length === 0 ? (
          <div className="glass rounded-3xl p-16 text-center animate-slide-up">
            <Trophy className="w-16 h-16 text-muted mx-auto mb-4 animate-float" />
            <p className="text-lg font-semibold">No players yet</p>
            <p className="text-sm text-muted mt-2">Complete matches to appear on the leaderboard</p>
          </div>
        ) : (
          <div className="glass rounded-3xl overflow-hidden animate-slide-up">
            <div className="divide-y divide-border">
              {players.map((player, i) => (
                <div key={player.id}
                  className="flex items-center gap-4 p-5 hover:bg-card-hover transition-all duration-300 animate-slide-up"
                  style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all",
                    i === 0 ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-black animate-pulse-glow" :
                    i === 1 ? "bg-gradient-to-br from-gray-300 to-gray-500 text-black" :
                    i === 2 ? "bg-gradient-to-br from-orange-400 to-red-500 text-white" :
                    "bg-card text-muted"
                  )}>
                    {i === 0 ? <Crown className="w-5 h-5" /> : i === 1 ? <Trophy className="w-4 h-4" /> : i === 2 ? <Star className="w-4 h-4" /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold">{player.username}</p>
                      {player.win_streak >= 3 && (
                        <span className="flex items-center gap-0.5 text-xs text-orange-400 font-medium">
                          <Flame className="w-3 h-3" /> {player.win_streak}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted">
                      <span className="flex items-center gap-1"><Trophy className="w-3 h-3 text-yellow-400" /> {player.tournaments} events</span>
                      {player.win_streak >= 5 && <span className="text-accent flex items-center gap-0.5"><Zap className="w-3 h-3" /> On Fire!</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-5 text-sm">
                    <div className="text-center min-w-[40px]">
                      <p className="text-success font-bold text-lg">{player.wins}</p>
                      <p className="text-[10px] text-muted uppercase tracking-wider">Wins</p>
                    </div>
                    <div className="text-center min-w-[40px]">
                      <p className="text-danger font-bold text-lg">{player.losses}</p>
                      <p className="text-[10px] text-muted uppercase tracking-wider">Loss</p>
                    </div>
                    <div className="text-center min-w-[40px]">
                      <p className="text-accent font-bold text-lg">{player.points}</p>
                      <p className="text-[10px] text-muted uppercase tracking-wider">Pts</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
