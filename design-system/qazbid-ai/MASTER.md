# QazBid AI — approved interface direction

Approved in chat: 15 October 2026. Scope: existing web application, all routes.

Purpose: help Kazakhstan procurement specialists assess document evidence,
catalog compatibility, profit and risk before participating in a tender.

## Visual system

- Light workspace: cool neutral background, white navigation and surfaces,
  graphite text, blue primary actions. Dark theme uses equivalent semantic tokens.
- Primary `#254EDB`, on-primary `#FFFFFF`; text `#17253B`; muted `#53647A`;
  background `#F5F7FB`; panel `#FFFFFF`; border `#DCE3EE`.
- Keep the bundled Noto Sans font for Russian and Kazakh coverage and offline use.
  Body text 14px; supporting text at least 12px, compact labels at least 11px.
  Headings 30/20/16px; tabular numbers in financial values.
- Use 4/8px spacing increments, 12–16px panel radii, restrained shadows.
- Keep Lucide vector icons consistent. Hide decorative icons from assistive tech.
- Hover and focus use colors/borders rather than changes to layout or position.
  Respect reduced motion; keyboard focus must remain visible.

## Screen hierarchy

- Navigation: prominent New Analysis action, clear selected location, simpler
  workspace identity and quieter help/status area. Provide a skip-to-content link.
- Dashboard: heading/action, separated metric cards, recent analyses, risk context.
- Analysis: evidence-based decision, financial metrics, compatibility and purchase
  plan, then next actions. Secondary detail stays in the existing tabs.
- Discovery: honest source notice; grouped filters, visible result count and a
  reset action; readable budgets and row actions.
- Upload/review: clear steps, document drop zones, labels and source evidence.
- Catalog, reports and demo: same surfaces, typography and action hierarchy.
- Landing: same blue/neutral language, clearer type and a straight product preview.

## Responsive and verification

- Desktop: fixed sidebar, bounded main content, spacious page headings.
- Small screens: existing menu drawer, stacked actions/forms, locally scrollable
  tables/tabs; never hide financial content or leak horizontal page overflow.
- Verify 375px, 768px, 1440px, both themes, RU/KK, reduced motion and zoom.
- Run existing workflow tests, new discovery reset regression, typecheck and build.

## Application of ui-ux-pro-max guidance

The verified Data-Dense Dashboard style fits the analytical workspace. Generated
marketing gateway and glassmorphism suggestions do not fit and are not adopted.
Existing FastAPI requests and React Query remain the data layer; generic stack
suggestions to migrate forms to Server Actions are unrelated to this visual work.
