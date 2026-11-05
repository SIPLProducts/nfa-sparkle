# Live SAP counts on the Dashboard

## What the user will see
The five top cards and the NFA Status Overview doughnut will show the counts SAP returns for the signed-in user. The counts load each time the dashboard opens.

| SAP field | Card / chart slice |
|---|---|
| LV_INP | Pending |
| LV_COMP | Approved |
| LV_REJ | Rejected |
| LV_WITH | Back to Initiator |
| LV_REQ | Clarification |

- **While loading:** the cards show a dash.
- **If SAP fails:** a short message with a Retry button appears. No made-up numbers are shown.
- **Unchanged:** card links, the Quick actions and Pending your approval cards, the lists below, and every other SAP call.

## Request
The request uses the existing **Dashboard Count Api** entry in SAP API Settings (GET `/e-nfa/enfa_report//create?sap-client=300`). The body is `{"dashboard":{"user_name":"<signed-in user's User ID>"}}`. The User ID is taken on the server from the signed-in user's account, never from the browser.

## Technical details
- `src/lib/sap/dashboard-counts.ts`: pure helpers `buildDashboardCountsPayload(userName)` and `parseDashboardCounts(json)`. The parser maps the LV_* fields to `{ pending, approved, rejected, backToInitiator, clarification }`, accepts numeric strings, and unwraps a `body` wrapper.
- Tests: the sample response maps to 48 / 25 / 21 / 6 / 2, and the payload has the exact shape above.
- `src/lib/sap-report.server.ts`: `callDashboardCounts(userName)`, modeled on the existing settings-driven calls. It looks up the active endpoint named "Dashboard Count Api" (or a request template containing `"dashboard"`), with no hardcoded URL.
- `src/lib/dashboard-counts.functions.ts`: a `createServerFn` with `requireSupabaseAuth`. It resolves the caller's portal User ID from their profile, calls SAP and returns the parsed counts or an error.
- `src/routes/index.tsx`: the component calls the function once on mount (via `useServerFn`). The five KPI values and the doughnut data use the SAP counts. The old locally computed counts are no longer used for these cards. The rest of the page is unchanged.
- Production: publish and redeploy. The Dashboard Count Api entry must exist in Production's SAP API Settings.
