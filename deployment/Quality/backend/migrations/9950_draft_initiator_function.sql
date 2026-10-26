ALTER TABLE public.sap_record_draft ADD COLUMN IF NOT EXISTS initiator_id uuid, ADD COLUMN IF NOT EXISTS initiator_name text, ADD COLUMN IF NOT EXISTS function_name text;
