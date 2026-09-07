# Fix the missing TipTap table package during build

## Confirmed cause
- The editor correctly imports `@tiptap/extension-table` and the dependency is already declared in `package.json` and `bun.lock`.
- The project does not have an npm `package-lock.json`, so `npm ci` is not the correct clean-install command for this checkout.
- The Windows installation is missing or out of sync with the Bun lockfile; externalizing the package would only hide the missing dependency and could break tables at runtime.

## Plan
1. Keep the rich-text editor and table functionality unchanged.
2. Align the TipTap package versions where necessary and refresh the existing Bun lockfile so all TipTap peer dependencies resolve consistently.
3. Verify with a clean Bun dependency install and one production build.
4. Provide the exact Windows PowerShell cleanup/build commands. A successful build will generate `dist/`, including `dist/server/index.mjs`.

## Windows recovery commands
```powershell
Remove-Item -Recurse -Force node_modules
bun install --frozen-lockfile
bun run build
```

If Bun is not installed, install it first or use `npm install` (not `npm ci`, because this project currently has no npm lockfile), followed by `npm run build`.
