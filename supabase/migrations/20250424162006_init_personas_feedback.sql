-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Personas Table
CREATE TABLE personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure unique persona names per user
    CONSTRAINT unique_user_persona_name UNIQUE (user_id, name)
);

-- Enable RLS
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;

-- Policies for personas
CREATE POLICY "Allow users to manage their own personas" 
ON personas 
FOR ALL -- Covers SELECT, INSERT, UPDATE, DELETE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Index for faster user lookup
CREATE INDEX idx_personas_user_id ON personas(user_id);

-- Trigger to update updated_at on update
CREATE TRIGGER set_persona_timestamp
BEFORE UPDATE ON personas
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Meme Feedback Table

-- Create ENUM type for status
DO $$ BEGIN
    CREATE TYPE meme_feedback_status AS ENUM ('used', 'dont_use');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE meme_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    -- Note: Deleting a persona will delete its feedback due to CASCADE
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE NOT NULL,
    template_id UUID REFERENCES meme_templates(id) ON DELETE CASCADE NOT NULL, -- Make sure meme_templates.id is UUID
    status meme_feedback_status NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure a user doesn't give conflicting feedback for the same persona/template
    CONSTRAINT unique_user_persona_template UNIQUE (user_id, persona_id, template_id)
);

-- Enable RLS
ALTER TABLE meme_feedback ENABLE ROW LEVEL SECURITY;

-- Policies for feedback
CREATE POLICY "Allow users to manage their own feedback"
ON meme_feedback
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Index optimized for the join in template filtering
CREATE INDEX idx_meme_feedback_user_persona_template ON meme_feedback(user_id, persona_id, template_id);

-- Trigger to update updated_at on update
CREATE TRIGGER set_feedback_timestamp
BEFORE UPDATE ON meme_feedback
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
