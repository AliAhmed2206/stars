export interface Profile {
  id: string
  username: string
  avatar_url: string | null
  created_at: string
}

export interface Event {
  id: string
  title: string
  description: string | null
  date: string
  time: string | null
  location: string | null
  created_by: string
  created_at: string
}

export interface Game {
  id: string
  name: string
  category: "playstation" | "football" | "padel" | "esports" | "card_games"
  icon: string
  created_at: string
}

export interface Tournament {
  id: string
  game_id: string
  name: string
  description: string | null
  start_date: string | null
  end_date: string | null
  status: "upcoming" | "ongoing" | "completed"
  created_by: string
  created_at: string
  game?: Game
}

export interface TournamentParticipant {
  id: string
  tournament_id: string
  user_id: string
  seed: number
  created_at: string
  profile?: Profile
}

export interface Match {
  id: string
  tournament_id: string
  round: number
  player1_id: string | null
  player2_id: string | null
  score1: number | null
  score2: number | null
  winner_id: string | null
  status: "pending" | "in_progress" | "completed"
  created_at: string
  player1?: Profile
  player2?: Profile
  winner?: Profile
}

export interface GameCategory {
  id: string
  name: string
  icon: string
  color: string
  games: Game[]
}
