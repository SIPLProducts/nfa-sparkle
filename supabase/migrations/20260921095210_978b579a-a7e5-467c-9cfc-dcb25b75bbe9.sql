CREATE OR REPLACE FUNCTION public.get_print_initiator(_enfa_number text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.full_name
  FROM public.profiles p
  WHERE p.id = COALESCE(
    (
      SELECT n.initiator_id
      FROM public.nfa n
      WHERE n.enfa_number = btrim(_enfa_number)
      ORDER BY n.created_at ASC
      LIMIT 1
    ),
    (
      SELECT w.created_by
      FROM public.enfa_working_document w
      WHERE w.enfa_number = btrim(_enfa_number)
      ORDER BY w.created_at ASC
      LIMIT 1
    )
  )
    AND auth.uid() IS NOT NULL
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_print_initiator(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_print_initiator(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_print_initiator(text) TO service_role;