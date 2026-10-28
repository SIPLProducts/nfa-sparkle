-- Safe to re-run: ensures every saved-details column the portal writes exists, then reloads the API schema.
ALTER TABLE public.sap_record_draft ADD COLUMN IF NOT EXISTS approvers jsonb;
ALTER TABLE public.sap_record_draft ADD COLUMN IF NOT EXISTS approver_mode text;
ALTER TABLE public.sap_record_draft ADD COLUMN IF NOT EXISTS initiator_id uuid;
ALTER TABLE public.sap_record_draft ADD COLUMN IF NOT EXISTS initiator_name text;
ALTER TABLE public.sap_record_draft ADD COLUMN IF NOT EXISTS function_name text;
NOTIFY pgrst, 'reload schema';
