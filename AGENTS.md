# Modern Reading development rules

This is an independent Chrome Manifest V3 extension. Do not introduce Oskar Lab workspace imports, React, Next.js, a server or runtime network dependencies.

- Domain rules live in src/model.ts, DOM processing in src/reader.ts and Chrome integration in its own modules.
- Keep English/German copy in src/modern-reading.mjs and its type declaration.
- Preserve page content, local settings, restoration and keyboard accessibility.
- Never upload page text, introduce tracking or remote executable code. Minimize permissions and validate persisted values and messages.
- Assess privacy, security and third-party rights for every change. Keep disclosures factual; no legal or reading-performance guarantees.
- Use English code/comments and concise JSDoc for public APIs. Preserve unrelated changes.
- Run npm run check and npm run test:browser for behavioral changes. Build with npm run build, package with npm run package. Load dist as an unpacked extension.
- Commit completed work with an imperative English title and short validation notes. Do not commit secrets, generated output or browser profiles.