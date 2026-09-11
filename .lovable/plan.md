# Resolve Microsoft Word Connector Setup Error

## Confirmed cause

- The error shown is from the Lovable **App User Connector** setup card, not from the eNFA application or its database.
- Microsoft Word is available as a connector, but this workspace currently has no Microsoft Word client configured.
- The connection attempt was interrupted while Lovable was loading the setup form, so no Microsoft credentials were linked and no source-code changes were made.

## Resolution

1. Retry the Microsoft Word client setup from a fresh connector card.
2. If the card opens, configure the organization’s Microsoft Entra application, tenant ID, client ID, client secret, and required Word/OneDrive file permissions.
3. Confirm offline access is enabled so each signed-in Initiator can reconnect and save documents later.
4. Verify the client is linked to this project before implementing any Microsoft calls.
5. If the card fails again before showing the setup form, stop retrying and treat it as a Lovable connector-service issue; contact Lovable Support with the screenshot and timestamp.

## After connection succeeds

- Implement the already approved direct Microsoft Word editing plan.
- No app UI, workflow, SAP API, database, or document-storage changes will be made until the Microsoft client is successfully linked.
