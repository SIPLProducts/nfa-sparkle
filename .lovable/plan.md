# Consistent SweetAlert messages across the portal

## User-facing result

- Replace every transient success, error, warning, and information toast with a SweetAlert popup.
- The NFA submission result, including the dynamic SAP-returned eNFA number, appears in SweetAlert instead of the current top-right toast.
- Replace confirmation windows with SweetAlert confirmations, including:
  - Approve
  - Reject / Cancel
  - Back To Initiator
  - Clarification
  - SAP endpoint deletion
  - SAP system deletion
  - Role deletion and any other destructive action found during implementation
- Approval actions continue to collect comments inside SweetAlert. Mandatory remarks remain mandatory, while approval comments remain optional where currently allowed.
- Preserve messages returned by SAP and the backend verbatim. Existing fallback wording remains only where no dynamic message is supplied.

## Implementation

1. Add SweetAlert2 and create one shared portal alert utility for success, error, warning, information, and confirmation prompts.
2. Style SweetAlert through the existing portal theme so popups are consistent on desktop and mobile, with accessible focus, keyboard, cancel, loading, and disabled states.
3. Replace all Sonner calls across login, NFA creation/details/change, My NFAs, Approvals, Reports, Print Form, attachments, User Management, and SAP API Settings.
4. Replace the current approval-comment dialog with a SweetAlert prompt that retains the selected eNFA number, action-specific labels, mandatory-comment rules, and current submission handlers.
5. Replace existing delete dialogs and direct destructive actions with awaited SweetAlert confirmation before running the unchanged mutation.
6. Remove the global toast renderer and obsolete message-dialog usage after confirming no callers remain.
7. Keep persistent page content that is not a popup message—loading indicators, empty-list states, field help, validation labels, and status badges—unchanged. Persistent access/service errors may remain visible on their page in addition to the one-time SweetAlert so users can still retry and understand why data is absent.

## Verification

- Verify NFA creation shows the exact SAP success text and returned eNFA number in SweetAlert before navigation completes.
- Verify error, warning, and information paths use the correct SweetAlert icon and dynamic message.
- Verify all four approval actions collect and submit remarks correctly, including mandatory validation and cancellation without an API call.
- Verify destructive actions run only after confirmation and cancellation changes nothing.
- Search for remaining Sonner calls, then run type checks, focused workflow tests, and browser checks at desktop and mobile sizes.

## Scope safeguards

- No SAP endpoint, payload, response handling, workflow rule, permission, database schema, saved data, or page layout changes.
- No hardcoded eNFA numbers, users, SAP responses, or record data.
