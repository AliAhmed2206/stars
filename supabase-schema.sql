-- ============================================
-- STARS — Database Schema (v2)
-- Run this entire script in the Supabase SQL Editor
-- ============================================

-- PROFILES (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Add role column if upgrading from v1 (safe to run multiple times)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'));

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Set your admin
UPDATE profiles SET role = 'admin'
WHERE id IN (SELECT id FROM auth.users WHERE email = 'ali.120250176@ejust.edu.eg');

-- EVENTS (Summer Planner)
CREATE TABLE IF NOT EXISTS events (
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

DROP POLICY IF EXISTS "Events are viewable by everyone" ON events;
CREATE POLICY "Events are viewable by everyone"
  ON events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create events" ON events;
CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Creators can delete their events" ON events;
CREATE POLICY "Creators can delete their events"
  ON events FOR DELETE USING (auth.uid() = created_by);

-- GAMES
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('playstation', 'football', 'padel', 'esports', 'card_games')),
  icon TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Upgrade v1 games table with new columns
ALTER TABLE games ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
ALTER TABLE games ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

DROP POLICY IF EXISTS "Games are viewable by everyone" ON games;
CREATE POLICY "Games are viewable by everyone"
  ON games FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert games" ON games;
CREATE POLICY "Admins can insert games"
  ON games FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can update games" ON games;
CREATE POLICY "Admins can update games"
  ON games FOR UPDATE USING (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- GAME FORMATS (per-game tournament types)
CREATE TABLE IF NOT EXISTS game_formats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('knockout', 'group_knockout', 'showdown', 'round_robin', 'teams')),
  min_players INT NOT NULL DEFAULT 2,
  max_players INT NOT NULL DEFAULT 16,
  players_per_team INT DEFAULT 1,
  description TEXT DEFAULT '',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, name)
);

ALTER TABLE game_formats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Formats are viewable by everyone" ON game_formats;
CREATE POLICY "Formats are viewable by everyone"
  ON game_formats FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage formats" ON game_formats;
CREATE POLICY "Admins can manage formats"
  ON game_formats FOR ALL USING (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- TOURNAMENTS
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  format_id UUID REFERENCES game_formats(id),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'open', 'ongoing', 'completed')),
  max_participants INT DEFAULT 16,
  settings JSONB DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

-- Upgrade v1 tournaments table with new columns
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS format_id UUID REFERENCES game_formats(id);
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS max_participants INT DEFAULT 16;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
-- Update status constraint to include 'open'
ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_status_check;
ALTER TABLE tournaments ADD CONSTRAINT tournaments_status_check CHECK (status IN ('upcoming', 'open', 'ongoing', 'completed'));

DROP POLICY IF EXISTS "Tournaments are viewable by everyone" ON tournaments;
CREATE POLICY "Tournaments are viewable by everyone"
  ON tournaments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create tournaments" ON tournaments;
CREATE POLICY "Authenticated users can create tournaments"
  ON tournaments FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Creators can update their tournaments" ON tournaments;
CREATE POLICY "Creators can update their tournaments"
  ON tournaments FOR UPDATE USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Admins can update any tournament" ON tournaments;
CREATE POLICY "Admins can update any tournament"
  ON tournaments FOR UPDATE USING (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- TOURNAMENT GROUPS (for group stage)
CREATE TABLE IF NOT EXISTS tournament_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tournament_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Groups are viewable by everyone" ON tournament_groups;
CREATE POLICY "Groups are viewable by everyone"
  ON tournament_groups FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage groups" ON tournament_groups;
CREATE POLICY "Authenticated users can manage groups"
  ON tournament_groups FOR ALL USING (auth.role() = 'authenticated');

-- TOURNAMENT PARTICIPANTS
CREATE TABLE IF NOT EXISTS tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seed INT DEFAULT 0,
  group_id UUID REFERENCES tournament_groups(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;

-- Upgrade v1: add group_id column
ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES tournament_groups(id);

DROP POLICY IF EXISTS "Participants are viewable by everyone" ON tournament_participants;
CREATE POLICY "Participants are viewable by everyone"
  ON tournament_participants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can join tournaments" ON tournament_participants;
CREATE POLICY "Authenticated users can join tournaments"
  ON tournament_participants FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can leave tournaments" ON tournament_participants;
CREATE POLICY "Users can leave tournaments"
  ON tournament_participants FOR DELETE USING (auth.uid() = user_id);

-- MATCHES
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  group_id UUID REFERENCES tournament_groups(id),
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

-- Upgrade v1: add group_id column
ALTER TABLE matches ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES tournament_groups(id);

DROP POLICY IF EXISTS "Matches are viewable by everyone" ON matches;
CREATE POLICY "Matches are viewable by everyone"
  ON matches FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can update matches" ON matches;
CREATE POLICY "Authenticated users can update matches"
  ON matches FOR UPDATE WITH CHECK (auth.role() = 'authenticated');

-- Enable Real-time for all tables (ignore errors if already added)
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY['events', 'tournaments', 'tournament_participants', 'tournament_groups', 'matches', 'games', 'game_formats'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Insert default games with images (skip if already exist)
INSERT INTO games (name, category, icon, image_url, description) VALUES
  ('PlayStation 5', 'playstation', '🎮', 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/playstation/playstation-plain.svg', 'Console tournaments — FC 26, Tekken, and more'),
  ('FC 26', 'playstation', '⚽', 'https://upload.wikimedia.org/wikipedia/en/1/12/FC_25_cover.jpg', 'EA Sports FC 26 on PS5'),
  ('Football 11v11', 'football', '🏟️', 'https://upload.wikimedia.org/wikipedia/en/4/44/Football_pitch.svg', 'Full 11-a-side football matches'),
  ('Football 5v5', 'football', '⚽', 'https://upload.wikimedia.org/wikipedia/en/4/44/Football_pitch.svg', 'Small-sided 5-a-side football'),
  ('Padel', 'padel', '🎾', 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Padel_icon.png', 'Padel doubles tournaments'),
  ('Brawl Stars', 'esports', '⭐', 'https://cdn.supercell.com/supercell.com/2412191423/supercell.com/images/1b62c33b3a89aaf238d19b7ebd977ca5/games_brawlstars_hero.png', '3v3 Brawl Ball, Gem Grab & Showdown'),
  ('eFootball', 'esports', '⚽', 'https://upload.wikimedia.org/wikipedia/en/1/1e/EFootball_2024_logo.png', 'Konami eFootball competitive'),
  ('FC Mobile', 'esports', '📱', 'https://upload.wikimedia.org/wikipedia/en/2/2f/FC_Mobile_2024_logo.jpg', 'EA FC Mobile — on your phone'),
  ('Skrew', 'card_games', '🃏', 'https://upload.wikimedia.org/wikipedia/commons/6/64/Playing_cards_deck.svg', 'The classic Skrew card game'),
  ('Casino (Poker)', 'card_games', '🃏', 'https://upload.wikimedia.org/wikipedia/commons/6/64/Playing_cards_deck.svg', 'Texas Hold''em Poker'),
  ('Casino (Blackjack)', 'card_games', '🃏', 'https://upload.wikimedia.org/wikipedia/commons/6/64/Playing_cards_deck.svg', 'Classic Blackjack')
ON CONFLICT DO NOTHING;

-- Insert default game formats (skip duplicates)
DO $$
DECLARE
  brawl_id UUID;
  efoot_id UUID;
  fcmobile_id UUID;
  ps5_id UUID;
  padel_id UUID;
  foot5_id UUID;
  foot11_id UUID;
  skrew_id UUID;
  poker_id UUID;
  blackjack_id UUID;
BEGIN
  SELECT id INTO brawl_id FROM games WHERE name = 'Brawl Stars' LIMIT 1;
  SELECT id INTO efoot_id FROM games WHERE name = 'eFootball' LIMIT 1;
  SELECT id INTO fcmobile_id FROM games WHERE name = 'FC Mobile' LIMIT 1;
  SELECT id INTO ps5_id FROM games WHERE name = 'PlayStation 5' LIMIT 1;
  SELECT id INTO padel_id FROM games WHERE name = 'Padel' LIMIT 1;
  SELECT id INTO foot5_id FROM games WHERE name = 'Football 5v5' LIMIT 1;
  SELECT id INTO foot11_id FROM games WHERE name = 'Football 11v11' LIMIT 1;
  SELECT id INTO skrew_id FROM games WHERE name = 'Skrew' LIMIT 1;
  SELECT id INTO poker_id FROM games WHERE name = 'Casino (Poker)' LIMIT 1;
  SELECT id INTO blackjack_id FROM games WHERE name = 'Casino (Blackjack)' LIMIT 1;

  -- Brawl Stars formats
  INSERT INTO game_formats (game_id, name, type, min_players, max_players, players_per_team, description, settings) VALUES
    (brawl_id, '3v3 Brawl Ball', 'teams', 4, 12, 3, 'Two teams of 3. Best of 3 matches.', '{"team_size": 3, "mode": "brawl_ball", "best_of": 3}'),
    (brawl_id, '3v3 Gem Grab', 'teams', 4, 12, 3, 'Two teams of 3. Gem Grab rules.', '{"team_size": 3, "mode": "gem_grab", "best_of": 3}'),
    (brawl_id, 'Showdown (Solo)', 'showdown', 4, 10, 1, 'Free-for-all. Everyone vs everyone. Top scores advance.', '{"team_size": 1, "mode": "showdown_solo", "players_per_match": 10}'),
    (brawl_id, 'Showdown (Duo)', 'showdown', 6, 20, 2, 'Duo showdown. Pairs compete.', '{"team_size": 2, "mode": "showdown_duo", "players_per_match": 10}')
  ON CONFLICT (game_id, name) DO NOTHING;

  -- eFootball formats
  INSERT INTO game_formats (game_id, name, type, min_players, max_players, players_per_team, description, settings) VALUES
    (efoot_id, 'Knockout (1v1)', 'knockout', 4, 32, 1, 'Direct elimination. Best of 1 or Best of 3.', '{"format": "single_elimination", "best_of": 1}'),
    (efoot_id, 'Group Stage + Knockout', 'group_knockout', 8, 32, 1, 'Groups of 4, top 2 advance to knockout.', '{"format": "group_knockout", "group_size": 4, "advance_per_group": 2}'),
    (efoot_id, 'Round Robin', 'round_robin', 4, 12, 1, 'Everyone plays everyone. Most points wins.', '{"format": "round_robin"}')
  ON CONFLICT (game_id, name) DO NOTHING;

  -- FC Mobile formats
  INSERT INTO game_formats (game_id, name, type, min_players, max_players, players_per_team, description, settings) VALUES
    (fcmobile_id, 'Knockout (1v1)', 'knockout', 4, 32, 1, 'Direct elimination tournament.', '{"format": "single_elimination", "best_of": 1}'),
    (fcmobile_id, 'Round Robin', 'round_robin', 4, 12, 1, 'Everyone plays everyone.', '{"format": "round_robin"}')
  ON CONFLICT (game_id, name) DO NOTHING;

  -- PlayStation formats
  INSERT INTO game_formats (game_id, name, type, min_players, max_players, players_per_team, description, settings) VALUES
    (ps5_id, 'Knockout (1v1)', 'knockout', 4, 16, 1, 'Direct elimination. Any game.', '{"format": "single_elimination", "best_of": 3}'),
    (ps5_id, 'Round Robin', 'round_robin', 4, 10, 1, 'Everyone plays everyone.', '{"format": "round_robin"}')
  ON CONFLICT (game_id, name) DO NOTHING;

  -- Padel formats
  INSERT INTO game_formats (game_id, name, type, min_players, max_players, players_per_team, description, settings) VALUES
    (padel_id, 'Doubles Knockout', 'teams', 4, 16, 2, 'Pairs. Direct knockout tournament.', '{"team_size": 2, "format": "single_elimination", "best_of": 3}'),
    (padel_id, 'Doubles Round Robin', 'round_robin', 4, 16, 2, 'Pairs round robin.', '{"team_size": 2, "format": "round_robin"}')
  ON CONFLICT (game_id, name) DO NOTHING;

  -- Football formats
  INSERT INTO game_formats (game_id, name, type, min_players, max_players, players_per_team, description, settings) VALUES
    (foot11_id, 'Knockout', 'knockout', 2, 16, 11, 'Full 11v11 knockout.', '{"team_size": 11, "format": "single_elimination"}'),
    (foot5_id, 'Knockout', 'knockout', 2, 16, 5, '5v5 knockout tournament.', '{"team_size": 5, "format": "single_elimination"}'),
    (foot5_id, 'Round Robin', 'round_robin', 4, 12, 5, '5v5 round robin.', '{"team_size": 5, "format": "round_robin"}')
  ON CONFLICT (game_id, name) DO NOTHING;

  -- Card games formats
  INSERT INTO game_formats (game_id, name, type, min_players, max_players, players_per_team, description, settings) VALUES
    (skrew_id, 'Knockout', 'knockout', 4, 16, 1, 'Direct elimination. Each round is a full game.', '{"format": "single_elimination"}'),
    (poker_id, 'Knockout', 'knockout', 4, 16, 1, 'Texas Hold''em knockout.', '{"format": "single_elimination"}'),
    (blackjack_id, 'Knockout', 'knockout', 2, 16, 1, 'Blackjack knockout tournament.', '{"format": "single_elimination"}')
  ON CONFLICT (game_id, name) DO NOTHING;
END $$;
