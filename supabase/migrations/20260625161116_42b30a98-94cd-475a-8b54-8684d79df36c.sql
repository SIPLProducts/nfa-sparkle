-- Enforce NFA approval workflow at the database level.

-- 1) Trigger: only the approver at the CURRENT level may transition their
--    own row, only from 'pending', only while the NFA is 'in_process', and
--    reject / sent_back / clarification require a non-empty comment.
CREATE OR REPLACE FUNCTION public.enforce_nfa_approver_action()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status public.nfa_status;
  v_level  integer;
BEGIN
  -- No-op updates to fields other than status pass through
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Caller must be the approver on this row
  IF NEW.approver_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorised to act on this approval row';
  END IF;

  -- Row must currently be pending
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'This approval step has already been actioned';
  END IF;

  -- Parent NFA must be in process at the matching level
  SELECT status, current_level INTO v_status, v_level FROM public.nfa WHERE id = NEW.nfa_id;
  IF v_status <> 'in_process' THEN
    RAISE EXCEPTION 'NFA is not currently awaiting approval';
  END IF;
  IF v_level <> OLD.level THEN
    RAISE EXCEPTION 'It is not your turn yet (current level is %, your level is %)', v_level, OLD.level;
  END IF;

  -- Only valid terminal statuses
  IF NEW.status NOT IN ('approved','rejected','sent_back','clarification') THEN
    RAISE EXCEPTION 'Invalid approver action: %', NEW.status;
  END IF;

  -- Comment required for non-approve actions
  IF NEW.status IN ('rejected','sent_back','clarification')
     AND (NEW.comment IS NULL OR length(btrim(NEW.comment)) = 0) THEN
    RAISE EXCEPTION 'A comment is required for Reject / Back / Clarification';
  END IF;

  -- Stamp acted_at automatically
  NEW.acted_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS nfa_approver_enforce ON public.nfa_approver;
CREATE TRIGGER nfa_approver_enforce
BEFORE UPDATE ON public.nfa_approver
FOR EACH ROW EXECUTE FUNCTION public.enforce_nfa_approver_action();

REVOKE EXECUTE ON FUNCTION public.enforce_nfa_approver_action() FROM PUBLIC, anon, authenticated;

-- 2) Canonical RPC the UI calls. Runs as SECURITY DEFINER so it can advance
--    the parent NFA (status / current_level) even though the approver has
--    no direct UPDATE policy on public.nfa.
CREATE OR REPLACE FUNCTION public.nfa_act(_nfa_id uuid, _action text, _comment text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_appr      public.nfa_approver%ROWTYPE;
  v_nfa       public.nfa%ROWTYPE;
  v_max_level integer;
  v_new_appr  public.approver_status;
  v_new_nfa   public.nfa_status;
  v_new_lvl   integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_nfa FROM public.nfa WHERE id = _nfa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NFA not found'; END IF;
  IF v_nfa.status <> 'in_process' THEN
    RAISE EXCEPTION 'NFA is not currently awaiting approval';
  END IF;

  SELECT * INTO v_appr
    FROM public.nfa_approver
   WHERE nfa_id = _nfa_id AND approver_id = v_uid AND level = v_nfa.current_level
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'It is not your turn to act on this NFA';
  END IF;
  IF v_appr.status <> 'pending' THEN
    RAISE EXCEPTION 'You have already actioned this NFA';
  END IF;

  IF _action NOT IN ('approve','reject','back','clarify') THEN
    RAISE EXCEPTION 'Unknown action: %', _action;
  END IF;

  IF _action IN ('reject','back','clarify')
     AND (_comment IS NULL OR length(btrim(_comment)) = 0) THEN
    RAISE EXCEPTION 'A comment is required for Reject / Back / Clarification';
  END IF;

  -- Map action -> new approver row status
  v_new_appr := CASE _action
    WHEN 'approve' THEN 'approved'::public.approver_status
    WHEN 'reject'  THEN 'rejected'::public.approver_status
    WHEN 'back'    THEN 'sent_back'::public.approver_status
    WHEN 'clarify' THEN 'clarification'::public.approver_status
  END;

  -- Compute new NFA status / level
  SELECT MAX(level) INTO v_max_level FROM public.nfa_approver WHERE nfa_id = _nfa_id;
  v_new_nfa := v_nfa.status;
  v_new_lvl := v_nfa.current_level;
  IF _action = 'approve' THEN
    IF v_appr.level >= v_max_level THEN
      v_new_nfa := 'completed'::public.nfa_status;
    ELSE
      v_new_lvl := v_appr.level + 1;
    END IF;
  ELSIF _action = 'reject' THEN
    v_new_nfa := 'rejected'::public.nfa_status;
  ELSIF _action = 'back' THEN
    v_new_nfa := 'with_initiator'::public.nfa_status;
    v_new_lvl := 0;
  ELSIF _action = 'clarify' THEN
    v_new_nfa := 'clarification'::public.nfa_status;
  END IF;

  UPDATE public.nfa_approver
     SET status = v_new_appr, comment = _comment, acted_at = now()
   WHERE id = v_appr.id;

  UPDATE public.nfa
     SET status = v_new_nfa, current_level = v_new_lvl
   WHERE id = _nfa_id;

  INSERT INTO public.nfa_audit(nfa_id, actor_id, action, comment)
  VALUES (_nfa_id, v_uid, format('Level %s: %s', v_appr.level, v_new_appr), _comment);
END $$;

REVOKE EXECUTE ON FUNCTION public.nfa_act(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.nfa_act(uuid, text, text) TO authenticated, service_role;

-- 3) Resubmit RPC for the initiator: reset chain to pending and move to L1.
CREATE OR REPLACE FUNCTION public.nfa_resubmit(_nfa_id uuid, _comment text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_nfa public.nfa%ROWTYPE;
  v_has_appr boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_nfa FROM public.nfa WHERE id = _nfa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NFA not found'; END IF;
  IF v_nfa.initiator_id <> v_uid THEN
    RAISE EXCEPTION 'Only the initiator can resubmit this NFA';
  END IF;
  IF v_nfa.status NOT IN ('with_initiator','clarification','rejected') THEN
    RAISE EXCEPTION 'NFA is not in a resubmittable state';
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.nfa_approver WHERE nfa_id = _nfa_id) INTO v_has_appr;
  IF NOT v_has_appr THEN
    RAISE EXCEPTION 'Add at least one approver before submitting';
  END IF;

  UPDATE public.nfa_approver SET status='pending', comment=NULL, acted_at=NULL WHERE nfa_id = _nfa_id;
  UPDATE public.nfa SET status='in_process', current_level=1 WHERE id = _nfa_id;
  INSERT INTO public.nfa_audit(nfa_id, actor_id, action, comment)
  VALUES (_nfa_id, v_uid, 'Re-submitted for approval', _comment);
END $$;

REVOKE EXECUTE ON FUNCTION public.nfa_resubmit(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.nfa_resubmit(uuid, text) TO authenticated, service_role;