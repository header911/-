# Haydar Pack V57.5 — Architecture, Audit, Repair, and Test Report

## A. Architecture summary

The application is a static, mobile-first browser application loaded by `index.html`. Its runtime is intentionally layered:

1. `01-core-base.js` defines the legacy database, screens, CRUD operations, calculations, backups, exports, and fallbacks.
2. `02-business-legacy.js` applies later business and document overrides.
3. `03-boot-calc-print.js` installs the boot guard, the canonical `HP_CALC` financial API, and a later print implementation.
4. `04-sync-import.js` installs local-first Google synchronization and replaces the global `save()` function.
5. `05-feature-patches.js` applies deletion recovery, order, document, and stability patches.
6. `06-data-protection-images-backup.js` separates large images, adds IndexedDB/File System Access backups, and adds backup/error tooling.
7. `07-clients-final.js` installs the final client screen and client data-protection behavior.
8. `08-post49-final-modules.js` installs the final mobile navigation, reports, finance views, document archive/printing, quality gate, capital wallet, and smart summary.

The working database is stored under the existing localStorage key `hayder_bags_app`. Pending cloud changes and sync metadata use their existing localStorage keys. Images and backup-folder handles use IndexedDB/File System Access APIs where supported.

Google Apps Script communication is local-first. Reads and metadata checks use JSONP. Writes use a hidden form/iframe POST, followed by a JSONP read-back and checksum comparison. A pending local snapshot prevents a newer local change from being replaced by an older cloud copy.

Invoices, quotations, and statements are generated as standalone HTML documents in a popup. The browser print dialog is the PDF engine. The document `<title>` supplies the suggested PDF filename. Excel exports use the existing ExcelJS/XLSX CDN libraries.

No Google Apps Script source (`Code.gs` or equivalent) was included in the archive. Server-side spreadsheet batching, `LockService`, cache use, permissions, and deployment code therefore could not be directly audited or modified.

## B. Audit report

### Critical

- The service worker handled every GET from a controlled client and could cache cross-origin Google Apps Script/JSONP responses. That creates a stale-cloud-response risk. It now ignores every non-same-origin request.

### High

- Auto-print used a fixed 450–500 ms timer. Slow logos or fonts could be missing or could change layout after pagination began.
- Auto-print markup was appended after the closing `</html>` tag for archived documents.
- Wide 10–12-column tables had no hard printable-width/min-width constraints.
- Archived document snapshots retained old fragile print CSS indefinitely.
- Old fixed footers could overlap long content; the final archived-document sanitizer now removes them and applies the current repair layer.

### Medium

- Monetary arithmetic used raw binary floating-point sums in the central calculation layer. Results are now rounded consistently to two decimals at monetary boundaries.
- HTML `min="0"` attributes existed, but JavaScript handlers still accepted negative payments, expenses, and transfers. Runtime validation now rejects them.
- Synchronous save handlers had no duplicate-click lock. A 900 ms per-action guard now prevents accidental duplicate records.
- Large accessibility fonts forced report statistic columns wider than a 390 px viewport. Grid tracks now use `minmax(0,1fr)` and values wrap safely.
- Cloud metadata was checked every 20 seconds even while the page was hidden. The interval is now 60 seconds and skips hidden/offline states.
- PWA precache listed both versioned and unversioned copies of most large assets. Only the deployed URLs are now precached.
- Filename sanitization did not remove control/bidirectional characters, trailing dots, or Windows reserved names. It now does.

### Low / retained risks

- The eight-bundle override chain contains many duplicate historical implementations. Removing them wholesale is unsafe because later modules intentionally capture or replace earlier globals. No large legacy block was deleted without a full call-graph and server package.
- Excel and icon libraries remain CDN dependencies. Core operation is local, but first-time offline Excel export and icon loading still depend on those cached browser resources.
- Popup permission is still required because browser printing is the existing PDF architecture.

## C. Print/PDF diagnosis

The clipping/split-document problem was caused by several issues acting together:

- printing started on a fixed timer instead of waiting for fonts and both logos;
- legacy archived HTML kept outdated CSS;
- tables used intrinsic `table-layout:auto`, so long Arabic/client/order text could widen the sheet beyond A4 landscape;
- flex/grid children lacked `min-width:0`;
- auto-print script was injected outside the document body;
- totals and long sections lacked complete page-break protection.

The final document path now injects one repair layer into both new and archived documents, constrains the sheet and tables to printable width, uses fixed table layout with safe wrapping, repeats table headers, protects rows/totals from awkward splits, removes conflicting footer snapshots, waits for fonts/images (with a bounded fallback), then prints after two animation frames.

The visible document styling, colors, typography, logos, A4 landscape size, and on-screen application design were preserved.

## D. Changed files

- `index.html`: new cache token only; existing numeric constraints were preserved.
- `assets/css/styles.css`: responsive min-width fix for financial statistic cards.
- `assets/js/01-core-base.js`: version metadata and service-worker update URL.
- `assets/js/03-boot-calc-print.js`: consistent two-decimal monetary calculations.
- `assets/js/04-sync-import.js`: reduced idle cloud polling and updated version metadata.
- `assets/js/05-feature-patches.js`: release/cache metadata only.
- `assets/js/06-data-protection-images-backup.js`: release/cache metadata only.
- `assets/js/07-clients-final.js`: release/cache metadata only.
- `assets/js/08-post49-final-modules.js`: final print repair, archived-document upgrade, safe filenames, and duplicate/negative submission guard.
- `sw.js`: same-origin-only caching, navigation network-first fallback, and smaller precache.
- `manifest.webmanifest`: final release token.
- Documentation files: updated for V57.5 and this audit.

Compatibility: no database schema, storage key, public CRUD function, Apps Script URL, document record structure, or deployment path was changed. No migration is required.

## E. Final code

All changes are applied directly to this project. The project still contains exactly eight production JavaScript bundles and remains deployable as a static GitHub Pages/PWA package.

## F. Testing summary

Passed:

- syntax validation for all eight JavaScript bundles and `sw.js`;
- manifest JSON parsing;
- eight-script ordering, local asset existence, and unique static HTML IDs;
- central calculation tests for final quantity fallback, canonical discounts, costs, expenses, profit, deposits, payments, balances, filtered totals, and decimal rounding;
- desktop report rendering with one active page and no application-level horizontal overflow;
- 390×844 mobile report rendering with no clipped statistic cards or page overflow;
- real archived invoice and factory-statement windows: safe title, two loaded logos, repair CSS, print runtime, fixed table layout, and no sheet/table horizontal overflow;
- an 80-row long-layout stress fixture: fixed-width table, repeated-header semantics, avoid-page rows, and no horizontal overflow;
- empty-state rendering and offline status display observed without console errors from application code.

Manual/live verification still required:

- a real Chrome/Edge “Save as PDF” action from the operating-system print dialog;
- live Google write/read/backup/restore against a non-production test deployment;
- server-side Apps Script locking/batching review after its source is supplied;
- destructive restore and large real-data migration tests on a disposable backup;
- full CRUD acceptance testing on a disposable dataset. Existing browser business data was not modified during this audit.

## G. Additional recommendations

1. Include the deployed Apps Script source and sheet schema in the repository, with secrets/IDs separated into server properties.
2. Add a disposable test deployment and fixture database so CRUD, sync conflicts, backup/restore, and PDF creation can be automated without touching production data.
3. In a later dedicated release, replace the historical override chain with modules behind a compatibility facade. Do not attempt that cleanup together with business changes.
4. Self-host or precache the exact icon/Excel dependencies if first-load offline export is a firm requirement.
