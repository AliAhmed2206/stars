"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Tournament, Game, GameFormat, Profile } from "@/lib/types"
import Link from "next/link"
import { Plus, Trophy, Users, ArrowRight, Loader2, Check, Search, Sparkles, Star, Award, Gift } from "lucide-react"
import { cn } from "@/lib/utils"

const statusColors: Record<string, string> = {
  open: "border-accent/30 text-accent",
  upcoming: "border-yellow-500/30 text-yellow-400",
  ongoing: "border-blue-500/30 text-blue-400",
  completed: "border-success/30 text-success",
}

type Step = "game" | "format" | "settings" | "players" | "review"

export default function ChampionshipPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [formats, setFormats] = useState<GameFormat[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const supabase = createClient()

  const [step, setStep] = useState<Step>("game")
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [selectedFormat, setSelectedFormat] = useState<GameFormat | null>(null)
  const [tournamentName, setTournamentName] = useState("")
  const [tournamentDesc, setTournamentDesc] = useState("")
  const [prizes, setPrizes] = useState("")
  const [maxPlayers, setMaxPlayers] = useState(16)
  const [selectedPlayers, setSelectedPlayers] = useState<Profile[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    loadData()
    const channel = supabase.channel("tournaments-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, () => loadData())
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [])

  async function loadData() {
    const [tr, gr, pr] = await Promise.all([
      supabase.from("tournaments").select("*, game:games(*), format:game_formats(*)").order("created_at", { ascending: false }),
      supabase.from("games").select("*").order("name"),
      supabase.from("profiles").select("*").order("username"),
    ])
    if (tr.data) setTournaments(tr.data as Tournament[])
    if (gr.data) setGames(gr.data as Game[])
    if (pr.data) setProfiles(pr.data as Profile[])
    setLoading(false)
  }

  async function loadFormats(gameId: string) {
    const { data } = await supabase.from("game_formats").select("*").eq("game_id", gameId).order("name")
    if (data) setFormats(data as GameFormat[])
  }

  function selectGame(game: Game) {
    setSelectedGame(game); setSelectedFormat(null); setSelectedPlayers([])
    setTournamentName(""); setTournamentDesc(""); setPrizes("")
    loadFormats(game.id); setStep("format")
  }

  function selectFormat(format: GameFormat) {
    setSelectedFormat(format); setMaxPlayers(format.max_players); setStep("settings")
  }

  function togglePlayer(profile: Profile) {
    setSelectedPlayers((prev) =>
      prev.some((p) => p.id === profile.id) ? prev.filter((p) => p.id !== profile.id) : [...prev, profile]
    )
  }

  async function createTournament() {
    if (!user || !selectedGame || !selectedFormat || !tournamentName.trim()) return
    setCreating(true)
    try {
      const { data: t, error } = await supabase.from("tournaments").insert([{
        game_id: selectedGame.id, format_id: selectedFormat.id,
        name: tournamentName.trim(), description: tournamentDesc.trim() || null,
        prizes: prizes.trim() || null,
        max_participants: maxPlayers, settings: selectedFormat.settings,
        status: "open", created_by: user.id,
      }]).select().single()
      if (error) throw error
      if (selectedPlayers.length > 0) {
        await supabase.from("tournament_participants").insert(
          selectedPlayers.map((p, i) => ({ tournament_id: t.id, user_id: p.id, seed: i + 1 }))
        )
      }
      resetWizard(); loadData()
    } catch (err) { console.error(err) }
    finally { setCreating(false) }
  }

  function resetWizard() {
    setShowWizard(false); setStep("game"); setSelectedGame(null)
    setSelectedFormat(null); setTournamentName(""); setTournamentDesc("")
    setPrizes(""); setSelectedPlayers([]); setSearchTerm("")
  }

  const filteredProfiles = profiles.filter((p) =>
    p.username.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-accent animate-spin" /></div>

  return (
    <div className="min-h-screen">
      <div className="particles-bg">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="particle" />)}</div>
      <div className="max-w-6xl mx-auto px-4 py-8 relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold"><span className="text-gradient">Stars Sports</span> Championship</h1>
            <p className="text-muted text-sm mt-1">Tournaments, brackets & glory</p>
          </div>
          {user && (
            <button onClick={() => setShowWizard(!showWizard)} className="btn-primary px-6 py-3 rounded-2xl text-sm flex items-center gap-2 animate-glow">
              <Plus className="w-5 h-5" /> New Tournament
            </button>
          )}
        </div>

        {showWizard && (
          <div className="glass rounded-3xl p-6 mb-8 animate-slide-up">
            <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide">
              {[{ id: "game" as Step, label: "Game", icon: Star }, { id: "format" as Step, label: "Format", icon: Sparkles }, { id: "settings" as Step, label: "Details", icon: Award }, { id: "players" as Step, label: "Players", icon: Users }, { id: "review" as Step, label: "Review", icon: Trophy }].map((s, i) => {
                const steps = ["game", "format", "settings", "players", "review"]
                const isDone = steps.indexOf(step) > i
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all", step === s.id ? "btn-primary" : isDone ? "bg-success/20 text-success" : "bg-card text-muted")}>
                      {isDone ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                    </div>
                    <span className={cn("text-xs font-medium whitespace-nowrap", step === s.id ? "text-foreground" : "text-muted")}>{s.label}</span>
                    {i < 4 && <div className={cn("w-8 h-px", isDone ? "bg-success/30" : "bg-border")} />}
                  </div>
                )
              })}
            </div>

            {step === "game" && (
              <div className="animate-slide-up">
                <h2 className="text-xl font-bold mb-2">Choose a Game</h2>
                <p className="text-sm text-muted mb-5">Select the game for your tournament</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {games.map((game) => (
                    <button key={game.id} onClick={() => selectGame(game)}
                      className="glass rounded-2xl overflow-hidden glass-hover text-left group transition-all duration-300">
                      {game.image_url && (
                        <div className="h-28 bg-card overflow-hidden">
                          <img src={game.image_url} alt={game.name}
                            className="w-full h-full object-cover opacity-75 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                        </div>
                      )}
                      <div className="p-4 flex items-center gap-3">
                        {!game.image_url && <span className="text-3xl">{game.icon}</span>}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">{game.name}</p>
                          <p className="text-xs text-muted capitalize">{game.category.replace(/_/g, " ")}</p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === "format" && selectedGame && (
              <div className="animate-slide-up">
                <button onClick={() => setStep("game")} className="text-sm text-muted hover:text-accent mb-4 inline-flex items-center gap-1">&larr; Change game</button>
                <h2 className="text-xl font-bold mb-2">Tournament Format</h2>
                <p className="text-sm text-muted mb-5">Choose how this tournament will be played</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {formats.map((f) => (
                    <button key={f.id} onClick={() => selectFormat(f)}
                      className={cn("glass rounded-2xl p-5 text-left transition-all duration-300 hover-lift", selectedFormat?.id === f.id && "border-accent/50 bg-accent/5")}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium border",
                          f.type === "knockout" && "border-accent/30 text-accent",
                          f.type === "group_knockout" && "border-purple-500/30 text-purple-400",
                          f.type === "round_robin" && "border-green-500/30 text-green-400",
                          f.type === "showdown" && "border-orange-500/30 text-orange-400",
                          f.type === "teams" && "border-pink-500/30 text-pink-400")}>
                          {f.type.replace(/_/g, " ")}
                        </div>
                        <span className="text-xs text-muted">{f.min_players}-{f.max_players} players</span>
                      </div>
                      <p className="font-semibold">{f.name}</p>
                      <p className="text-xs text-muted mt-1">{f.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === "settings" && selectedFormat && (
              <div className="animate-slide-up max-w-lg">
                <button onClick={() => setStep("format")} className="text-sm text-muted hover:text-accent mb-4 inline-flex items-center gap-1">&larr; Change format</button>
                <h2 className="text-xl font-bold mb-4">Tournament Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-muted mb-1.5 block">Tournament Name</label>
                    <input type="text" value={tournamentName} onChange={(e) => setTournamentName(e.target.value)}
                      placeholder="e.g. Summer Brawl Cup"
                      className="w-full bg-background border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors" />
                  </div>
                  <div>
                    <label className="text-sm text-muted mb-1.5 block">Description (optional)</label>
                    <textarea value={tournamentDesc} onChange={(e) => setTournamentDesc(e.target.value)}
                      placeholder="Rules, schedule, notes..."
                      className="w-full bg-background border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 resize-none h-20 transition-colors" />
                  </div>
                  <div>
                    <label className="text-sm text-muted mb-1.5 block flex items-center gap-2">
                      <Gift className="w-4 h-4 text-yellow-400" /> Prize (optional)
                    </label>
                    <input type="text" value={prizes} onChange={(e) => setPrizes(e.target.value)}
                      placeholder="e.g. 500 EGP + Trophy"
                      className="w-full bg-background border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors" />
                  </div>
                  <div>
                    <label className="text-sm text-muted mb-1.5 block">Max Players ({maxPlayers})</label>
                    <input type="range" min={selectedFormat.min_players} max={selectedFormat.max_players}
                      value={maxPlayers} onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                      className="w-full accent-accent" />
                  </div>
                  <button onClick={() => setStep("players")} disabled={!tournamentName.trim()}
                    className="btn-primary px-6 py-3 rounded-2xl text-sm disabled:opacity-50 transition-all">
                    Continue to Players
                  </button>
                </div>
              </div>
            )}

            {step === "players" && (
              <div className="animate-slide-up">
                <button onClick={() => setStep("settings")} className="text-sm text-muted hover:text-accent mb-4 inline-flex items-center gap-1">&larr; Back</button>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold">Select Players</h2>
                    <p className="text-sm text-muted">Choose who will compete</p>
                  </div>
                  <span className="text-sm font-bold text-accent">{selectedPlayers.length} / {maxPlayers}</span>
                </div>
                <div className="relative mb-4 max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search players..."
                    className="w-full bg-background border border-border rounded-2xl py-3 pl-12 pr-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-80 overflow-y-auto mb-4 scrollbar-hide">
                  {filteredProfiles.map((p) => {
                    const isSelected = selectedPlayers.some((sp) => sp.id === p.id)
                    return (
                      <button key={p.id} onClick={() => togglePlayer(p)}
                        disabled={!isSelected && selectedPlayers.length >= maxPlayers}
                        className={cn("flex items-center gap-3 p-3 rounded-xl transition-all text-left",
                          isSelected ? "bg-accent/10 border border-accent/30" : "glass glass-hover",
                          !isSelected && selectedPlayers.length >= maxPlayers && "opacity-50 cursor-not-allowed")}>
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                          isSelected ? "bg-accent text-white" : "bg-card text-muted")}>
                          {isSelected ? <Check className="w-3.5 h-3.5" /> : (p.username?.[0]?.toUpperCase() || "?")}
                        </div>
                        <span className="text-sm font-medium">{p.username}</span>
                      </button>
                    )
                  })}
                </div>
                <button onClick={() => setStep("review")} disabled={selectedPlayers.length < 2}
                  className="btn-primary px-6 py-3 rounded-2xl text-sm disabled:opacity-50">
                  Review ({selectedPlayers.length} players)
                </button>
              </div>
            )}

            {step === "review" && selectedGame && selectedFormat && (
              <div className="animate-slide-up">
                <button onClick={() => setStep("players")} className="text-sm text-muted hover:text-accent mb-4 inline-flex items-center gap-1">&larr; Back</button>
                <h2 className="text-xl font-bold mb-4">Review & Create</h2>
                <div className="glass rounded-2xl p-5 space-y-4 mb-6">
                  <div className="flex items-center gap-4">
                    {selectedGame.image_url
                      ? <img src={selectedGame.image_url} alt={selectedGame.name} className="w-14 h-14 rounded-xl object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                      : <span className="text-3xl">{selectedGame.icon}</span>}
                    <div>
                      <p className="font-bold text-lg">{tournamentName}</p>
                      <p className="text-sm text-muted">{selectedGame.name} &mdash; {selectedFormat.name}</p>
                    </div>
                  </div>
                  {tournamentDesc && <p className="text-sm text-muted">{tournamentDesc}</p>}
                  {prizes && <p className="text-sm flex items-center gap-2 text-yellow-400"><Gift className="w-4 h-4" /> Prize: {prizes}</p>}
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="text-muted">Format: <strong>{selectedFormat.type.replace(/_/g, " ")}</strong></span>
                    <span className="text-muted">Max: <strong>{maxPlayers} players</strong></span>
                    <span className="text-muted">Selected: <strong>{selectedPlayers.length} players</strong></span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedPlayers.map((p) => (
                      <span key={p.id} className="px-3 py-1.5 rounded-full glass text-xs flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-gradient-to-br from-accent to-accent2 flex items-center justify-center text-[8px] font-bold text-white">
                          {p.username?.[0]?.toUpperCase() || "?"}
                        </span>
                        {p.username}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={createTournament} disabled={creating}
                    className="btn-primary px-8 py-3 rounded-2xl text-sm flex items-center gap-2 transition-all">
                    {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                    {creating ? "Creating..." : "Create Tournament"}
                  </button>
                  <button onClick={resetWizard} className="btn-secondary px-6 py-3 rounded-2xl text-sm">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tournament List */}
        {tournaments.length === 0 ? (
          <div className="glass rounded-3xl p-16 text-center animate-slide-up">
            <Trophy className="w-16 h-16 text-muted mx-auto mb-4 animate-float" />
            <p className="text-lg font-semibold mb-2">No tournaments yet</p>
            <p className="text-sm text-muted mb-6">Create the first one and let the games begin!</p>
            {user && (
              <button onClick={() => setShowWizard(true)} className="btn-primary px-8 py-3 rounded-2xl text-sm inline-flex items-center gap-2 animate-glow">
                <Plus className="w-5 h-5" /> Create First Tournament
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tournaments.map((t, i) => (
              <Link key={t.id} href={`/championship/${t.id}`}
                className="glass rounded-2xl overflow-hidden glass-hover transition-all duration-300 group animate-slide-up hover-lift"
                style={{ animationDelay: `${i * 0.1}s` }}>
                {t.game?.image_url && (
                  <div className="h-24 bg-card overflow-hidden">
                    <img src={t.game.image_url} alt={t.game.name}
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    {!t.game?.image_url && <span className="text-2xl">{t.game?.icon || "🏆"}</span>}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted">{t.game?.name || "Unknown"}</p>
                      {t.format && <p className="text-xs text-accent">{t.format.name}</p>}
                    </div>
                  </div>
                  <h3 className="font-bold text-lg mb-2 truncate">{t.name}</h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border", statusColors[t.status])}>
                        {t.status}
                      </span>
                      <span className="text-xs text-muted flex items-center gap-1">
                        <Users className="w-3 h-3" /> {t.max_participants}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
