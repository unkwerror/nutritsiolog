# Vendored fonts

These TrueType fonts are bundled so the admin PDF export renders Cyrillic
reliably without depending on system-installed fonts (the standard 14 PDF
fonts cannot render Cyrillic).

- **Noto Serif** (`NotoSerif-Regular.ttf`, `NotoSerif-Bold.ttf`) — headings.
- **Noto Sans** (`NotoSans-Regular.ttf`, `NotoSans-Bold.ttf`) — body text.

Both are part of the **Noto** family by Google, licensed under the
**SIL Open Font License, Version 1.1** — freely usable and redistributable,
including bundling inside applications. See https://fonts.google.com/noto and
https://openfontlicense.org for the full license text.

Resolved at runtime via `import.meta.url` from `modules/admin/pdf.ts`, so the
same relative path works both in dev (tsx from `src/`) and prod (node from
`dist/`) — both sit one level under `api/`.
