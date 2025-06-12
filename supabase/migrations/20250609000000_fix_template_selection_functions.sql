-- Update match_meme_templates function with proper filtering and parameter names
CREATE OR REPLACE FUNCTION match_meme_templates(
  query_embedding vector(1536), 
  match_threshold double precision DEFAULT 0.1, 
  match_count int DEFAULT 5,
  filter_greenscreen boolean DEFAULT NULL, 
  user_id_param uuid DEFAULT NULL,          
  persona_id_param uuid DEFAULT NULL,
  filter_category text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    name text,
    video_url text,
    instructions text,
    similarity double precision,
    feedback_status text
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
    1 - (mt.embedding <=> query_embedding) as similarity,
    mf.status as feedback_status
  FROM
    meme_templates mt
  LEFT JOIN
      meme_feedback mf ON mt.id = mf.template_id
                       AND mf.user_id = user_id_param
                       AND mf.persona_id = persona_id_param
                       AND persona_id_param IS NOT NULL
  WHERE
    mt.embedding IS NOT NULL 
    AND mt.reviewed = TRUE 
    AND (filter_greenscreen IS NULL OR mt.is_greenscreen = filter_greenscreen) 
    AND (filter_category IS NULL OR mt.category = filter_category)
    AND (persona_id_param IS NULL OR mf.id IS NULL OR mf.status NOT IN ('used', 'dont_use'))
    AND (1 - (mt.embedding <=> query_embedding)) > match_threshold
  ORDER BY
    mt.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Update get_random_meme_templates function with proper filtering and parameter names
CREATE OR REPLACE FUNCTION get_random_meme_templates(
  limit_count int DEFAULT 5,
  filter_greenscreen boolean DEFAULT NULL,
  user_id_param uuid DEFAULT NULL,         
  persona_id_param uuid DEFAULT NULL,
  filter_category text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    name text,
    video_url text,
    instructions text,
    feedback_status text,
    is_greenscreen boolean,
    category text,
    reviewed boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
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
    mf.status as feedback_status,
    mt.is_greenscreen,
    mt.category,
    mt.reviewed,
    mt.created_at,
    mt.updated_at
  FROM
    meme_templates mt
  LEFT JOIN
      meme_feedback mf ON mt.id = mf.template_id
                       AND mf.user_id = user_id_param
                       AND mf.persona_id = persona_id_param
                       AND persona_id_param IS NOT NULL
  WHERE
    mt.reviewed = TRUE 
    AND (filter_greenscreen IS NULL OR mt.is_greenscreen = filter_greenscreen) 
    AND (filter_category IS NULL OR mt.category = filter_category)
    AND (persona_id_param IS NULL OR mf.id IS NULL OR mf.status NOT IN ('used', 'dont_use'))
  ORDER BY
    random()
  LIMIT limit_count;
END;
$$; 