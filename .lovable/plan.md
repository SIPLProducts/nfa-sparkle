# Show the user's name for every comment in Preview / Print Form

## Cause
Each comment is matched to a name through the approver list. User 1007 (varun yadav, an active portal user) commented at level 10 but isn't in the approver list SAP returned for this record, so the comment falls back to the raw User ID. The portal already looks up names for every comment User ID while preparing the form, but those names are applied only to approvers, never to comments.

## Fix
1. After the comments are merged, take any comment whose name is blank or equal to its User ID and replace it with that user's portal full name, using the name lookup that already exists.
2. If no portal user matches, the User ID stays, as it does today.
3. Comment text, order, versions and approver boxes stay unchanged. The same comments are used by Preview, Print Form and the PDFs.

## Verification
- A new test checks that a level-10 comment from 1007, with no matching approver, shows "varun yadav".
- A test checks that existing names are not overwritten and unknown IDs stay as IDs.
- Run all tests.

## Technical details
- `src/lib/prepare-web-print-form.ts`: add `applyCommentNames(comments, names)`, a pure helper that mirrors `applyApproverNames`, and apply it to the result of `mergeCompletePrintComments`.
