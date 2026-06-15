"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Tournament, TournamentParticipant, Match, Profile } from "@/lib/types"
import { ArrowLeft, Users, Plus, LogOut, Loader2, Check, X } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export default function TournamentPage() {
  const { id } = useParams<{ id: string }>()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [participants, setParticipants] = useState<TournamentParticipant[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [scoreInputs, setScoreInputs] = useState<Record<string, { s1: string; s2: string }>>({})
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    loadData()

    const channel = supabase
      .channel(`tournament-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_participants", filter: `tournament_id=eq.${id}` }, () => {
        loadParticipants()
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${id}` }, () => {
        loadMatches()
      })
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [id])

  async function loadData() {
    await Promise.all([loadTournament(), loadParticipants(), loadMatches()])
    setLoading(false)
  }

  async function loadTournament() {
    const { data } = await supabase
      .from("tournaments")
      .select("*, game:games(*)")
      .eq("id", id)
      .single()
    if (data) setTournament(data as Tournament)
  }

  async function loadParticipants() {
    const { data } = await supabase
      .from("tournament_participants")
      .select("*, profile:profiles(*)")
      .eq("tournament_id", id)
      .order("seed")
    if (data) setParticipants(data as TournamentParticipant[])
  }

  async function loadMatches() {
    const { data } = await supabase
      .from("matches")
      .select("*, player1:profiles!player1_id(*), player2:profiles!player2_id(*), winner:profiles!winner_id(*)")
      .eq("tournament_id", id)
      .order("round")
      .order("id")
    if (data) setMatches(data as Match[])
  }

  async function handleJoin() {
    if (!user) return
    const { error } = await supabase
      .from("tournament_participants")
      .insert([{ tournament_id: id, user_id: user.id }])
    if (!error) loadParticipants()
  }

  async function handleLeave() {
    if (!user) return
    await supabase
      .from("tournament_participants")
      .delete()
      .eq("tournament_id", id)
      .eq("user_id", user.id)
    loadParticipants()
  }

  async function handleGenerateBracket() {
    const { data: allParticipants } = await supabase
      .from("tournament_participants")
      .select("*")
      .eq("tournament_id", id)
      .order("seed")

    if (!allParticipants || allParticipants.length < 2) return

    for (let i = 0; i < allParticipants.length - 1; i += 2) {
      await supabase.from("matches").insert([{
        tournament_id: id,
        round: 1,
        player1_id: allParticipants[i].user_id,
        player2_id: allParticipants[i + 1].user_id,
        status: "pending",
      }])
    }

    await supabase.from("tournaments").update({ status: "ongoing" }).eq("id", id)
    loadData()
  }

  async function handleSubmitScore(matchId: string) {
    const input = scoreInputs[matchId]
    if (!input) return

    const s1 = parseInt(input.s1)
    const s2 = parseInt(input.s2)
    if (isNaN(s1) || isNaN(s2)) return

    const match = matches.find((m) => m.id === matchId)
    if (!match) return

    const winner_id = s1 > s2 ? match.player1_id : s2 > s1 ? match.player2_id : null

    await supabase
      .from("matches")
      .update({ score1: s1, score2: s2, winner_id, status: "completed" })
      .eq("id", matchId)

    setScoreInputs((prev) => {
      const next = { ...prev }
      delete next[matchId]
      return next
    })
    loadMatches()
  }

  const isParticipant = user && participants.some((p) => p.user_id === user.id)

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <p className="text-muted">Tournament not found</p>
      </div>
    )
  }

  const maxRound = matches.length > 0 ? Math.max(...matches.map((m) => m.round)) : 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/championship" className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to Championship
      </Link>

      <div className="glass rounded-3xl p-6 mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">{tournament.name}</h1>
            <div className="flex flex-wrap gap-4">
              <span className="text-sm text-muted">Game: {tournament.game?.name || "Unknown"}</span>
              <span className={cn(
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                tournament.status === "upcoming" && "border-yellow-500/30 text-yellow-400",
                tournament.status === "ongoing" && "border-accent/30 text-accent",
                tournament.status === "completed" && "border-success/30 text-success"
              )}>
                {tournament.status}
              </span>
              <span className="text-sm text-muted flex items-center gap-1">
                <Users className="w-4 h-4" />
                {participants.length} players
              </span>
            </div>
            {tournament.description && (
              <p className="text-sm text-muted mt-3">{tournament.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            {user && !isParticipant && tournament.status === "upcoming" && (
              <button onClick={handleJoin} className="btn-primary px-4 py-2 rounded-xl text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Join
              </button>
            )}
            {user && isParticipant && tournament.status === "upcoming" && (
              <button onClick={handleLeave} className="btn-secondary px-4 py-2 rounded-xl text-sm flex items-center gap-2 text-danger">
                <LogOut className="w-4 h-4" />
                Leave
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-accent" />
                Participants
              </h2>
              {user && tournament.status === "upcoming" && participants.length >= 2 && (
                <button onClick={handleGenerateBracket} className="btn-primary px-3 py-1.5 rounded-xl text-xs">
                  Start Bracket
                </button>
              )}
            </div>
            {participants.length === 0 ? (
              <p className="text-sm text-muted">No participants yet</p>
            ) : (
              <div className="space-y-2">
                {participants.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 glass rounded-xl px-3 py-2.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-accent2 flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </div>
                    <span className="text-sm font-medium">
                      {p.profile?.username || "Anonymous"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {matches.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-muted">
                {participants.length < 2
                  ? "Waiting for more players to join..."
                  : "Generate the bracket to start matches"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                Bracket
              </h2>
              {Array.from({ length: maxRound }, (_, i) => i + 1).map((round) => {
                const roundMatches = matches.filter((m) => m.round === round)
                return (
                  <div key={round}>
                    <h3 className="text-sm text-muted mb-3 font-medium">
                      Round {round}
                      {round === 1 && participants.length > 2 && ` (Round of ${participants.length})`}
                      {round > 1 && ` (Quarterfinals)`}
                      {round > 2 && ` (Semifinals)`}
                      {round > 3 && ` (Final)`}
                    </h3>
                    <div className="space-y-3">
                      {roundMatches.map((match) => {
                        const inputs = scoreInputs[match.id] || { s1: "", s2: "" }
                        return (
                          <div key={match.id} className={cn(
                            "glass rounded-2xl p-4",
                            match.status === "completed" && "border-success/20"
                          )}>
                            <div className="flex items-center gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "text-sm font-medium",
                                    match.winner_id === match.player1_id && "text-success"
                                  )}>
                                    {match.player1?.username || "TBD"}
                                  </span>
                                  {match.status === "completed" && match.winner_id === match.player1_id && (
                                    <Check className="w-3.5 h-3.5 text-success" />
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {match.status === "pending" && user && isParticipant ? (
                                  <>
                                    <input
                                      type="number"
                                      value={inputs.s1}
                                      onChange={(e) => setScoreInputs((prev) => ({
                                        ...prev,
                                        [match.id]: { ...prev[match.id] || { s1: "", s2: "" }, s1: e.target.value },
                                      }))}
                                      className="w-12 bg-background border border-border rounded-lg py-1.5 px-2 text-sm text-center focus:outline-none focus:border-accent/50"
                                      min="0"
                                    />
                                    <span className="text-muted text-xs">:</span>
                                    <input
                                      type="number"
                                      value={inputs.s2}
                                      onChange={(e) => setScoreInputs((prev) => ({
                                        ...prev,
                                        [match.id]: { ...prev[match.id] || { s1: "", s2: "" }, s2: e.target.value },
                                      }))}
                                      className="w-12 bg-background border border-border rounded-lg py-1.5 px-2 text-sm text-center focus:outline-none focus:border-accent/50"
                                      min="0"
                                    />
                                    <button
                                      onClick={() => handleSubmitScore(match.id)}
                                      className="p-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : match.status === "completed" ? (
                                  <span className="text-sm font-mono font-bold">
                                    <span className={match.winner_id === match.player1_id ? "text-success" : ""}>
                                      {match.score1}
                                    </span>
                                    <span className="text-muted mx-1">:</span>
                                    <span className={match.winner_id === match.player2_id ? "text-success" : ""}>
                                      {match.score2}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted">vs</span>
                                )}
                              </div>
                              <div className="flex-1 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <span className={cn(
                                    "text-sm font-medium",
                                    match.winner_id === match.player2_id && "text-success"
                                  )}>
                                    {match.player2?.username || "TBD"}
                                  </span>
                                  {match.status === "completed" && match.winner_id === match.player2_id && (
                                    <Check className="w-3.5 h-3.5 text-success" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
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
