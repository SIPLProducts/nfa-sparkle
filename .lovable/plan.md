# Plan: Keep Create User popup open until explicit close

## Goal
Update the User Management Create User popup so it stays open during user creation and while using Inspect → Network. It should close only through the **X** close button or **Cancel** button.

## Confirmed current state
- The Create User popup is implemented in `src/routes/_authed.admin.users.tsx` as a custom modal, not the shared dialog component.
- It currently closes on successful create because `submit()` calls `closeDialog()` after `onSubmit(...)` completes.
- It also currently closes on the Escape key through a window `keydown` listener.
- The create request already sends the uppercase payload keys required for Network inspection: `USER_ID`, `FIRST_NAME`, `LAST_NAME`, `EMAIL`, `STATUS`, `CONTACT`, `PASSWORD`, `CONFPWRD`, `ROLE`, `EMP_ID`, and `DEPT`.

## Changes to make
1. Remove the automatic close after a successful `Create user` submit.
2. Remove Escape-key closing for this Create User popup, so only explicit buttons close it.
3. Keep the existing create flow intact:
   - Validate password and confirm password.
   - Send the same request payload.
   - Show success/error toast messages.
   - Refresh the User Management list after creation.
   - Keep loading state on the Create user button during submission.
4. Keep the X and Cancel buttons as the only close actions.

## Validation
- Open User Management and click **Create user**.
- Click outside the popup and simulate focus changes; confirm the popup remains open.
- Press Escape; confirm the popup remains open.
- Submit a user; confirm the network request payload is visible and the popup remains open.
- Click X and Cancel separately; confirm both close the popup.
