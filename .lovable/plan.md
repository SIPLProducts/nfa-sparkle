Build a phase-wise project plan workbook for the **ENFA (Note For Approval) Portal**, styled after the DMR_GRN_Project_Plan_v2.xlsx reference, using the phase durations from the attached PNG, scheduled from kickoff **Thu 30-Jul-2026**, plus a server sizing section for deployment.

Deliverable: `ENFA_Project_Plan_v1.xlsx` in your documents (downloadable), matching the reference workbook's structure and formatting conventions.

## Derived schedule (from PNG durations, working days)

```text
Sl  Phase                      Duration   Start         End
1   Initiation & Planning      —          Thu 30-Jul    Thu 30-Jul-2026
2   Requirement Gathering      1 Day      Fri 31-Jul    Fri 31-Jul-2026
3   Design & Architecture      2 Days     Mon 03-Aug    Tue 04-Aug-2026
4   Core Development           4 Weeks    Wed 05-Aug    Tue 01-Sep-2026
5   Testing & UAT              1 Week     Wed 02-Sep    Tue 08-Sep-2026
6   Deployment & Training      1 Week     Wed 09-Sep    Tue 15-Sep-2026
7   Go-Live & Hypercare        —          Wed 16-Sep-2026 → 16-Dec-2026 (3 months)
```

## Workbook sheets

**1. Cover** — Client, Implementation Partner, Scope (NFA Creation · NFA Changes · NFA Approval · NFA Report · SAP integration), Streams (Web Portal + SAP APIs), Kickoff, Go-Live, Duration, Hypercare, Prepared By, Version/Date. Same two-column layout as the reference.

**2. Phase Plan** — the PNG table expanded: Sl. No., Phase, Duration, Start, End, Key Activities, Deliverable, Owner. ENFA-specific activities:
- Initiation: kickoff, stakeholder alignment, resource plan, environment access
- Requirement Gathering: NFA types, approval matrix (6 levels), company/plant/project masters, report fields
- Design: screen design, DB schema, SAP API contracts, RBAC & security design
- Core Development: NFA Creation, NFA Changes, Approval workflow (Approve/Reject/Clarification), Attachments, Dashboard & NFA Status Report, SAP master-data + posting integration, mobile/PWA
- Testing & UAT: unit, integration, SIT, UAT with business users, security & performance pass
- Deployment & Training: production rollout, user/admin training, cutover
- Go-Live & Hypercare: stabilization support

**3. Weekly Plan** — W0–W7 rows with Week, Start (Mon), End (Fri), Phase, Stream, Focus, Key Deliverable — mirroring the reference sheet's columns.

**4. Gantt** — Phase / Workstream / Activity rows with colour-filled week columns (W0…W7 + hypercare), ★ marking Go-Live, plus the same legend row as the reference.

**5. Server Specification** — sizing tables for deployment, presented **both on-premise VM and cloud IaaS side by side**:
- Environments: Dev/QA, UAT, Production (+ optional DR)
- Per-tier sizing: App/Web server, Database server, Reverse proxy / load balancer, File-storage for NFA attachments
- Columns: Component, On-Prem VM (vCPU / RAM / OS disk / Data disk), Cloud equivalent (Azure & AWS instance types), Notes
- Baseline assumption stated on the sheet: ~1,000 named users / ~100 concurrent (adjustable — tell me your actual numbers and I'll re-size)
- Software stack: OS (Ubuntu LTS / RHEL), Node.js runtime, PostgreSQL, Nginx, SSL/TLS
- Network & security: ports, SAP connectivity/whitelisting, VPN, firewall, SSO
- Backup & DR: backup frequency, retention, RPO/RTO
- Non-functional: HA, monitoring, log retention

**6. Assumptions & Dependencies** — SAP API availability, master data readiness, UAT user availability, sign-off SLAs, holiday calendar.

## Technical notes
- Generated with a Python/openpyxl script (Arial, colour-coded phase fills matching the reference's Discover/Build/Test/Deploy/Hypercare palette, frozen headers, column widths, date formatting as `DD-Mmm-YYYY`).
- Every slide/sheet rendered and visually QA'd (converted to images and inspected) before delivery.
- No app code changes — this is a document deliverable only.
