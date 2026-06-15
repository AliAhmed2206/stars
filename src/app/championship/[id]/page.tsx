"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Tournament, TournamentParticipant, Match, TournamentGroup } from "@/lib/types"
import { ArrowLeft, Users, Plus, LogOut, Loader2, Check, Trophy, RefreshCw, Sparkles, Award, Edit3, X, Star, Crown, Eye } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface BracketPreview {
  round: number
  label: string
  matches: { p1: string | null; p2: string | null }[]
}

export default function TournamentPage() {
  const { id } = useParams<{ id: string }>()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [participants, setParticipants] = useState<TournamentParticipant[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [groups, setGroups] = useState<TournamentGroup[]>([])
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [scoreInputs, setScoreInputs] = useState<Record<string, { s1: string; s2: string }>>({})
  const [showConfetti, setShowConfetti] = useState(false)
  const [editingPrizes, setEditingPrizes] = useState(false)
  const [prizesText, setPrizesText] = useState("")
  const [showPreview, setShowPreview] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user)
      if (data.user) {
        const { data: prof } = await supabase.from("profiles").select("*").eq("id", data.user.id).single()
        setProfile(prof)
      }
    })
    loadData()
    const channel = supabase
      .channel(`tournament-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_participants", filter: `tournament_id=eq.${id}` }, () => { loadParticipants(); loadMatches() })
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${id}` }, () => loadMatches())
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments", filter: `id=eq.${id}` }, () => loadTournament())
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [id])

  async function loadData() {
    await Promise.all([loadTournament(), loadParticipants(), loadMatches(), loadGroups()])
    setLoading(false)
  }
  async function loadTournament() {
    const { data } = await supabase.from("tournaments").select("*, game:games(*), format:game_formats(*)").eq("id", id).single()
    if (data) setTournament(data as Tournament)
  }
  async function loadParticipants() {
    const { data } = await supabase.from("tournament_participants").select("*, profile:profiles(*)").eq("tournament_id", id).order("seed")
    if (data) setParticipants(data as TournamentParticipant[])
  }
  async function loadMatches() {
    const { data } = await supabase.from("matches").select("*, player1:profiles!player1_id(*), player2:profiles!player2_id(*), winner:profiles!winner_id(*)").eq("tournament_id", id).order("round").order("id")
    if (data) setMatches(data as Match[])
  }
  async function loadGroups() {
    const { data } = await supabase.from("tournament_groups").select("*").eq("tournament_id", id).order("name")
    if (data) setGroups(data as TournamentGroup[])
  }

  async function handleJoin() {
    if (!user) return
    await supabase.from("tournament_participants").insert([{ tournament_id: id, user_id: user.id }])
    loadParticipants()
  }
  async function handleLeave() {
    if (!user) return
    await supabase.from("tournament_participants").delete().eq("tournament_id", id).eq("user_id", user.id)
    loadParticipants()
  }

  async function handleSavePrizes() {
    if (!tournament) return
    await supabase.from("tournaments").update({ prizes: prizesText }).eq("id", id)
    setEditingPrizes(false)
    loadTournament()
  }

  async function handleGenerateBracket() {
    if (!tournament?.format) return
    const formatType = tournament.format.type
    const playersPerTeam = tournament.format.players_per_team
    const shuffled = [...participants].sort(() => Math.random() - 0.5)

    if (formatType === "group_knockout") {
      const groupSize = 4
      const numGroups = Math.max(2, Math.floor(shuffled.length / groupSize))
      const groupNames = "ABCDEFGHIJ".split("").slice(0, numGroups)
      const groupIds: string[] = []
      for (const name of groupNames) {
        const { data } = await supabase.from("tournament_groups").insert([{ tournament_id: id, name: `Group ${name}` }]).select().single()
        if (data) groupIds.push(data.id)
      }
      shuffled.forEach((p, i) => {
        supabase.from("tournament_participants").update({ group_id: groupIds[i % numGroups], seed: Math.floor(i / numGroups) + 1 }).eq("id", p.id).then()
      })
      for (let g = 0; g < numGroups; g++) {
        const gp = shuffled.filter((_, i) => i % numGroups === g)
        for (let i = 0; i < gp.length; i++)
          for (let j = i + 1; j < gp.length; j++)
            await supabase.from("matches").insert([{ tournament_id: id, group_id: groupIds[g], round: 1, player1_id: gp[i].user_id, player2_id: gp[j].user_id, status: "pending" }])
      }
      // knockout rounds
      const { data: allParticipants } = await supabase.from("tournament_participants").select("*, profile:profiles(*)").eq("tournament_id", id).order("seed")
      if (allParticipants) {
        const knockCandidates: TournamentParticipant[] = []
        for (const gId of groupIds) {
          const gpParticipants = allParticipants.filter((p) => p.group_id === gId)
          if (gpParticipants.length > 0) knockCandidates.push(gpParticipants[0])
          if (gpParticipants.length > 1) knockCandidates.push(gpParticipants[1])
        }
        for (let i = 0; i < knockCandidates.length - 1; i += 2) {
          await supabase.from("matches").insert([{ tournament_id: id, round: 2, player1_id: knockCandidates[i].user_id, player2_id: knockCandidates[i + 1].user_id, status: "pending" }])
        }
      }
    } else if (formatType === "round_robin") {
      for (let i = 0; i < shuffled.length; i++)
        for (let j = i + 1; j < shuffled.length; j++)
          await supabase.from("matches").insert([{ tournament_id: id, round: 1, player1_id: shuffled[i].user_id, player2_id: shuffled[j].user_id, status: "pending" }])
    } else if (formatType === "showdown") {
      for (let i = 0; i < shuffled.length; i += 2)
        if (i + 1 < shuffled.length)
          await supabase.from("matches").insert([{ tournament_id: id, round: 1, player1_id: shuffled[i].user_id, player2_id: shuffled[i + 1].user_id, status: "pending" }])
    } else {
      // knockout — generate all rounds
      const totalRounds = Math.ceil(Math.log2(shuffled.length))
      const bracketSize = Math.pow(2, totalRounds)
      const byeCount = bracketSize - shuffled.length
      const seeded = [...shuffled]
      for (let i = 0; i < byeCount; i++) seeded.push(null as any)

      for (let round = 1; round <= totalRounds; round++) {
        const matchesInRound = Math.pow(2, totalRounds - round)
        for (let m = 0; m < matchesInRound; m++) {
          if (round === 1) {
            const p1 = seeded[m * 2]
            const p2 = seeded[m * 2 + 1]
            if (p1 && p2) {
              await supabase.from("matches").insert([{ tournament_id: id, round, player1_id: p1.user_id, player2_id: p2.user_id, status: "pending" }])
            } else if (p1) {
              await supabase.from("matches").insert([{ tournament_id: id, round, player1_id: p1.user_id, player2_id: null, status: "completed", score1: 1, score2: 0, winner_id: p1.user_id }])
            } else if (p2) {
              await supabase.from("matches").insert([{ tournament_id: id, round, player1_id: null, player2_id: p2.user_id, status: "completed", score1: 0, score2: 1, winner_id: p2.user_id }])
            }
          } else {
            await supabase.from("matches").insert([{ tournament_id: id, round, player1_id: null, player2_id: null, status: "pending" }])
          }
        }
      }
      // Fill in later rounds as earlier ones complete
      if (totalRounds > 1) {
        for (let round = 2; round <= totalRounds; round++) {
          const matchesInRound = Math.pow(2, totalRounds - round)
          const prevRound = round - 1
          for (let m = 0; m < matchesInRound; m++) {
            const prevMatch1Idx = m * 2
            const prevMatch2Idx = m * 2 + 1
            const { data: prev1 } = await supabase.from("matches").select("winner_id").eq("tournament_id", id).eq("round", prevRound).order("id")
            if (prev1) {
              const p1w = prev1[prevMatch1Idx]?.winner_id
              const p2w = prev1[prevMatch2Idx]?.winner_id
              if (p1w && p2w) {
                const matchesInRound2 = await supabase.from("matches").select("id").eq("tournament_id", id).eq("round", round).order("id")
                if (matchesInRound2.data?.[m]) {
                  await supabase.from("matches").update({ player1_id: p1w, player2_id: p2w }).eq("id", matchesInRound2.data[m].id)
                }
              }
            }
          }
        }
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
    await supabase.from("matches").update({ score1: s1, score2: s2, winner_id, status: "completed" }).eq("id", matchId)
    setScoreInputs((prev) => { const n = { ...prev }; delete n[matchId]; return n })

    const { data: updatedMatches } = await supabase.from("matches").select("*").eq("tournament_id", id)
    if (updatedMatches && updatedMatches.every((m) => m.status === "completed") && updatedMatches.length > 0) {
      await supabase.from("tournaments").update({ status: "completed" }).eq("id", id)
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 5000)
    }
    loadMatches()
    loadTournament()
  }

  const isParticipant = user && participants.some((p) => p.user_id === user.id)
  const canStart = tournament?.status === "open" && participants.length >= 2
  const isAdmin = profile?.role === "admin"
  const isCompleted = tournament?.status === "completed"

  const completedMatches = matches.filter((m) => m.status === "completed")
  const lastMatch = completedMatches[completedMatches.length - 1]
  const champion = lastMatch?.winner

  // Bracket preview (live, computed from participants)
  const bracketPreview = useCallback((): BracketPreview[] => {
    const shuffled = [...participants].sort(() => Math.random() - 0.5)
    const total = shuffled.length
    if (total < 2) return []
    const totalRounds = Math.ceil(Math.log2(total))
    const bracketSize = Math.pow(2, totalRounds)
    const preview: BracketPreview[] = []

    for (let round = 1; round <= totalRounds; round++) {
      const matchesInRound = Math.pow(2, totalRounds - round)
      const roundMatches: { p1: string | null; p2: string | null }[] = []
      const label = round === 1 ? "Round 1"
        : round === totalRounds ? "Final"
        : round === totalRounds - 1 ? "Semi-Finals"
        : round === totalRounds - 2 ? "Quarter-Finals"
        : `Round ${round}`

      for (let m = 0; m < matchesInRound; m++) {
        if (round === 1) {
          const idx = m * 2
          const p1 = shuffled[idx]?.profile?.username || (idx < total ? "TBD" : null)
          const p2 = shuffled[idx + 1]?.profile?.username || (idx + 1 < total ? "TBD" : null)
          if (p1 || p2) roundMatches.push({ p1, p2 })
        } else {
          roundMatches.push({ p1: null, p2: null })
        }
      }
      if (roundMatches.length > 0) preview.push({ round, label, matches: roundMatches })
    }
    return preview
  }, [participants])

  const preview = bracketPreview()

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-accent animate-spin" /></div>
  if (!tournament) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted">Tournament not found</p></div>

  const maxRound = matches.length > 0 ? Math.max(...matches.map((m) => m.round)) : 0
  const ungroupedMatches = matches.filter((m) => !m.group_id)
  const rounds = Array.from({ length: maxRound }, (_, i) => i + 1)

  return (
    <div className="min-h-screen">
      {showConfetti && (
        <div className="confetti-container">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="confetti-piece" style={{
              left: `${Math.random() * 100}%`,
              animationDuration: `${2 + Math.random() * 3}s`,
              animationDelay: `${Math.random() * 2}s`,
              background: ["#00f0ff", "#b400ff", "#ff0080", "#00ff88", "#ffcc00"][Math.floor(Math.random() * 5)],
              width: `${5 + Math.random() * 10}px`,
              height: `${5 + Math.random() * 10}px`,
              borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            }} />
          ))}
        </div>
      )}

      <div className="particles-bg">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="particle" />)}
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 relative z-10">
        <Link href="/championship" className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Championship
        </Link>

        {isCompleted && champion && (
          <div className="glass rounded-3xl p-8 mb-8 text-center animate-slide-up border border-success/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-success/5 to-transparent" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-success/10 text-success text-sm mb-4">
                <Crown className="w-4 h-4" />
                Tournament Complete
              </div>
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-500 mx-auto mb-4 flex items-center justify-center animate-glow">
                <Trophy className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gradient mb-2">{champion.username}</h2>
              <p className="text-xl text-muted">Champion of {tournament.name}</p>
              {tournament.prizes && (
                <div className="mt-4 inline-flex items-center gap-2 px-6 py-3 rounded-2xl glass border border-accent/20">
                  <Award className="w-5 h-5 text-accent" />
                  <span className="text-accent font-semibold">{tournament.prizes}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="glass rounded-3xl p-6 mb-8 animate-slide-up">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3">
                {tournament.game?.image_url ? (
                  <img src={tournament.game.image_url} alt={tournament.game.name} className="w-12 h-12 rounded-xl object-cover border border-border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                ) : <span className="text-3xl">{tournament.game?.icon || "🏆"}</span>}
                <div>
                  <h1 className="text-2xl font-bold">{tournament.name}</h1>
                  <p className="text-sm text-muted">{tournament.game?.name} {tournament.format && `• ${tournament.format.name}`}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <span className={cn(
                  "inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium border",
                  tournament.status === "open" && "border-accent/30 text-accent",
                  tournament.status === "ongoing" && "border-blue-500/30 text-blue-400",
                  tournament.status === "completed" && "border-success/30 text-success",
                )}>
                  {tournament.status === "completed" && <Trophy className="w-3 h-3 mr-1" />}
                  {tournament.status}
                </span>
                <span className="text-sm text-muted flex items-center gap-1">
                  <Users className="w-4 h-4" /> {participants.length} / {tournament.max_participants}
                </span>
              </div>
              {tournament.description && <p className="text-sm text-muted mt-3">{tournament.description}</p>}
            </div>
            <div className="flex gap-2 flex-wrap">
              {user && !isParticipant && tournament.status === "open" && (
                <button onClick={handleJoin} className="btn-primary px-5 py-2.5 rounded-xl text-sm flex items-center gap-2"><Plus className="w-4 h-4" /> Join</button>
              )}
              {user && isParticipant && tournament.status === "open" && (
                <button onClick={handleLeave} className="btn-secondary px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 text-danger"><LogOut className="w-4 h-4" /> Leave</button>
              )}
              {canStart && matches.length === 0 && (
                <button onClick={handleGenerateBracket} className="btn-primary px-5 py-2.5 rounded-xl text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Start Tournament</button>
              )}
              {canStart && matches.length === 0 && participants.length >= 2 && (
                <button onClick={() => setShowPreview(!showPreview)} className="btn-secondary px-5 py-2.5 rounded-xl text-sm flex items-center gap-2"><Eye className="w-4 h-4" /> {showPreview ? "Hide" : "Preview"} Bracket</button>
              )}
            </div>
          </div>

          {(tournament.prizes || isAdmin) && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-medium">Prize:</span>
                  {editingPrizes ? (
                    <div className="flex items-center gap-2">
                      <input type="text" value={prizesText} onChange={(e) => setPrizesText(e.target.value)}
                        className="bg-background border border-border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-accent/50"
                        placeholder="e.g. 500 EGP + Trophy" />
                      <button onClick={handleSavePrizes} className="p-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditingPrizes(false)} className="p-1.5 rounded-lg bg-danger/10 text-danger hover:bg-danger/20"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <span className="text-sm text-yellow-400 font-semibold">{tournament.prizes || "No prize set"}</span>
                  )}
                </div>
                {isAdmin && !editingPrizes && (
                  <button onClick={() => { setPrizesText(tournament.prizes || ""); setEditingPrizes(true) }} className="text-xs text-muted hover:text-accent flex items-center gap-1">
                    <Edit3 className="w-3 h-3" /> {tournament.prizes ? "Edit" : "Set Prize"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Participants */}
          <div className="lg:col-span-1 space-y-4">
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-accent" />
                Participants
                <span className="text-xs text-muted font-normal">({participants.length})</span>
              </h3>
              {participants.length === 0 ? (
                <p className="text-sm text-muted">No participants yet</p>
              ) : (
                <div className="space-y-1.5">
                  {participants.map((p, i) => (
                    <div key={p.id} className={cn(
                      "flex items-center gap-2.5 glass rounded-xl px-3 py-2 transition-all",
                      champion?.id === p.user_id && "border border-yellow-500/30 bg-yellow-500/5"
                    )}>
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                        champion?.id === p.user_id ? "bg-yellow-500 text-black" : "bg-gradient-to-br from-accent to-accent2 text-white"
                      )}>
                        {champion?.id === p.user_id ? <Crown className="w-3 h-3" /> : i + 1}
                      </div>
                      <span className={cn("text-sm truncate", champion?.id === p.user_id && "text-yellow-400 font-bold")}>
                        {p.profile?.username || "Anonymous"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bracket / Preview */}
          <div className="lg:col-span-3 space-y-6">
            {matches.length > 0 ? (
              groups.length > 0 ? (
                groups.map((group) => {
                  const groupMatches = matches.filter((m) => m.group_id === group.id)
                  if (groupMatches.length === 0) return null
                  return (
                    <div key={group.id} className="animate-slide-up">
                      <h3 className="font-semibold flex items-center gap-2 mb-4 text-lg">
                        <Sparkles className="w-5 h-5 text-accent" />
                        {group.name}
                      </h3>
                      <div className="space-y-2">
                        {groupMatches.map((match, idx) => (
                          <MatchCard key={match.id} match={match} user={user} isParticipant={isParticipant}
                            scoreInputs={scoreInputs} setScoreInputs={setScoreInputs}
                            onSubmitScore={handleSubmitScore} index={idx} />
                        ))}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="bracket-container animate-slide-up">
                  {rounds.map((round) => {
                    const roundMatches = ungroupedMatches.filter((m) => m.round === round)
                    if (roundMatches.length === 0) return null
                    return (
                      <div key={round} className="bracket-round">
                        <p className="text-xs text-muted font-medium mb-3 text-center uppercase tracking-wider">
                          {round === 1 ? "Round 1" :
                           round === 2 ? "Quarter-Finals" :
                           round === 3 ? "Semi-Finals" :
                           round === 4 ? "Final" : `Round ${round}`}
                          {round === maxRound && isCompleted && (
                            <span className="block text-success text-xs mt-1">🏆 Champion</span>
                          )}
                        </p>
                        {roundMatches.map((match, idx) => (
                          <div key={match.id} className={cn("bracket-match", round === maxRound && "font-bold")}>
                            <MatchCard match={match} user={user} isParticipant={isParticipant}
                              scoreInputs={scoreInputs} setScoreInputs={setScoreInputs}
                              onSubmitScore={handleSubmitScore} index={idx} isFinal={round === maxRound} />
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            ) : showPreview && preview.length > 0 ? (
              /* Live Bracket Preview */
              <div className="bracket-container animate-slide-up">
                {preview.map((rnd) => (
                  <div key={rnd.round} className="bracket-round">
                    <p className="text-xs text-muted font-medium mb-3 text-center uppercase tracking-wider">
                      {rnd.label}
                    </p>
                    {rnd.matches.map((m, idx) => (
                      <div key={idx} className={cn("bracket-match", rnd.round === preview.length && "font-bold")}>
                        <div className="glass rounded-2xl p-3 transition-all duration-300 border border-dashed border-accent/20">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 py-1.5 px-2 rounded-xl">
                                <span className={cn("text-sm font-medium truncate", !m.p1 && "text-muted/50 italic")}>
                                  {m.p1 || "TBD"}
                                </span>
                              </div>
                              <div className="py-1.5 px-2 rounded-xl">
                                <div className="flex items-center gap-1.5">
                                  <span className={cn("text-sm font-medium truncate", !m.p2 && "text-muted/50 italic")}>
                                    {m.p2 || "TBD"}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-center gap-1 flex-shrink-0">
                              <span className="text-[10px] text-muted px-1">VS</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass rounded-2xl p-12 text-center animate-slide-up">
                <Trophy className="w-16 h-16 text-muted mx-auto mb-4 animate-float" />
                <p className="text-lg font-semibold mb-2">
                  {participants.length < 2 ? "Waiting for players to join..." : "Ready to start!"}
                </p>
                <p className="text-sm text-muted mb-6">
                  {participants.length < 2
                    ? "Share the tournament link with your friends"
                    : "Click 'Preview Bracket' to see the matchups, then 'Start Tournament' to lock it in"}
                </p>
                {canStart && matches.length === 0 && (
                  <div className="flex items-center justify-center gap-3">
                    <button onClick={() => setShowPreview(true)} className="btn-secondary px-6 py-3 rounded-2xl text-base inline-flex items-center gap-2">
                      <Eye className="w-5 h-5" /> Preview Bracket
                    </button>
                    <button onClick={handleGenerateBracket} className="btn-primary px-6 py-3 rounded-2xl text-base inline-flex items-center gap-2 animate-glow">
                      <RefreshCw className="w-5 h-5" /> Start Tournament
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MatchCard({ match, user, isParticipant, scoreInputs, setScoreInputs, onSubmitScore, index = 0, isFinal = false }: {
  match: Match; user: any; isParticipant?: boolean;
  scoreInputs: Record<string, { s1: string; s2: string }>;
  setScoreInputs: (updater: (prev: Record<string, { s1: string; s2: string }>) => Record<string, { s1: string; s2: string }>) => void;
  onSubmitScore: (matchId: string) => void;
  index?: number; isFinal?: boolean;
}) {
  const inputs = scoreInputs[match.id] || { s1: "", s2: "" }

  return (
    <div className={cn(
      "glass rounded-2xl p-3 transition-all duration-300 hover-lift animate-slide-up",
      match.status === "completed" && "border-success/20",
      isFinal && match.status === "completed" && "border-yellow-500/40 bg-yellow-500/5",
    )}
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className={cn(
            "flex items-center gap-1.5 py-1.5 px-2 rounded-xl transition-colors",
            match.winner_id === match.player1_id && match.status === "completed" && "bg-success/10"
          )}>
            <span className={cn("text-sm font-medium truncate", match.winner_id === match.player1_id && "text-success")}>
              {match.player1?.username || "TBD"}
            </span>
            {match.status === "completed" && match.winner_id === match.player1_id &&
              <Trophy className="w-3 h-3 text-success flex-shrink-0" />}
          </div>
          <div className={cn(
            "py-1.5 px-2 rounded-xl transition-colors",
            match.winner_id === match.player2_id && match.status === "completed" && "bg-success/10"
          )}>
            <div className="flex items-center gap-1.5">
              <span className={cn("text-sm font-medium truncate", match.winner_id === match.player2_id && "text-success")}>
                {match.player2?.username || "TBD"}
              </span>
              {match.status === "completed" && match.winner_id === match.player2_id &&
                <Trophy className="w-3 h-3 text-success flex-shrink-0" />}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          {match.status === "pending" && user && isParticipant ? (
            <div className="flex items-center gap-1">
              <input type="number" value={inputs.s1} onChange={(e) => setScoreInputs((prev) => ({ ...prev, [match.id]: { ...prev[match.id] || { s1: "", s2: "" }, s1: e.target.value } }))}
                className="w-10 bg-background border border-border rounded-lg py-1 text-xs text-center focus:outline-none focus:border-accent/50" min="0" />
              <span className="text-muted text-[10px]">:</span>
              <input type="number" value={inputs.s2} onChange={(e) => setScoreInputs((prev) => ({ ...prev, [match.id]: { ...prev[match.id] || { s1: "", s2: "" }, s2: e.target.value } }))}
                className="w-10 bg-background border border-border rounded-lg py-1 text-xs text-center focus:outline-none focus:border-accent/50" min="0" />
              <button onClick={() => onSubmitScore(match.id)} className="p-1 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors">
                <Check className="w-3 h-3" />
              </button>
            </div>
          ) : match.status === "completed" ? (
            <div className="text-center">
              <span className={cn("text-sm font-mono font-bold", match.winner_id === match.player1_id && "text-success")}>{match.score1}</span>
              <span className="text-muted text-xs mx-0.5">-</span>
              <span className={cn("text-sm font-mono font-bold", match.winner_id === match.player2_id && "text-success")}>{match.score2}</span>
            </div>
          ) : (
            <span className="text-[10px] text-muted px-1">VS</span>
          )}
        </div>
      </div>
    </div>
  )
}