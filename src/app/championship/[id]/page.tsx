"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Tournament, TournamentParticipant, Match, TournamentGroup, Profile, GameFormat } from "@/lib/types"
import { ArrowLeft, Users, Plus, LogOut, Loader2, Check, Trophy, RefreshCw, Sparkles } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export default function TournamentPage() {
  const { id } = useParams<{ id: string }>()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [participants, setParticipants] = useState<TournamentParticipant[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [groups, setGroups] = useState<TournamentGroup[]>([])
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
    await Promise.all([loadTournament(), loadParticipants(), loadMatches(), loadGroups()])
    setLoading(false)
  }

  async function loadTournament() {
    const { data } = await supabase
      .from("tournaments")
      .select("*, game:games(*), format:game_formats(*)")
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

  async function loadGroups() {
    const { data } = await supabase
      .from("tournament_groups")
      .select("*")
      .eq("tournament_id", id)
      .order("name")
    if (data) setGroups(data as TournamentGroup[])
  }

  async function handleJoin() {
    if (!user) return
    await supabase
      .from("tournament_participants")
      .insert([{ tournament_id: id, user_id: user.id }])
    loadParticipants()
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
    if (!tournament?.format) return

    const formatType = tournament.format.type
    const playersPerTeam = tournament.format.players_per_team

    const shuffled = [...participants].sort(() => Math.random() - 0.5)

    if (formatType === "showdown") {
      for (let i = 0; i < shuffled.length; i += 2) {
        if (i + 1 < shuffled.length) {
          await supabase.from("matches").insert([{
            tournament_id: id,
            round: 1,
            player1_id: shuffled[i].user_id,
            player2_id: shuffled[i + 1].user_id,
            status: "pending",
          }])
        }
      }
    } else if (formatType === "group_knockout") {
      const groupSize = 4
      const numGroups = Math.max(2, Math.floor(shuffled.length / groupSize))
      const groupNames = "ABCDEFGHIJ".split("").slice(0, numGroups)
      const groupIds: string[] = []

      for (const name of groupNames) {
        const { data } = await supabase
          .from("tournament_groups")
          .insert([{ tournament_id: id, name: `Group ${name}` }])
          .select()
          .single()
        if (data) groupIds.push(data.id)
      }

      shuffled.forEach((p, i) => {
        const groupIdx = i % numGroups
        supabase.from("tournament_participants").update({ group_id: groupIds[groupIdx], seed: Math.floor(i / numGroups) + 1 }).eq("id", p.id).then()
      })

      for (let g = 0; g < numGroups; g++) {
        const groupPlayers = shuffled.filter((_, i) => i % numGroups === g)
        for (let i = 0; i < groupPlayers.length; i++) {
          for (let j = i + 1; j < groupPlayers.length; j++) {
            await supabase.from("matches").insert([{
              tournament_id: id,
              group_id: groupIds[g],
              round: 1,
              player1_id: groupPlayers[i].user_id,
              player2_id: groupPlayers[j].user_id,
              status: "pending",
            }])
          }
        }
      }
    } else if (formatType === "round_robin") {
      for (let i = 0; i < shuffled.length; i++) {
        for (let j = i + 1; j < shuffled.length; j++) {
          await supabase.from("matches").insert([{
            tournament_id: id,
            round: 1,
            player1_id: shuffled[i].user_id,
            player2_id: shuffled[j].user_id,
            status: "pending",
          }])
        }
      }
    } else if (formatType === "teams") {
      const teamSize = playersPerTeam || 2
      const teams: { user_id: string; team_id: number }[] = []
      shuffled.forEach((p, i) => {
        teams.push({ user_id: p.user_id, team_id: Math.floor(i / teamSize) })
      })
      const teamIds = [...new Set(teams.map((t) => t.team_id))]
      for (let i = 0; i < teamIds.length; i += 2) {
        if (i + 1 < teamIds.length) {
          const t1 = teams.filter((t) => t.team_id === teamIds[i])
          const t2 = teams.filter((t) => t.team_id === teamIds[i + 1])
          await supabase.from("matches").insert([{
            tournament_id: id,
            round: 1,
            player1_id: t1[0]?.user_id || null,
            player2_id: t2[0]?.user_id || null,
            status: "pending",
          }])
        }
      }
    } else {
      // knockout
      for (let i = 0; i < shuffled.length - 1; i += 2) {
        await supabase.from("matches").insert([{
          tournament_id: id,
          round: 1,
          player1_id: shuffled[i].user_id,
          player2_id: shuffled[i + 1].user_id,
          status: "pending",
        }])
      }
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
  const canStart = tournament?.status === "open" && participants.length >= 2

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
  const matchesByGroup = groups.reduce<Record<string, Match[]>>((acc, g) => {
    acc[g.id] = matches.filter((m) => m.group_id === g.id)
    return acc
  }, {})
  const ungroupedMatches = matches.filter((m) => !m.group_id)

  const groupedParticipants = participants.reduce<Record<string, TournamentParticipant[]>>((acc, p) => {
    const key = p.group_id || "ungrouped"
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href="/championship" className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to Championship
      </Link>

      {/* Header */}
      <div className="glass rounded-3xl p-6 mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              {tournament.game?.image_url ? (
                <img src={tournament.game.image_url} alt={tournament.game.name} className="w-10 h-10 rounded-xl object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              ) : (
                <span className="text-2xl">{tournament.game?.icon || "🏆"}</span>
              )}
              <h1 className="text-2xl font-bold truncate">{tournament.name}</h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <span className="text-sm text-muted">{tournament.game?.name}</span>
              {tournament.format && (
                <span className="text-sm text-accent">{tournament.format.name}</span>
              )}
              <span className={cn(
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                tournament.status === "open" && "border-accent/30 text-accent",
                tournament.status === "ongoing" && "border-blue-500/30 text-blue-400",
                tournament.status === "completed" && "border-success/30 text-success",
              )}>
                {tournament.status}
              </span>
              <span className="text-sm text-muted flex items-center gap-1">
                <Users className="w-4 h-4" />
                {participants.length} / {tournament.max_participants} players
              </span>
            </div>
            {tournament.description && (
              <p className="text-sm text-muted mt-3">{tournament.description}</p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {user && !isParticipant && tournament.status === "open" && (
              <button onClick={handleJoin} className="btn-primary px-4 py-2 rounded-xl text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Join
              </button>
            )}
            {user && isParticipant && tournament.status === "open" && (
              <button onClick={handleLeave} className="btn-secondary px-4 py-2 rounded-xl text-sm flex items-center gap-2 text-danger">
                <LogOut className="w-4 h-4" />
                Leave
              </button>
            )}
            {canStart && (
              <button onClick={handleGenerateBracket} className="btn-primary px-4 py-2 rounded-xl text-sm flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Generate Bracket
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Participants sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass rounded-2xl p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-accent" />
              Participants
            </h3>
            {participants.length === 0 ? (
              <p className="text-sm text-muted">No participants yet</p>
            ) : groups.length > 0 ? (
              <div className="space-y-4">
                {Object.entries(groupedParticipants).map(([groupId, groupParts]) => {
                  const group = groups.find((g) => g.id === groupId)
                  return (
                    <div key={groupId}>
                      {group && <p className="text-xs text-muted font-medium mb-2">{group.name}</p>}
                      <div className="space-y-1.5">
                        {groupParts.map((p, i) => (
                          <div key={p.id} className="flex items-center gap-2.5 glass rounded-xl px-3 py-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent to-accent2 flex items-center justify-center text-xs font-bold">
                              {p.seed || i + 1}
                            </div>
                            <span className="text-sm">{p.profile?.username || "Anonymous"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-1.5">
                {participants.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2.5 glass rounded-xl px-3 py-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent to-accent2 flex items-center justify-center text-xs font-bold">
                      {p.seed || i + 1}
                    </div>
                    <span className="text-sm">{p.profile?.username || "Anonymous"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Matches / Bracket */}
        <div className="lg:col-span-2 space-y-6">
          {matches.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <Trophy className="w-12 h-12 text-muted mx-auto mb-4" />
              <p className="text-muted">
                {participants.length < 2
                  ? "Waiting for players to join..."
                  : "Generate the bracket to start!"}
              </p>
              {canStart && (
                <button onClick={handleGenerateBracket} className="btn-primary px-6 py-2.5 rounded-2xl text-sm mt-4 inline-flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Generate Bracket
                </button>
              )}
            </div>
          ) : groups.length > 0 ? (
            // Group stage view
            groups.map((group) => {
              const groupMatches = matches.filter((m) => m.group_id === group.id)
              if (groupMatches.length === 0) return null
              return (
                <div key={group.id}>
                  <h3 className="font-semibold flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-accent" />
                    {group.name}
                  </h3>
                  <div className="space-y-2">
                    {groupMatches.map((match) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        user={user}
                        isParticipant={isParticipant}
                        scoreInputs={scoreInputs}
                        setScoreInputs={setScoreInputs}
                        onSubmitScore={handleSubmitScore}
                      />
                    ))}
                  </div>
                </div>
              )
            })
          ) : (
            // Standard bracket view
            Array.from({ length: maxRound }, (_, i) => i + 1).map((round) => {
              const roundMatches = ungroupedMatches.filter((m) => m.round === round)
              if (roundMatches.length === 0) return null
              return (
                <div key={round}>
                  <h3 className="font-semibold flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-accent" />
                    Round {round}
                  </h3>
                  <div className="space-y-2">
                    {roundMatches.map((match) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        user={user}
                        isParticipant={isParticipant}
                        scoreInputs={scoreInputs}
                        setScoreInputs={setScoreInputs}
                        onSubmitScore={handleSubmitScore}
                      />
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function MatchCard({
  match, user, isParticipant, scoreInputs, setScoreInputs, onSubmitScore,
}: {
  match: Match
  user: any
  isParticipant?: boolean
  scoreInputs: Record<string, { s1: string; s2: string }>
  setScoreInputs: (updater: (prev: Record<string, { s1: string; s2: string }>) => Record<string, { s1: string; s2: string }>) => void
  onSubmitScore: (matchId: string) => void
}) {
  const inputs = scoreInputs[match.id] || { s1: "", s2: "" }

  return (
    <div className={cn(
      "glass rounded-2xl p-4 transition-all",
      match.status === "completed" && "border-success/20"
    )}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-sm font-medium truncate",
              match.winner_id === match.player1_id && "text-success"
            )}>
              {match.player1?.username || "TBD"}
            </span>
            {match.status === "completed" && match.winner_id === match.player1_id && (
              <Check className="w-3.5 h-3.5 text-success flex-shrink-0" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {match.status === "pending" && user && isParticipant ? (
            <>
              <input
                type="number"
                value={inputs.s1}
                onChange={(e) => setScoreInputs((prev) => ({
                  ...prev,
                  [match.id]: { ...prev[match.id] || { s1: "", s2: "" }, s1: e.target.value },
                }))}
                className="w-12 bg-background border border-border rounded-xl py-1.5 px-2 text-sm text-center focus:outline-none focus:border-accent/50"
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
                className="w-12 bg-background border border-border rounded-xl py-1.5 px-2 text-sm text-center focus:outline-none focus:border-accent/50"
                min="0"
              />
              <button
                onClick={() => onSubmitScore(match.id)}
                className="p-1.5 rounded-xl bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
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
            <span className="text-xs text-muted px-2">vs</span>
          )}
        </div>

        <div className="flex-1 min-w-0 text-right">
          <div className="flex items-center justify-end gap-2">
            <span className={cn(
              "text-sm font-medium truncate",
              match.winner_id === match.player2_id && "text-success"
            )}>
              {match.player2?.username || "TBD"}
            </span>
            {match.status === "completed" && match.winner_id === match.player2_id && (
              <Check className="w-3.5 h-3.5 text-success flex-shrink-0" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
