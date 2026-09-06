# Vendored libraries

Every third-party script the apps use lives here, so the repo works with no
network access and no CDN. Apps reference these files relatively
(`../../libs/<name>-<version>/<file>`), which works from `file://` and from any
static host.

| Folder | Source (npm) | File(s) | License | Used by |
|---|---|---|---|---|
| `pdfjs-3.11.174` | `pdfjs-dist@3.11.174` | `pdf.min.js`, `pdf.worker.min.js` | Apache-2.0 | pdf-extract, pdf-page-numbers, pdf-redact, pdf-remove, pdf-reorder, pdf-rotate, pdf-text-extract, pdf-to-images, pdf-watermark, signature-studio |
| `pdf-lib-1.17.1` | `pdf-lib@1.17.1` | `pdf-lib.min.js` | MIT | pdf-extract, pdf-merge, pdf-page-numbers, pdf-redact, pdf-remove, pdf-reorder, pdf-rotate, pdf-split, pdf-watermark |
| `jspdf-2.5.1` | `jspdf@2.5.1` | `jspdf.umd.min.js` | MIT | blueprint-annotation-tool, signature-studio, walkthrough-creator |
| `d3-7.9.0` | `d3@7.9.0` | `d3.min.js` | ISC | 3d-globe-visualizer |
| `topojson-client-3.1.0` | `topojson-client@3.1.0` | `topojson-client.min.js` | ISC | 3d-globe-visualizer |
| `three-0.128.0` | `three@0.128.0` (r128) | `three.min.js` | MIT | 3d-room-planner |
| `matter-js-0.19.0` | `matter-js@0.19.0` | `matter.min.js` | MIT | physics-sandbox |
| `jszip-3.10.1` | `jszip@3.10.1` | `jszip.min.js` | MIT or GPL-3.0-or-later | favicon-generator |
| `html2pdf.js-0.10.1` | `html2pdf.js@0.10.1` | `html2pdf.bundle.min.js` | MIT | invoice-generator |
| `qrcode-generator-1.4.4` | `qrcode-generator@1.4.4` | `qrcode.js` | MIT | qr-code-studio |
| `jsqr-1.4.0` | `jsqr@1.4.0` | `jsQR.js` | Apache-2.0 | qr-code-studio |
| `papaparse-5.4.1` | `papaparse@5.4.1` | `papaparse.min.js` | MIT | data-explorer |

Each folder carries the package's own `LICENSE` file where the package ships
one (`qrcode-generator` does not; its license is declared in its `package.json`
and noted in `libs/qrcode-generator-1.4.4/LICENSE`). Files are copied
unmodified from the npm tarball (`npm pack <name>@<version>`), so a checksum
against the registry tarball verifies them. `qrcode.js` and `jsQR.js` are the
packages' unminified builds; the CDN URLs they replace were jsdelivr's
on-the-fly minification of the same files.

## Adding or upgrading a library

1. `npm pack <name>@<version>` and copy the browser build (UMD/IIFE, not ESM)
   plus its LICENSE into a new `libs/<name>-<version>/` folder.
2. Reference it from the app as `../../libs/<name>-<version>/<file>`.
3. Add a row to the table above.
4. Remove the old version's folder once nothing references it.

`node check-syntax.js` fails if any app still loads a script from a URL.

## What is still external

`font-pairing-preview` and `font-specimen-generator` fetch fonts from Google
Fonts at runtime; previewing arbitrary Google fonts is their purpose, so that
data dependency is intentional. No code is loaded from outside the repo.
