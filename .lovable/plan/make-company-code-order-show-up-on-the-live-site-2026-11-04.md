# Make Company Code order show up on the live site

The code-order fix is only in the preview so far. Your screenshot is from the live site (enfa.siplproducts.com), which still has the old version that sorts by name. The fix shows up there only after the site is published.

## Steps
1. Make the order safe for codes of any length: sort by the number itself, so 900 comes before 1000. Companies with no code go to the end, sorted by name.
2. Publish the site so enfa.siplproducts.com gets the new order.
3. Open the Companies tab in the preview and confirm the first rows are 1000, 1101, 1102 and so on.

Departments, Designations and everything else stay the same.

## Production server
The separate Production server (10.200.1.7) needs the usual redeploy of the latest build to pick this up. It also needs the earlier `split-company-names.sql` run once.

## Technical details
- In `src/lib/master-lists.functions.ts`, when the kind is `companies`, sort the returned rows in the server function with a numeric-aware compare on `code`: blank codes last, then by name. Other kinds keep `.order("name")`.
