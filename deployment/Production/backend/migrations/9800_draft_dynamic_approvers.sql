-- Approvers selected by the initiator at creation, used for workflow email routing.
ALTER TABLE public.sap_record_draft ADD COLUMN IF NOT EXISTS approvers jsonb;
ALTER TABLE public.sap_record_draft ADD COLUMN IF NOT EXISTS approver_mode text;
