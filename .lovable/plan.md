# Split company code out of Company Name

Today each saved company name still starts with its code (e.g. "1000 – Ramky Infrastructure Ltd"), so the code shows twice.

## Change
- One-time data update on the Companies list: remove the leading "code – " from every Company Name, so:
  - Company Code: 1000
  - Company Name: Ramky Infrastructure Ltd
- Only rows whose name starts with their own code are touched. Codes, descriptions and everything else stay the same.
- No screen, form or SAP integration changes.

## Production
Provide a small SQL file to run once in the Production SQL Editor:

```sql
UPDATE public.companies
SET name = btrim(regexp_replace(name, '^\s*' || code || '\s*[–-]\s*', ''))
WHERE code IS NOT NULL AND name ~ ('^\s*' || code || '\s*[–-]');
```

## Check
Read the Companies list back and confirm the code and name appear in their own columns.
