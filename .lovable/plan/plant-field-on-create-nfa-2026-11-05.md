# Plant field on Create NFA

## What is actually happening
There is only one Plant field on the screen. In the screenshot, the open Plant list covers the "PLANT" label, so the box on the right looks like an extra field. It is the Plant field, with plant 9000 selected.

It looks like a copy because each plant shows as "9000 – 9000". SAP sends back only plant numbers and no plant names, so the screen shows the number twice.

## Change
- Show each plant once, for example "9000" instead of "9000 – 9000". This applies to the selected box and to the drop-down list.
- When a name is different from the code, keep showing "code – name". The Company field is not affected.

## Not changed
The SAP plant call, the selected plant value sent to SAP, approver loading, validations and all other fields stay the same.

## Technical details
- In `src/routes/_authed.nfa.new.tsx`, when mapping `parsePlantF4` results for the Plant picker, set the label to just the code when name is empty or equal to the code. Alternatively, do this in the `SearchPicker` label formatter when `name === code`.
- The stored `plant` value (the code) stays the same.
