# Fix status and eNFA number after creating an eNFA

## What is happening now (confirmed against the saved records)

- The last two records created (subjects "Test11", "Test1") are stored as **with_initiator / level 0**, while SAP did return numbers 100101 and 100011 — the numbers are saved to the record, but the status is never promoted. Today the screen only sets `in_process` on **Submit for Approval**; Save deliberately leaves the note with the initiator.
- On Save the code fires two toasts back to back — a generic "Draft saved" first, then SAP's message. The second toast is raised immediately before navigating to the record page, so in practice the SAP text (which carries "Submitted successfully with ENFA No 100101") is the one that gets lost.

## Changes (`src/routes/_authed.nfa.new.tsx`)

1. **Promote the record once SAP confirms.** After a successful SAP create (`STATUS = "S"` with an `ENFA_NO`), update the record to `in_process` in the same write that stores the eNFA number — level 1 when approvers were added, otherwise level 0 so nobody is falsely shown as pending. If SAP does not confirm, the record stays exactly as it is today.
2. **One clear success message.** Drop the separate "Draft saved" toast. Show a single toast built from SAP's response: SAP's `MESSAGE` plus the eNFA number rendered explicitly (`eNFA No 100101`) when the message does not already contain it. Failure messages keep their current wording.
3. **Show the number on the record page.** Navigate only after the status/number write completes, so the detail screen opens with the SAP eNFA number and the In Process badge already correct instead of the stale draft values.

## Notes

Submit for Approval keeps its current behaviour, and nothing changes in the payload, attachment handling, or the API-Settings-driven endpoint resolution.
