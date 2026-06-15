-- ============================================
-- STARS — Database Schema
-- Run this entire script in the Supabase SQL Editor
-- ============================================

-- PROFILES (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- EVENTS (Summer Planner)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TIME,
  location TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events are viewable by everyone"
  ON events FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Creators can delete their events"
  ON events FOR DELETE USING (auth.uid() = created_by);

-- GAMES
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('playstation', 'football', 'padel', 'esports', 'card_games')),
  icon TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Games are viewable by everyone"
  ON games FOR SELECT USING (true);

CREATE POLICY "Anyone can insert games"
  ON games FOR INSERT WITH CHECK (true);

-- Insert default games
INSERT INTO games (name, category) VALUES
  ('PlayStation 5', 'playstation'),
  ('FC 26', 'playstation'),
  ('Football 11v11', 'football'),
  ('Football 5v5', 'football'),
  ('Padel', 'padel'),
  ('Brawl Stars', 'esports'),
  ('eFootball', 'esports'),
  ('FC Mobile', 'esports'),
  ('Skrew', 'card_games'),
  ('Casino (Poker)', 'card_games'),
  ('Casino (Blackjack)', 'card_games')
ON CONFLICT DO NOTHING;

-- TOURNAMENTS
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed')),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tournaments are viewable by everyone"
  ON tournaments FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create tournaments"
  ON tournaments FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Creators can update their tournaments"
  ON tournaments FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Creators can delete their tournaments"
  ON tournaments FOR DELETE USING (auth.uid() = created_by);

-- TOURNAMENT PARTICIPANTS
CREATE TABLE tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seed INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants are viewable by everyone"
  ON tournament_participants FOR SELECT USING (true);

CREATE POLICY "Authenticated users can join tournaments"
  ON tournament_participants FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can leave tournaments"
  ON tournament_participants FOR DELETE USING (auth.uid() = user_id);

-- MATCHES
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round INT NOT NULL DEFAULT 1,
  player1_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  player2_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  score1 INT,
  score2 INT,
  winner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Matches are viewable by everyone"
  ON matches FOR SELECT USING (true);

CREATE POLICY "Authenticated users can update matches"
  ON matches FOR UPDATE WITH CHECK (auth.role() = 'authenticated');

-- Enable Real-time for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE tournament_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
