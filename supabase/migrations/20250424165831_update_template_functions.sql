-- Update match_meme_templates to filter based on feedback
CREATE OR REPLACE FUNCTION match_meme_templates(
  query_embedding vector(1536), -- Match your embedding model dimension
  match_threshold double precision, -- Keep threshold for potential future use, even if not in current SELECT
  match_count int,
  filter_greenscreen boolean, -- Renamed from is_greenscreen_filter for consistency
  user_id_param uuid,          -- New: User ID for feedback filtering
  persona_id_param uuid        -- New: Persona ID for feedback filtering (can be NULL)
)
RETURNS TABLE (
    id uuid,
    name text,
    video_url text,
    instructions text,
    similarity double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mt.id,
    mt.name,
    mt.video_url,
    mt.instructions,
    1 - (mt.embedding <=> query_embedding) as similarity
  FROM
    meme_templates mt
  LEFT JOIN
      -- Join feedback only if a persona ID is provided
      meme_feedback mf ON mt.id = mf.template_id
                       AND mf.user_id = user_id_param
                       AND mf.persona_id = persona_id_param
                       AND persona_id_param IS NOT NULL -- Optimization: only join if persona_id is relevant
  WHERE
    mt.embedding IS NOT NULL AND
    (filter_greenscreen IS NULL OR mt.is_greenscreen = filter_greenscreen) AND
    -- Filter out templates with feedback *only if* a persona ID was provided
    (persona_id_param IS NULL OR mf.id IS NULL)
  ORDER BY
    mt.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Update get_random_meme_templates to filter based on feedback
CREATE OR REPLACE FUNCTION get_random_meme_templates(
  limit_count int,
  filter_greenscreen boolean,
  user_id_param uuid,          -- New: User ID for feedback filtering
  persona_id_param uuid        -- New: Persona ID for feedback filtering (can be NULL)
)
RETURNS SETOF meme_templates -- Returns the whole template row
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mt.*
  FROM
    meme_templates mt
  LEFT JOIN
      -- Join feedback only if a persona ID is provided
      meme_feedback mf ON mt.id = mf.template_id
                       AND mf.user_id = user_id_param
                       AND mf.persona_id = persona_id_param
                       AND persona_id_param IS NOT NULL -- Optimization
  WHERE
    (filter_greenscreen IS NULL OR mt.is_greenscreen = filter_greenscreen) AND
    -- Filter out templates with feedback *only if* a persona ID was provided
    (persona_id_param IS NULL OR mf.id IS NULL)
  ORDER BY
    random()
  LIMIT limit_count;
END;
$$;
