# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Durable Product Direction

- Keep both existing design themes and the Capproje-specific, project/mahal/work-item-centered information architecture.
- Use Odoo-inspired interaction patterns where useful: stage/status rails, linked-record counters, approval gates, revision traceability, activity history, multiple record views, live project profitability, BOM/work-order structure, subcontracting traceability, field worksheets, and role-based controls.
- Do not turn the product into a generic ERP interface. Keep screens simple, mobile-friendly, and tailored to custom woodwork projects.
- Treat the prototype as the future interface of a reusable vertical product, not a Capproje-only codebase. Keep company-specific terminology, fields, roles, approval rules, and document templates configurable.
- Prioritize measurable industry value: faster and safer estimating, revision-to-production control, forecast-at-completion profitability, outsourced-process traceability, simple offline shop-floor use, progressive billing, and installation closeout.
- Do not design full generic accounting, HR, e-commerce, CAD/CAM, 3D modeling, or CNC generation into the initial product. Prefer integrations for official accounting and design-to-manufacturing tools.
- Design 2 is the selected direction. Keep project finance separate from company-wide pre-accounting; include practical pre-accounting and HR screens without attempting to replace official accounting or payroll software.
- Production user authentication is phone-number SMS OTP; do not add Google sign-in unless the user changes this decision. Keep development-only identity headers disabled in production.
- The preview environment temporarily uses Turso through the database adapter; the final target is the user's Hetzner Ubuntu server, so business code must remain database-provider neutral and Turso secrets must never enter Git.
- Keep AI inside real workflows and require a measurable time saving, error reduction, or margin protection outcome; avoid a generic showcase chatbot.
