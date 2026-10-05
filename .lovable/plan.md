# Show fresh SAP data on the NFA Details screen

## Confirmed issue

The pictured page currently opens by loading a local `nfa` record using its database ID. It then calls SAP and overlays only some returned values. If SAP omits a field or cannot be reached, the page displays locally stored Company, Plant, NFA Type, Function, Subject, impacts, description, status, initiator, date, and attachments. This is why the page can show local or stale data instead of the exact SAP record.

## Changes

1. Use the ENFA number to request the current record from the configured SAP Select/Detail endpoint whenever this page opens.
2. Display Company, Plant, NFA Type, Function, Subject, Scope Impact, Budget, Timeline, Initiator, Created date, status, Detailed Description, and approval information only from the SAP response.
3. Remove all local `nfa`, profile, hardcoded master-data, and locally saved description fallbacks from this page.
4. Load supporting documents from the existing SAP Attachments endpoint and send new uploads directly to SAP; do not read or write the local NFA attachment store from this page.
5. If SAP returns no record or an error, show that response clearly instead of displaying stale local values.
6. Keep the current layout, Back navigation, permissions, login, other screens, users, and existing historical data unchanged.

## Verification

- Open the pictured record and compare every displayed field with the live SAP detail response.
- Change a value in SAP, refresh the page, and confirm the new value appears immediately.
- Confirm an SAP error shows an error state and never falls back to local data.
- Confirm attachment list, preview, download, and upload operate through SAP only.
- Verify the page on desktop and mobile and confirm the rest of the portal still builds and works.
