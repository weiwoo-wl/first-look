# Overseas Products Refresh Design

## Goal

Make newly curated overseas independent products immediately visible in the existing “海外新作” carousel, so visitors can notice that the catalog has been updated.

## Scope

- Add the approved products Snapkin, VibeView, and PostSider to the existing external-products data.
- Place this newly curated batch before the previously listed overseas products.
- Preserve the existing card layout, external links, source links, category behavior, and all ranking/sorting behavior in other tabs.
- Do not alter the order of the older overseas products or change how “海外新作” is otherwise populated.

## Data and presentation

Use the current external product record shape: unique slug, title, concise Chinese description, category, external-work status, official product URL, and a source URL identifying the maker or launch context. Keep the new records together as a top batch so future refreshes can be prepended consistently.

The carousel already renders the leading list items first. No new UI, date field, sorting algorithm, database migration, or interaction is needed.

## Verification

- Confirm the three slugs are unique and appear before the older catalog entries.
- Run the project build to catch type or syntax errors.
- Confirm no ranking or filtering logic changed.

## Out of scope

Changing the products’ card artwork, adding a “new” badge, changing refresh cadence, modifying the other discovery tabs, or publishing/deploying the change.
