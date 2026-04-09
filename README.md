# Desjardins TEF Validator

Desjardins TEF Validator is a small web application for validating fixed-width TEF files against the Desjardins / CPA-005 format.

The app is designed to help users inspect a TEF file before sending it to the bank. It validates the file structure, checks key field formats, reports record-level issues, and highlights mismatches in trailer totals.

## What The App Does

- Accepts TEF files such as `.txt`, `.eft`, and `.dat`
- Reads and validates files locally in the browser
- Checks record structure for `A`, `C`, and `Z` records
- Validates field positions, lengths, numeric formats, dates, institution numbers, account fields, and control totals
- Displays a detailed validation report with errors and warnings by record

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS

## Project Structure

- `client/`: frontend application
- `client/src/pages/Home.tsx`: main upload and report screen
- `client/src/lib/tefValidator.ts`: TEF validation logic

## Prerequisites

- Node.js 20+ recommended
- pnpm

To verify your environment:

```powershell
node -v
pnpm -v
```

## Install Dependencies

```powershell
pnpm install
```

## Run In Development

```powershell
pnpm dev
```

This starts the Vite development server, usually at:

```text
http://localhost:3000
```

## Build For Production

```powershell
pnpm build
```

This generates a static site in:

- `dist/`: built frontend assets ready for GitHub Pages

## Preview The Production Build

```powershell
pnpm preview
```

## Useful Commands

```powershell
pnpm check
pnpm format
pnpm preview
```

## Notes

- Validation is intended to run locally in the browser so files are not uploaded to a remote backend during normal use.

## Troubleshooting

### `vite` is not recognized

Install dependencies first:

```powershell
pnpm install
```

### `ERR_PNPM_EBUSY` or file lock errors on Windows

Common causes:

- OneDrive syncing the project folder
- Antivirus or another process scanning `node_modules`

Suggested fix:

1. Pause OneDrive syncing.
2. Retry `pnpm install`.
3. If needed, delete `node_modules` and reinstall.

```powershell
Remove-Item -Recurse -Force node_modules
pnpm install
```