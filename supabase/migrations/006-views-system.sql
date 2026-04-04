-- Team members reference table
CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  group_id TEXT,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Groups reference table
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group membership (many-to-many)
CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
  member_id TEXT REFERENCES team_members(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, member_id)
);

-- Tag categories
CREATE TABLE IF NOT EXISTS tag_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES tag_categories(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add assignee_id and tags columns to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS group_id TEXT;

-- Add tags to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS assignee_id TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS group_id TEXT;

-- Add tags to budget_items
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS group_id TEXT;

-- Add tags to workflows
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS assignee_id TEXT;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS group_id TEXT;

-- Seed team members
INSERT INTO team_members (id, name, role, group_id, avatar) VALUES
  ('nadeem', 'Nadeem', 'Co-Founder', 'exec', '🟠'),
  ('derek', 'Derek', 'Co-Founder', 'exec', '🔵'),
  ('kevin', 'Kevin', 'Co-Founder', 'exec', '🟢'),
  ('mike', 'Mike', 'Data & Ops', 'data-analyst', '🟣')
ON CONFLICT (id) DO NOTHING;

-- Seed groups
INSERT INTO groups (id, name, description, color) VALUES
  ('exec', 'Exec', 'Executive leadership', 'amber'),
  ('account-manager', 'Account Manager', 'Client relationship management', 'blue'),
  ('marketing-manager', 'Marketing Manager', 'Paid media & funnel strategy', 'green'),
  ('data-analyst', 'Data Analyst', 'Data, ops & automation', 'purple'),
  ('event-coordinator', 'Event Coordinator', 'Event planning & execution', 'rose')
ON CONFLICT (id) DO NOTHING;

-- Seed group members
INSERT INTO group_members (group_id, member_id) VALUES
  ('exec', 'nadeem'), ('exec', 'derek'), ('exec', 'kevin'),
  ('account-manager', 'derek'),
  ('marketing-manager', 'kevin'),
  ('data-analyst', 'mike'),
  ('event-coordinator', 'nadeem'), ('event-coordinator', 'derek')
ON CONFLICT DO NOTHING;

-- Seed tag categories
INSERT INTO tag_categories (id, name, color) VALUES
  ('client', 'Client Tags', 'cyan'),
  ('state', 'State Tags', 'emerald'),
  ('event', 'Event Tags', 'violet'),
  ('importance', 'Importance Tags', 'rose')
ON CONFLICT (id) DO NOTHING;

-- Seed tags
INSERT INTO tags (id, category_id, label) VALUES
  ('breathe-for-change', 'client', 'Breathe for Change'),
  ('mantalks', 'client', 'ManTalks'),
  ('john-wineland', 'client', 'John Wineland'),
  ('soma-plus-iq', 'client', 'Soma Plus IQ'),
  ('krista-mishore', 'client', 'Krista Mishore'),
  ('active', 'state', 'Active'),
  ('onboarding', 'state', 'Onboarding'),
  ('paused', 'state', 'Paused'),
  ('completed', 'state', 'Completed'),
  ('virtual', 'event', 'Virtual'),
  ('in-person', 'event', 'In-Person'),
  ('workshop', 'event', 'Workshop'),
  ('masterclass', 'event', 'Masterclass'),
  ('critical', 'importance', 'Critical'),
  ('high', 'importance', 'High'),
  ('medium', 'importance', 'Medium'),
  ('low', 'importance', 'Low')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- Read-only policies (everyone can read)
CREATE POLICY "Anyone can read team_members" ON team_members FOR SELECT USING (true);
CREATE POLICY "Anyone can read groups" ON groups FOR SELECT USING (true);
CREATE POLICY "Anyone can read group_members" ON group_members FOR SELECT USING (true);
CREATE POLICY "Anyone can read tag_categories" ON tag_categories FOR SELECT USING (true);
CREATE POLICY "Anyone can read tags" ON tags FOR SELECT USING (true);
