# Plan: Rename Reject Button for Initiator Role

## Goal
On the Approvals screen, display the destructive action button as **Cancel** when the signed-in user has the **Initiator** system role. For all other roles, the button remains **Reject**. No other behavior, API payload, or styling changes.

## Where
- `src/routes/_authed.approvals.tsx`

## What
1. Import `useAuth` from `@/lib/auth-context`.
2. Inside the `ApprovalsInbox` component, read `hasRole` from `useAuth()`.
3. Compute a label: `const rejectLabel = hasRole("initiator") ? "Cancel" : "Reject";`
4. Replace the literal text on the Reject button with `{rejectLabel}`.
5. Keep the `onClick` action as `"reject"`, the icon as `X`, and the destructive variant unchanged.

## What is NOT changing
- The SAP approval payload still sends `action: "reject"`.
- The `ApprovalCommentDialog` title, placeholder, and confirm text remain "Reject" (only the trigger button label changes).
- Button styling, icons, disabled state, and all other actions are untouched.
