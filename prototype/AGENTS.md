# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Durable Product Direction

- Keep both existing design themes and the Capproje-specific, project/mahal/work-item-centered information architecture.
- Use Odoo-inspired interaction patterns where useful: stage/status rails, linked-record counters, approval gates, revision traceability, activity history, multiple record views, live project profitability, BOM/work-order structure, subcontracting traceability, field worksheets, and role-based controls.
- Do not turn the product into a generic ERP interface. Keep screens simple, mobile-friendly, and tailored to custom woodwork projects.
