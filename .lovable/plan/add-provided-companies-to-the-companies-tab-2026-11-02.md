# Add provided companies to the Companies tab

Insert the companies from the 8 screenshots as rows in the Companies list. No screen, field or behaviour changes.

## How each company appears
- Company Name: shown as in SAP, e.g. `1000 – Ramky Infrastructure Ltd` (code kept in the name so the three "BLOCKED NOT IN USE" entries stay distinct, since names must be unique).
- The SAP code is also stored in the hidden code field. Description left blank.
- Companies that already exist with the same name are skipped (no duplicates).

## Companies (57)
1000 Ramky Infrastructure Ltd, 1101 BLOCKED NOT IN USE, 1102 Visakha Pharmacity Ltd, 1103 Ramky Enclave Limited, 1104 Hospet Chitradurga Tollwa, 1106 BLOCKED NOT IN USE, 1112 Srinagar Banihal Exp Ltd, 1113 Ramky Multi Product, 1114 HYDERABAD STP'S LIMITED, 1115 BLOCKED NOT IN USE, 1120 Pantnagar CETP Pvt.Ltd, 1122 Sehore Kosmi Tollways Ltd, 1123 MDDA Ramky IS Bus Termina, 1124 Ramky Elsamex Hyd Ring Rd, 1125 ADIPL-RAMKY JV, 1126 FFIL - RIL JV, 1127 RECEPS LIMITED, 1128 VISAKHA ENERGY LIMITED, 1129 EVER BLOOMING ECO SOLUTIO, 1130 RIL - ECAIPL JV, 1131 ECO CARBON ENGINE SOL LTD, 1132 CHENNAI BIOMINING LIMITED, 1133 MALLANNASAGAR WATER S LTD, 1134 MAHA INTEGRATED LSC LTD, 1135 RAMDIL EPC WORKS LIMITED, 1136 RIL - VA TECH WABAG JV, 1137 VISAKHA PHARMA I AND I LT, 1138 JNPC PHARMA INNOVATION LT, 1303 NAM Expressway Limited, 1501 Ramky-SMC (JV), 1601 Ramky Engineering & Consu, 4000 Ithaca Estates Pvt Ltd, 4001 Royaume Estates Pvt Ltd, 4002 Royaume Builders & Promot, 4003 Skylark Arcadia Pvt Ltd, 9000 Ramky Estates & Farms Ltd, 9101 Ramky Integ Township Ltd, 9102 Ramky Buildcon Pvt Ltd, 9103 Ramky Properties Developm, 9104 Ramky Viha Properties Pv, 9105 Ramky SriSairam Prop Pvt., 9106 Chennai Green Woods Pvt L, 9107 Ramky Signature One Pvt, 9108 Ramky Truspace Homes Pvt, 9109 Ramky Towers Limited, 9110 Ramky Villas Limited, 9111 Ramky Srivaishnava Builde, 9112 Ramky Frontier Homes, 9113 Ramky Sarasven Private Li, 9114 Ramky Urban Homes Private, 9115 Ramky Realta Gardenpark L, 9116 Ramky DVT Infra Private L, 9200 Ramky Atalian Pvt Ltd, 9201 ECFM India Limited, 9301 Ramky Wavoo Developers, 9500 Multigen India Private Li, 9501 Multigen Gardencity Homes, 9502 Multigen Elite Spaces Dev

Note: the last screenshot ends at 9502 with the list still scrollable; any companies after it need to be sent separately.

## Technical details
- One data insert into `public.companies` (name, code, is_active=true) with `ON CONFLICT DO NOTHING` / not-exists guard.
- Provide the same SQL for the Production SQL Editor.
