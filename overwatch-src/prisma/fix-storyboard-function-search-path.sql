-- Fix: function_search_path_mutable warning for update_storyboard_updated_at
-- Sets an immutable search_path to prevent search path injection attacks

CREATE OR REPLACE FUNCTION public.update_storyboard_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';
