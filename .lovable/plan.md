# Show/hide password eye icon

Add an eye icon inside the password boxes on:
- Set your password / Reset password screen: New password and Confirm password (each with its own toggle)
- Login screen: Password field

Clicking the eye shows the password; clicking again (eye-off) hides it. Nothing else changes: same labels, sizes, validation, submit behaviour and messages.

## Technical details
- `src/routes/reset-password.tsx` and `src/routes/auth.tsx`: wrap each Input in a `relative` div, add `pr-11`, switch `type` via local `useState`, add a `type="button"` ghost toggle with lucide `Eye`/`EyeOff` and `aria-label` "Show password"/"Hide password", matching the existing pattern in Create User.
