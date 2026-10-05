# Remove Create user field placeholders

## Change
- Remove the placeholder text from every input in the existing **Create user** dialog: User ID, First name, Last name, Email, Contact, Department, Password, and Confirm password.
- Remove the placeholder text from the company selector's search input.
- Keep all field labels, guidance text, validation, default Status value, company loading/selection behavior, password visibility controls, roles, submission payload, and dialog layout unchanged.
- Do not change placeholders elsewhere in User Management, including Edit user, password reset, role forms, or the main users search.

## Verification
- Open **User Management → Users → Create user** and confirm all listed empty inputs display no placeholder text.
- Open the Company Name selector and confirm its search box is blank while search still works.
- Confirm fields accept values and Create user validation and submission behavior remain unchanged.
