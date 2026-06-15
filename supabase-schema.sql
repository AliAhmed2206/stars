-- ============================================
-- STARS — Database Schema (v3 - No Auth)
-- Run this entire script in the Supabase SQL Editor
-- ============================================

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  bio TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert profiles" ON profiles;
CREATE POLICY "Anyone can insert profiles"
  ON profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update profiles" ON profiles;
CREATE POLICY "Anyone can update profiles"
  ON profiles FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can delete profiles" ON profiles;
CREATE POLICY "Anyone can delete profiles"
  ON profiles FOR DELETE USING (true);

-- EVENTS
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

DROP POLICY IF EXISTS "Anyone can create events" ON events;
CREATE POLICY "Anyone can create events"
  ON events FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete events" ON events;
CREATE POLICY "Anyone can delete events"
  ON events FOR DELETE USING (true);

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

-- Remove duplicate games
DELETE FROM games WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS rn
    FROM games
  ) dup WHERE dup.rn > 1
);

DO $$ BEGIN
  ALTER TABLE games ADD CONSTRAINT games_name_unique UNIQUE (name);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Games are viewable by everyone" ON games;
CREATE POLICY "Games are viewable by everyone"
  ON games FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can manage games" ON games;
CREATE POLICY "Anyone can manage games"
  ON games FOR ALL USING (true);

-- GAME FORMATS
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

DROP POLICY IF EXISTS "Anyone can manage formats" ON game_formats;
CREATE POLICY "Anyone can manage formats"
  ON game_formats FOR ALL USING (true);

-- TOURNAMENTS
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  format_id UUID REFERENCES game_formats(id),
  name TEXT NOT NULL,
  description TEXT,
  prizes TEXT DEFAULT '',
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('upcoming', 'open', 'ongoing', 'completed')),
  max_participants INT DEFAULT 16,
  settings JSONB DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tournaments are viewable by everyone" ON tournaments;
CREATE POLICY "Tournaments are viewable by everyone"
  ON tournaments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can create tournaments" ON tournaments;
CREATE POLICY "Anyone can create tournaments"
  ON tournaments FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update tournaments" ON tournaments;
CREATE POLICY "Anyone can update tournaments"
  ON tournaments FOR UPDATE USING (true);

-- TOURNAMENT GROUPS
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

DROP POLICY IF EXISTS "Anyone can manage groups" ON tournament_groups;
CREATE POLICY "Anyone can manage groups"
  ON tournament_groups FOR ALL USING (true);

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

DROP POLICY IF EXISTS "Participants are viewable by everyone" ON tournament_participants;
CREATE POLICY "Participants are viewable by everyone"
  ON tournament_participants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can join tournaments" ON tournament_participants;
CREATE POLICY "Anyone can join tournaments"
  ON tournament_participants FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can leave tournaments" ON tournament_participants;
CREATE POLICY "Anyone can leave tournaments"
  ON tournament_participants FOR DELETE USING (true);

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

DROP POLICY IF EXISTS "Matches are viewable by everyone" ON matches;
CREATE POLICY "Matches are viewable by everyone"
  ON matches FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can update matches" ON matches;
CREATE POLICY "Anyone can update matches"
  ON matches FOR UPDATE WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can insert matches" ON matches;
CREATE POLICY "Anyone can insert matches"
  ON matches FOR INSERT WITH CHECK (true);

-- Enable Real-time for all tables
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

-- Insert default games with images
INSERT INTO games (name, category, icon, image_url, description) VALUES
  ('PlayStation 5', 'playstation', '🎮', '/images/games/casino.webp', 'Console tournaments — FC 26, Tekken, and more'),
  ('FC 26', 'playstation', '⚽', '/images/games/fc-mobile-26.png', 'EA Sports FC 26 on PS5'),
  ('Football 11v11', 'football', '🏟️', '/images/games/football.webp', 'Full 11-a-side football matches'),
  ('Football 5v5', 'football', '⚽', '/images/games/football.webp', 'Small-sided 5-a-side football'),
  ('Padel', 'padel', '🎾', '/images/games/padel.webp', 'Padel doubles tournaments'),
  ('Brawl Stars', 'esports', '⭐', '/images/games/brawlstars.webp', '3v3 Brawl Ball, Gem Grab & Showdown'),
  ('eFootball', 'esports', '⚽', '/images/games/efootball.webp', 'Konami eFootball competitive'),
  ('FC Mobile', 'esports', '📱', '/images/games/fc-mobile-26.png', 'EA FC Mobile — on your phone'),
  ('Skrew', 'card_games', '🃏', '/images/games/casino.webp', 'The classic Skrew card game'),
  ('Casino (Poker)', 'card_games', '🃏', '/images/games/casino.webp', 'Texas Hold''em Poker'),
  ('Casino (Blackjack)', 'card_games', '🃏', '/images/games/casino.webp', 'Classic Blackjack')
ON CONFLICT (name) DO UPDATE SET image_url = EXCLUDED.image_url, description = EXCLUDED.description;

-- Insert default game formats
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

  INSERT INTO game_formats (game_id, name, type, min_players, max_players, players_per_team, description, settings) VALUES
    (brawl_id, '3v3 Brawl Ball', 'teams', 4, 12, 3, 'Two teams of 3. Best of 3 matches.', '{"team_size": 3, "mode": "brawl_ball", "best_of": 3}'),
    (brawl_id, '3v3 Gem Grab', 'teams', 4, 12, 3, 'Two teams of 3. Gem Grab rules.', '{"team_size": 3, "mode": "gem_grab", "best_of": 3}'),
    (brawl_id, 'Showdown (Solo)', 'showdown', 4, 10, 1, 'Free-for-all. Everyone vs everyone. Top scores advance.', '{"team_size": 1, "mode": "showdown_solo", "players_per_match": 10}'),
    (brawl_id, 'Showdown (Duo)', 'showdown', 6, 20, 2, 'Duo showdown. Pairs compete.', '{"team_size": 2, "mode": "showdown_duo", "players_per_match": 10}')
  ON CONFLICT (game_id, name) DO NOTHING;

  INSERT INTO game_formats (game_id, name, type, min_players, max_players, players_per_team, description, settings) VALUES
    (efoot_id, 'Knockout (1v1)', 'knockout', 4, 32, 1, 'Direct elimination. Best of 1 or Best of 3.', '{"format": "single_elimination", "best_of": 1}'),
    (efoot_id, 'Group Stage + Knockout', 'group_knockout', 8, 32, 1, 'Groups of 4, top 2 advance to knockout.', '{"format": "group_knockout", "group_size": 4, "advance_per_group": 2}'),
    (efoot_id, 'Round Robin', 'round_robin', 4, 12, 1, 'Everyone plays everyone. Most points wins.', '{"format": "round_robin"}')
  ON CONFLICT (game_id, name) DO NOTHING;

  INSERT INTO game_formats (game_id, name, type, min_players, max_players, players_per_team, description, settings) VALUES
    (fcmobile_id, 'Knockout (1v1)', 'knockout', 4, 32, 1, 'Direct elimination tournament.', '{"format": "single_elimination", "best_of": 1}'),
    (fcmobile_id, 'Round Robin', 'round_robin', 4, 12, 1, 'Everyone plays everyone.', '{"format": "round_robin"}')
  ON CONFLICT (game_id, name) DO NOTHING;

  INSERT INTO game_formats (game_id, name, type, min_players, max_players, players_per_team, description, settings) VALUES
    (ps5_id, 'Knockout (1v1)', 'knockout', 4, 16, 1, 'Direct elimination. Any game.', '{"format": "single_elimination", "best_of": 3}'),
    (ps5_id, 'Round Robin', 'round_robin', 4, 10, 1, 'Everyone plays everyone.', '{"format": "round_robin"}')
  ON CONFLICT (game_id, name) DO NOTHING;

  INSERT INTO game_formats (game_id, name, type, min_players, max_players, players_per_team, description, settings) VALUES
    (padel_id, 'Doubles Knockout', 'teams', 4, 16, 2, 'Pairs. Direct knockout tournament.', '{"team_size": 2, "format": "single_elimination", "best_of": 3}'),
    (padel_id, 'Doubles Round Robin', 'round_robin', 4, 16, 2, 'Pairs round robin.', '{"team_size": 2, "format": "round_robin"}')
  ON CONFLICT (game_id, name) DO NOTHING;

  INSERT INTO game_formats (game_id, name, type, min_players, max_players, players_per_team, description, settings) VALUES
    (foot11_id, 'Knockout', 'knockout', 2, 16, 11, 'Full 11v11 knockout.', '{"team_size": 11, "format": "single_elimination"}'),
    (foot5_id, 'Knockout', 'knockout', 2, 16, 5, '5v5 knockout tournament.', '{"team_size": 5, "format": "single_elimination"}'),
    (foot5_id, 'Round Robin', 'round_robin', 4, 12, 5, '5v5 round robin.', '{"team_size": 5, "format": "round_robin"}')
  ON CONFLICT (game_id, name) DO NOTHING;

  INSERT INTO game_formats (game_id, name, type, min_players, max_players, players_per_team, description, settings) VALUES
    (skrew_id, 'Knockout', 'knockout', 4, 16, 1, 'Direct elimination. Each round is a full game.', '{"format": "single_elimination"}'),
    (poker_id, 'Knockout', 'knockout', 4, 16, 1, 'Texas Hold''em knockout.', '{"format": "single_elimination"}'),
    (blackjack_id, 'Knockout', 'knockout', 2, 16, 1, 'Blackjack knockout tournament.', '{"format": "single_elimination"}')
  ON CONFLICT (game_id, name) DO NOTHING;
END $$;
