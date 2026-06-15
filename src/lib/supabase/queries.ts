import { createClient } from "./client"
import type { Event, Game, Tournament, TournamentParticipant, Match, Profile } from "@/lib/types"

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

export async function getTournaments() {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*, game:games(*)")
    .order("created_at", { ascending: false })
  if (error) throw error
  return data as Tournament[]
}

export async function getTournament(id: string) {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*, game:games(*)")
    .eq("id", id)
    .single()
  if (error) throw error
  return data as Tournament
}

export async function createTournament(tournament: Omit<Tournament, "id" | "created_at" | "created_by">) {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("tournaments")
    .insert([{ ...tournament, created_by: user.user.id }])
    .select()
    .single()
  if (error) throw error
  return data as Tournament
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

export async function updateMatchScore(matchId: string, score1: number, score2: number) {
  const winner_id = score1 > score2 ? "player1_id" : score2 > score1 ? "player2_id" : null
  const supabaseClient = createClient()

  const updateData: any = { score1, score2, status: "completed" }

  const { data: match } = await supabaseClient
    .from("matches")
    .select("player1_id, player2_id")
    .eq("id", matchId)
    .single()

  if (match) {
    if (score1 > score2) updateData.winner_id = match.player1_id
    else if (score2 > score1) updateData.winner_id = match.player2_id
  }

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

export async function subscribeToEvents(callback: (event: Event) => void) {
  return supabase
    .channel("events-channel")
    .on("postgres_changes", { event: "*", schema: "public", table: "events" }, (payload) => {
      callback(payload.new as Event)
    })
    .subscribe()
}

export async function subscribeToTournaments(callback: (tournament: Tournament) => void) {
  return supabase
    .channel("tournaments-channel")
    .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, (payload) => {
      callback(payload.new as Tournament)
    })
    .subscribe()
}

export async function subscribeToMatches(tournamentId: string, callback: (match: Match) => void) {
  return supabase
    .channel(`matches-${tournamentId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${tournamentId}` }, (payload) => {
      callback(payload.new as Match)
    })
    .subscribe()
}
