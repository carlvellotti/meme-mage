-- Ensure the timestamp function exists (create if not needed if already exists from previous migrations)
-- Example: CREATE OR REPLACE FUNCTION trigger_set_timestamp() ... ;

-- Caption Generation Rules Table
CREATE TABLE caption_generation_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
    name text NOT NULL,
    rules_text text NOT NULL, -- Stores the user-defined rules content
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT unique_user_ruleset_name UNIQUE (user_id, name)
);

-- Indexes
CREATE INDEX idx_caption_rules_user_id ON caption_generation_rules(user_id);

-- RLS
ALTER TABLE caption_generation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow users to manage their own caption rules"
    ON caption_generation_rules
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
-- Assuming trigger_set_timestamp function already exists from previous migrations
CREATE TRIGGER set_rules_timestamp
    BEFORE UPDATE ON caption_generation_rules
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

COMMENT ON TABLE caption_generation_rules IS 'Stores user-defined sets of key rules for meme caption generation.';
COMMENT ON COLUMN caption_generation_rules.rules_text IS 'The specific text defining the key rules provided by the user.';
