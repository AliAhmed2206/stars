"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Tournament, Game, GameFormat, Profile } from "@/lib/types"
import Link from "next/link"
import { Plus, Trophy, Users, ArrowRight, Loader2, Check, X, Search } from "lucide-react"
import { cn } from "@/lib/utils"

const statusColors = {
  open: "border-accent/30 text-accent",
  upcoming: "border-yellow-500/30 text-yellow-400",
  ongoing: "border-blue-500/30 text-blue-400",
  completed: "border-success/30 text-success",
}

const categoryIcons: Record<string, string> = {
  playstation: "🎮",
  football: "⚽",
  padel: "🎾",
  esports: "🎯",
  card_games: "🃏",
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

  // Wizard state
  const [step, setStep] = useState<Step>("game")
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [selectedFormat, setSelectedFormat] = useState<GameFormat | null>(null)
  const [tournamentName, setTournamentName] = useState("")
  const [tournamentDesc, setTournamentDesc] = useState("")
  const [maxPlayers, setMaxPlayers] = useState(16)
  const [selectedPlayers, setSelectedPlayers] = useState<Profile[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [creating, setCreating] = useState(false)

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
    const [tournamentsRes, gamesRes, profilesRes] = await Promise.all([
      supabase.from("tournaments").select("*, game:games(*), format:game_formats(*)").order("created_at", { ascending: false }),
      supabase.from("games").select("*").order("name"),
      supabase.from("profiles").select("*").order("username"),
    ])
    if (tournamentsRes.data) setTournaments(tournamentsRes.data as Tournament[])
    if (gamesRes.data) setGames(gamesRes.data as Game[])
    if (profilesRes.data) setProfiles(profilesRes.data as Profile[])
    setLoading(false)
  }

  async function loadFormats(gameId: string) {
    const { data } = await supabase
      .from("game_formats")
      .select("*")
      .eq("game_id", gameId)
      .order("name")
    if (data) setFormats(data as GameFormat[])
  }

  function selectGame(game: Game) {
    setSelectedGame(game)
    setSelectedFormat(null)
    setSelectedPlayers([])
    setTournamentName("")
    setTournamentDesc("")
    loadFormats(game.id)
    setStep("format")
  }

  function selectFormat(format: GameFormat) {
    setSelectedFormat(format)
    setMaxPlayers(format.max_players)
    setStep("settings")
  }

  function togglePlayer(profile: Profile) {
    setSelectedPlayers((prev) =>
      prev.some((p) => p.id === profile.id)
        ? prev.filter((p) => p.id !== profile.id)
        : [...prev, profile]
    )
  }

  async function createTournament() {
    if (!user || !selectedGame || !selectedFormat || !tournamentName.trim()) return
    setCreating(true)

    try {
      const { data: tournament, error } = await supabase
        .from("tournaments")
        .insert([{
          game_id: selectedGame.id,
          format_id: selectedFormat.id,
          name: tournamentName.trim(),
          description: tournamentDesc.trim() || null,
          max_participants: maxPlayers,
          settings: selectedFormat.settings,
          status: "open",
          created_by: user.id,
        }])
        .select()
        .single()

      if (error) throw error

      // Add selected players
      if (selectedPlayers.length > 0) {
        const inserts = selectedPlayers.map((p, i) => ({
          tournament_id: tournament.id,
          user_id: p.id,
          seed: i + 1,
        }))
        await supabase.from("tournament_participants").insert(inserts)
      }

      // Reset wizard
      setShowWizard(false)
      setStep("game")
      setSelectedGame(null)
      setSelectedFormat(null)
      setTournamentName("")
      setTournamentDesc("")
      setSelectedPlayers([])
      loadData()
    } catch (err) {
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  function resetWizard() {
    setShowWizard(false)
    setStep("game")
    setSelectedGame(null)
    setSelectedFormat(null)
    setTournamentName("")
    setTournamentDesc("")
    setSelectedPlayers([])
    setSearchTerm("")
  }

  const filteredProfiles = profiles.filter((p) =>
    p.username.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
          <button onClick={() => setShowWizard(!showWizard)} className="btn-primary px-5 py-2.5 rounded-2xl text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Tournament
          </button>
        )}
      </div>

      {/* Creation Wizard */}
      {showWizard && (
        <div className="glass rounded-3xl p-6 mb-8">
          {/* Steps indicator */}
          <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide">
            {[
              { id: "game" as Step, label: "Game" },
              { id: "format" as Step, label: "Format" },
              { id: "settings" as Step, label: "Details" },
              { id: "players" as Step, label: "Players" },
              { id: "review" as Step, label: "Review" },
            ].map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  step === s.id ? "btn-primary" :
                  ["game", "format", "settings", "players", "review"].indexOf(step) > i ? "bg-success/20 text-success" :
                  "bg-card text-muted"
                )}>
                  {["game", "format", "settings", "players", "review"].indexOf(step) > i ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  step === s.id ? "text-foreground" : "text-muted"
                )}>{s.label}</span>
                {i < 4 && <div className="w-6 h-px bg-border" />}
              </div>
            ))}
          </div>

          {/* Step 1: Select Game */}
          {step === "game" && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Choose a Game</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {games.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => selectGame(game)}
                    className="glass rounded-2xl p-4 glass-hover text-left group"
                  >
                    <div className="flex items-center gap-3">
                      {game.image_url ? (
                        <img src={game.image_url} alt={game.name} className="w-10 h-10 rounded-xl object-cover bg-card" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      ) : (
                        <span className="text-2xl">{game.icon}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{game.name}</p>
                        <p className="text-xs text-muted">{game.category}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Select Format */}
          {step === "format" && selectedGame && (
            <div>
              <button onClick={() => setStep("game")} className="text-sm text-muted hover:text-accent mb-4 inline-block">&larr; Change game</button>
              <h2 className="text-lg font-semibold mb-4">Tournament Format for {selectedGame.name}</h2>
              {formats.length === 0 ? (
                <p className="text-muted text-sm">No formats configured for this game yet</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {formats.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => selectFormat(f)}
                      className={cn(
                        "glass rounded-2xl p-5 text-left transition-all",
                        selectedFormat?.id === f.id ? "border-accent/50 bg-accent/5" : "glass-hover"
                      )}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={cn(
                          "px-2.5 py-0.5 rounded-full text-xs font-medium border",
                          f.type === "knockout" && "border-accent/30 text-accent",
                          f.type === "group_knockout" && "border-purple-500/30 text-purple-400",
                          f.type === "round_robin" && "border-green-500/30 text-green-400",
                          f.type === "showdown" && "border-orange-500/30 text-orange-400",
                          f.type === "teams" && "border-pink-500/30 text-pink-400",
                        )}>
                          {f.type.replace("_", " ")}
                        </div>
                        <span className="text-xs text-muted">{f.min_players}-{f.max_players} players</span>
                      </div>
                      <p className="font-semibold text-sm">{f.name}</p>
                      <p className="text-xs text-muted mt-1">{f.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Settings */}
          {step === "settings" && selectedFormat && (
            <div>
              <button onClick={() => setStep("format")} className="text-sm text-muted hover:text-accent mb-4 inline-block">&larr; Change format</button>
              <h2 className="text-lg font-semibold mb-4">Tournament Details</h2>
              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="text-sm text-muted mb-1.5 block">Tournament Name</label>
                  <input
                    type="text"
                    value={tournamentName}
                    onChange={(e) => setTournamentName(e.target.value)}
                    placeholder={`${selectedGame?.name} Tournament`}
                    className="w-full bg-background border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted mb-1.5 block">Description (optional)</label>
                  <textarea
                    value={tournamentDesc}
                    onChange={(e) => setTournamentDesc(e.target.value)}
                    placeholder="Describe the tournament rules..."
                    className="w-full bg-background border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 resize-none h-20"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted mb-1.5 block">Max Players ({selectedFormat.min_players} - {selectedFormat.max_players})</label>
                  <input
                    type="range"
                    min={selectedFormat.min_players}
                    max={selectedFormat.max_players}
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                    className="w-full accent-accent"
                  />
                  <p className="text-xs text-muted mt-1">{maxPlayers} players maximum</p>
                </div>
                <button
                  onClick={() => setStep("players")}
                  disabled={!tournamentName.trim()}
                  className="btn-primary px-6 py-2.5 rounded-2xl text-sm disabled:opacity-50"
                >
                  Continue to Players
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Select Players */}
          {step === "players" && (
            <div>
              <button onClick={() => setStep("settings")} className="text-sm text-muted hover:text-accent mb-4 inline-block">&larr; Back</button>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Select Players</h2>
                <p className="text-sm text-muted">{selectedPlayers.length} / {maxPlayers} selected</p>
              </div>
              <div className="relative mb-4 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search players..."
                  className="w-full bg-background border border-border rounded-2xl py-3 pl-12 pr-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-80 overflow-y-auto mb-4">
                {filteredProfiles.map((p) => {
                  const isSelected = selectedPlayers.some((sp) => sp.id === p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePlayer(p)}
                      disabled={!isSelected && selectedPlayers.length >= maxPlayers}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl transition-all text-left",
                        isSelected
                          ? "bg-accent/10 border border-accent/30"
                          : "glass glass-hover",
                        !isSelected && selectedPlayers.length >= maxPlayers && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                        isSelected ? "bg-accent text-white" : "bg-card text-muted"
                      )}>
                        {isSelected ? <Check className="w-3.5 h-3.5" /> : p.username?.[0]?.toUpperCase() || "?"}
                      </div>
                      <span className="text-sm font-medium">{p.username}</span>
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => setStep("review")}
                disabled={selectedPlayers.length < 2}
                className="btn-primary px-6 py-2.5 rounded-2xl text-sm disabled:opacity-50"
              >
                Review ({selectedPlayers.length} players)
              </button>
            </div>
          )}

          {/* Step 5: Review & Create */}
          {step === "review" && selectedGame && selectedFormat && (
            <div>
              <button onClick={() => setStep("players")} className="text-sm text-muted hover:text-accent mb-4 inline-block">&larr; Back</button>
              <h2 className="text-lg font-semibold mb-4">Review Tournament</h2>
              <div className="glass rounded-2xl p-5 space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  {selectedGame.image_url ? (
                    <img src={selectedGame.image_url} alt={selectedGame.name} className="w-10 h-10 rounded-xl object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  ) : (
                    <span className="text-2xl">{selectedGame.icon}</span>
                  )}
                  <div>
                    <p className="font-semibold">{tournamentName}</p>
                    <p className="text-xs text-muted">{selectedGame.name} — {selectedFormat.name}</p>
                  </div>
                </div>
                {tournamentDesc && <p className="text-sm text-muted">{tournamentDesc}</p>}
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="text-muted">Format: <strong>{selectedFormat.type.replace("_", " ")}</strong></span>
                  <span className="text-muted">Max: <strong>{maxPlayers} players</strong></span>
                  <span className="text-muted">Selected: <strong>{selectedPlayers.length} players</strong></span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedPlayers.map((p) => (
                    <span key={p.id} className="px-3 py-1 rounded-full glass text-xs">{p.username}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={createTournament}
                  disabled={creating}
                  className="btn-primary px-8 py-3 rounded-2xl text-sm flex items-center gap-2"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Tournament
                </button>
                <button onClick={resetWizard} className="btn-secondary px-6 py-3 rounded-2xl text-sm">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tournament List */}
      {tournaments.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center">
          <Trophy className="w-12 h-12 text-muted mx-auto mb-4" />
          <p className="text-muted mb-4">No tournaments yet</p>
          {user && (
            <button onClick={() => setShowWizard(true)} className="btn-primary px-6 py-2.5 rounded-2xl text-sm inline-flex items-center gap-2">
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
                {t.game?.image_url ? (
                  <img src={t.game.image_url} alt={t.game.name} className="w-10 h-10 rounded-xl object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                ) : (
                  <span className="text-2xl">{t.game ? categoryIcons[t.game.category] || "🎯" : "🎯"}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted">{t.game?.name || "Unknown"}</p>
                  {t.format && <p className="text-xs text-accent">{t.format.name}</p>}
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
