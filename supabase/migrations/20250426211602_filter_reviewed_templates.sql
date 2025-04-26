-- Update match_meme_templates to also filter for reviewed templates
CREATE OR REPLACE FUNCTION match_meme_templates(
  query_embedding vector(1536), 
  match_threshold double precision, 
  match_count int,
  filter_greenscreen boolean, 
  user_id_param uuid,          
  persona_id_param uuid        
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
      meme_feedback mf ON mt.id = mf.template_id
                       AND mf.user_id = user_id_param
                       AND mf.persona_id = persona_id_param
                       AND persona_id_param IS NOT NULL
  WHERE
    mt.embedding IS NOT NULL AND
    mt.reviewed = TRUE AND
    (filter_greenscreen IS NULL OR mt.is_greenscreen = filter_greenscreen) AND
    (persona_id_param IS NULL OR mf.id IS NULL)
  ORDER BY
    mt.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Update get_random_meme_templates to also filter for reviewed templates
CREATE OR REPLACE FUNCTION get_random_meme_templates(
  limit_count int,
  filter_greenscreen boolean,
  user_id_param uuid,         
  persona_id_param uuid        
)
RETURNS SETOF meme_templates 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mt.*
  FROM
    meme_templates mt
  LEFT JOIN
      meme_feedback mf ON mt.id = mf.template_id
                       AND mf.user_id = user_id_param
                       AND mf.persona_id = persona_id_param
                       AND persona_id_param IS NOT NULL
  WHERE
    mt.reviewed = TRUE AND
    (filter_greenscreen IS NULL OR mt.is_greenscreen = filter_greenscreen) AND
    (persona_id_param IS NULL OR mf.id IS NULL)
  ORDER BY
    random()
  LIMIT limit_count;
END;
$$;
