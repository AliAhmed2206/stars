import { createClient } from "./client"
import type { Event, Game, GameFormat, Tournament, TournamentGroup, TournamentParticipant, Match, Profile } from "@/lib/types"

const supabase = createClient()

export async function getEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("date", { ascending: true })
  if (error) throw error
  return data as Event[]
}

export async function createEvent(event: Omit<Event, "id" | "created_at" | "created_by">) {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("events")
    .insert([{ ...event, created_by: user.user.id }])
    .select()
    .single()
  if (error) throw error
  return data as Event
}

export async function deleteEvent(id: string) {
  const { error } = await supabase.from("events").delete().eq("id", id)
  if (error) throw error
}

export async function getGames() {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .order("name")
  if (error) throw error
  return data as Game[]
}

export async function getGameFormats(gameId: string) {
  const { data, error } = await supabase
    .from("game_formats")
    .select("*")
    .eq("game_id", gameId)
    .order("name")
  if (error) throw error
  return data as GameFormat[]
}

export async function getTournaments() {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*, game:games(*), format:game_formats(*)")
    .order("created_at", { ascending: false })
  if (error) throw error
  return data as Tournament[]
}

export async function getTournament(id: string) {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*, game:games(*), format:game_formats(*)")
    .eq("id", id)
    .single()
  if (error) throw error
  return data as Tournament
}

export async function createTournament(tournament: {
  game_id: string
  format_id?: string
  name: string
  description?: string
  max_participants?: number
  settings?: Record<string, any>
}) {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("tournaments")
    .insert([{
      game_id: tournament.game_id,
      format_id: tournament.format_id || null,
      name: tournament.name,
      description: tournament.description || null,
      max_participants: tournament.max_participants || 16,
      settings: tournament.settings || {},
      status: "open",
      created_by: user.user.id,
    }])
    .select()
    .single()
  if (error) throw error
  return data as Tournament
}

export async function updateTournament(id: string, updates: Partial<Tournament>) {
  const { error } = await supabase
    .from("tournaments")
    .update(updates)
    .eq("id", id)
  if (error) throw error
}

export async function deleteTournament(id: string) {
  const { error } = await supabase.from("tournaments").delete().eq("id", id)
  if (error) throw error
}

export async function getParticipants(tournamentId: string) {
  const { data, error } = await supabase
    .from("tournament_participants")
    .select("*, profile:profiles(*)")
    .eq("tournament_id", tournamentId)
    .order("seed")
  if (error) throw error
  return data as TournamentParticipant[]
}

export async function getAvailablePlayers(excludeIds: string[] = []) {
  let query = supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .order("username")

  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`)
  }

  const { data, error } = await query
  if (error) throw error
  return data as Pick<Profile, "id" | "username" | "avatar_url">[]
}

export async function addParticipants(tournamentId: string, userIds: string[]) {
  const inserts = userIds.map((userId, i) => ({
    tournament_id: tournamentId,
    user_id: userId,
    seed: i + 1,
  }))

  const { error } = await supabase
    .from("tournament_participants")
    .insert(inserts)
  if (error) throw error
}

export async function joinTournament(tournamentId: string) {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("tournament_participants")
    .insert([{ tournament_id: tournamentId, user_id: user.user.id }])
    .select()
    .single()
  if (error) throw error
  return data as TournamentParticipant
}

export async function leaveTournament(tournamentId: string) {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error("Not authenticated")

  const { error } = await supabase
    .from("tournament_participants")
    .delete()
    .eq("tournament_id", tournamentId)
    .eq("user_id", user.user.id)
  if (error) throw error
}

export async function getMatches(tournamentId: string) {
  const { data, error } = await supabase
    .from("matches")
    .select("*, player1:profiles!player1_id(*), player2:profiles!player2_id(*), winner:profiles!winner_id(*)")
    .eq("tournament_id", tournamentId)
    .order("round")
    .order("id")
  if (error) throw error
  return data as Match[]
}

export async function getGroups(tournamentId: string) {
  const { data, error } = await supabase
    .from("tournament_groups")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("name")
  if (error) throw error
  return data as TournamentGroup[]
}

export async function generateBracket(tournamentId: string, settings: { format_type: string; players_per_team?: number; group_size?: number }) {
  const { format_type, players_per_team = 1, group_size = 4 } = settings
  const pt = players_per_team

  const { data: participants } = await supabase
    .from("tournament_participants")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("seed")

  if (!participants || participants.length < 2) throw new Error("Need at least 2 participants")

  // Shuffle for random seeds
  const shuffled = [...participants].sort(() => Math.random() - 0.5)

  if (format_type === "showdown") {
    // Free-for-all: single round with all players
    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        await supabase.from("matches").insert([{
          tournament_id: tournamentId,
          round: 1,
          player1_id: shuffled[i].user_id,
          player2_id: shuffled[i + 1].user_id,
          status: "pending",
        }])
      }
    }
    await supabase.from("tournaments").update({ status: "ongoing" }).eq("id", tournamentId)
    return
  }

  if (format_type === "group_knockout") {
    // Create groups
    const numGroups = Math.max(2, Math.floor(shuffled.length / group_size))
    const groupNames = "ABCDEFGHIJ".split("").slice(0, numGroups)
    const groupIds: string[] = []

    for (const name of groupNames) {
      const { data } = await supabase
        .from("tournament_groups")
        .insert([{ tournament_id: tournamentId, name: `Group ${name}` }])
        .select()
        .single()
      if (data) groupIds.push(data.id)
    }

    // Assign participants to groups
    shuffled.forEach((p, i) => {
      const groupIdx = i % numGroups
      supabase.from("tournament_participants").update({ group_id: groupIds[groupIdx], seed: Math.floor(i / numGroups) + 1 }).eq("id", p.id).then()
    })

    // Generate group stage matches (round robin within each group)
    for (let g = 0; g < numGroups; g++) {
      const groupPlayers = shuffled.filter((_, i) => i % numGroups === g)
      for (let i = 0; i < groupPlayers.length; i++) {
        for (let j = i + 1; j < groupPlayers.length; j++) {
          await supabase.from("matches").insert([{
            tournament_id: tournamentId,
            group_id: groupIds[g],
            round: 1,
            player1_id: groupPlayers[i].user_id,
            player2_id: groupPlayers[j].user_id,
            status: "pending",
          }])
        }
      }
    }

    await supabase.from("tournaments").update({ status: "ongoing" }).eq("id", tournamentId)
    return
  }

  if (format_type === "round_robin") {
    // Everyone plays everyone
    for (let i = 0; i < shuffled.length; i++) {
      for (let j = i + 1; j < shuffled.length; j++) {
        await supabase.from("matches").insert([{
          tournament_id: tournamentId,
          round: 1,
          player1_id: shuffled[i].user_id,
          player2_id: shuffled[j].user_id,
          status: "pending",
        }])
      }
    }
    await supabase.from("tournaments").update({ status: "ongoing" }).eq("id", tournamentId)
    return
  }

  if (format_type === "teams") {
    // Pair participants into teams
    const teamSize = players_per_team || 2
    const teams: { user_id: string; team_id: number }[] = []

    shuffled.forEach((p, i) => {
      teams.push({ user_id: p.user_id, team_id: Math.floor(i / teamSize) })
    })

    // Generate matches between teams
    const teamIds = [...new Set(teams.map((t) => t.team_id))]
    for (let i = 0; i < teamIds.length; i += 2) {
      if (i + 1 < teamIds.length) {
        const team1Players = teams.filter((t) => t.team_id === teamIds[i])
        const team2Players = teams.filter((t) => t.team_id === teamIds[i + 1])
        await supabase.from("matches").insert([{
          tournament_id: tournamentId,
          round: 1,
          player1_id: team1Players[0]?.user_id || null,
          player2_id: team2Players[0]?.user_id || null,
          status: "pending",
        }])
      }
    }
    await supabase.from("tournaments").update({ status: "ongoing" }).eq("id", tournamentId)
    return
  }

  // Default: single elimination knockout
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    await supabase.from("matches").insert([{
      tournament_id: tournamentId,
      round: 1,
      player1_id: shuffled[i].user_id,
      player2_id: shuffled[i + 1].user_id,
      status: "pending",
    }])
  }
  await supabase.from("tournaments").update({ status: "ongoing" }).eq("id", tournamentId)
}

export async function updateMatchScore(matchId: string, score1: number, score2: number) {
  const supabaseClient = createClient()

  const { data: match } = await supabaseClient
    .from("matches")
    .select("player1_id, player2_id")
    .eq("id", matchId)
    .single()

  if (!match) throw new Error("Match not found")

  const updateData: any = { score1, score2, status: "completed" }
  if (score1 > score2) updateData.winner_id = match.player1_id
  else if (score2 > score1) updateData.winner_id = match.player2_id

  const { error } = await supabaseClient
    .from("matches")
    .update(updateData)
    .eq("id", matchId)
  if (error) throw error
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()
  if (error) throw error
  return data as Profile
}

export async function getAllProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("username")
  if (error) throw error
  return data as Profile[]
}

export async function updateProfile(userId: string, updates: Partial<Profile>) {
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
  if (error) throw error
}

export async function updateGame(id: string, updates: Partial<Game>) {
  const { error } = await supabase
    .from("games")
    .update(updates)
    .eq("id", id)
  if (error) throw error
}

export function subscribeToEvents(callback: (event: Event) => void) {
  return supabase
    .channel("events-channel")
    .on("postgres_changes", { event: "*", schema: "public", table: "events" }, (payload) => {
      callback(payload.new as Event)
    })
    .subscribe()
}

export function subscribeToTournaments(callback: (tournament: Tournament) => void) {
  return supabase
    .channel("tournaments-channel")
    .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, (payload) => {
      callback(payload.new as Tournament)
    })
    .subscribe()
}

export function subscribeToMatches(tournamentId: string, callback: (match: Match) => void) {
  return supabase
    .channel(`matches-${tournamentId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${tournamentId}` }, (payload) => {
      callback(payload.new as Match)
    })
    .subscribe()
}
