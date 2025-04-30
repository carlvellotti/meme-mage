CREATE TABLE public.meme_generation_log (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    user_id uuid NOT NULL,
    template_id uuid NULL,
    initial_ai_caption text NULL,
    final_user_caption text NULL,
    CONSTRAINT meme_generation_log_pkey PRIMARY KEY (id),
    CONSTRAINT meme_generation_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT meme_generation_log_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.meme_templates(id) ON DELETE SET NULL
);

-- Enable Row Level Security
ALTER TABLE public.meme_generation_log ENABLE ROW LEVEL SECURITY;

-- Policies: Allow users to insert their own logs
CREATE POLICY "Allow users to insert their own generation logs" ON public.meme_generation_log
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policies: Allow users to select their own logs (Optional, if reading logs is needed later)
-- CREATE POLICY "Allow users to select their own generation logs" ON public.meme_generation_log
--   FOR SELECT
--   USING (auth.uid() = user_id);

-- Optional: Indexes
-- CREATE INDEX idx_meme_generation_log_user_id ON public.meme_generation_log(user_id);
-- CREATE INDEX idx_meme_generation_log_template_id ON public.meme_generation_log(template_id);
