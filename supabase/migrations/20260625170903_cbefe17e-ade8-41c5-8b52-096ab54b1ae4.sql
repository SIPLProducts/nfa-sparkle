
ALTER TABLE public.nfa_audit
  ADD COLUMN IF NOT EXISTS level integer,
  ADD COLUMN IF NOT EXISTS old_status text,
  ADD COLUMN IF NOT EXISTS new_status text,
  ADD COLUMN IF NOT EXISTS approver_name text,
  ADD COLUMN IF NOT EXISTS action_kind text;

CREATE OR REPLACE FUNCTION public.nfa_act(_nfa_id uuid, _action text, _comment text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_appr      public.nfa_approver%ROWTYPE;
  v_nfa       public.nfa%ROWTYPE;
  v_max_level integer;
  v_new_appr  public.approver_status;
  v_old_nfa   public.nfa_status;
  v_new_nfa   public.nfa_status;
  v_new_lvl   integer;
  v_aname     text;
  v_label     text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_nfa FROM public.nfa WHERE id = _nfa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NFA not found'; END IF;
  IF v_nfa.status <> 'in_process' THEN
    RAISE EXCEPTION 'NFA is not currently awaiting approval';
  END IF;

  SELECT * INTO v_appr
    FROM public.nfa_approver
   WHERE nfa_id = _nfa_id AND approver_id = v_uid AND level = v_nfa.current_level
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'It is not your turn to act on this NFA'; END IF;
  IF v_appr.status <> 'pending' THEN RAISE EXCEPTION 'You have already actioned this NFA'; END IF;

  IF _action NOT IN ('approve','reject','back','clarify') THEN
    RAISE EXCEPTION 'Unknown action: %', _action;
  END IF;
  IF _action IN ('reject','back','clarify')
     AND (_comment IS NULL OR length(btrim(_comment)) = 0) THEN
    RAISE EXCEPTION 'A comment is required for Reject / Back / Clarification';
  END IF;

  v_new_appr := CASE _action
    WHEN 'approve' THEN 'approved'::public.approver_status
    WHEN 'reject'  THEN 'rejected'::public.approver_status
    WHEN 'back'    THEN 'sent_back'::public.approver_status
    WHEN 'clarify' THEN 'clarification'::public.approver_status
  END;

  SELECT MAX(level) INTO v_max_level FROM public.nfa_approver WHERE nfa_id = _nfa_id;
  v_old_nfa := v_nfa.status;
  v_new_nfa := v_nfa.status;
  v_new_lvl := v_nfa.current_level;
  IF _action = 'approve' THEN
    IF v_appr.level >= v_max_level THEN v_new_nfa := 'completed'::public.nfa_status;
    ELSE v_new_lvl := v_appr.level + 1; END IF;
  ELSIF _action = 'reject' THEN v_new_nfa := 'rejected'::public.nfa_status;
  ELSIF _action = 'back' THEN v_new_nfa := 'with_initiator'::public.nfa_status; v_new_lvl := 0;
  ELSIF _action = 'clarify' THEN v_new_nfa := 'clarification'::public.nfa_status;
  END IF;

  UPDATE public.nfa_approver
     SET status = v_new_appr, comment = _comment, acted_at = now()
   WHERE id = v_appr.id;

  UPDATE public.nfa
     SET status = v_new_nfa, current_level = v_new_lvl
   WHERE id = _nfa_id;

  SELECT COALESCE(NULLIF(btrim(full_name), ''), email)
    INTO v_aname FROM public.profiles WHERE id = v_uid;

  v_label := CASE _action
    WHEN 'approve' THEN 'Approved'
    WHEN 'reject'  THEN 'Rejected'
    WHEN 'back'    THEN 'Sent Back to Initiator'
    WHEN 'clarify' THEN 'Requested Clarification'
  END;

  INSERT INTO public.nfa_audit(
    nfa_id, actor_id, action, comment,
    level, old_status, new_status, approver_name, action_kind
  )
  VALUES (
    _nfa_id, v_uid,
    format('Level %s: %s', v_appr.level, v_label),
    _comment,
    v_appr.level, v_old_nfa::text, v_new_nfa::text, v_aname, _action
  );
END $function$;
