# First-publish experience design

## Goal

Reduce uncertainty and avoidable frustration for a creator publishing their first work, especially on a phone, without adding a full onboarding flow or changing publication rules.

## Scope

- Add a brief, friendly note near the form introduction: creators may publish an early version and improve it later; publishing does not need to wait for perfection.
- Warn before navigating away when the form has meaningful unsaved input. Do not warn after a successful submission or when there is nothing entered.
- Replace the current silent redirect to the homepage after success with a clear success state and two next steps: view the published work and return to discovery. Use the returned creation slug for the view link. For private works, label the action as viewing the creator's own work and route to the account product page if no private detail route exists.
- Check the form at a narrow mobile viewport; make only targeted changes if controls or actions are difficult to use. Keep touch targets usable and preserve the existing responsive layout.

## Out of scope

- Server-side drafts, autosaving form contents, or persisting uploaded files between visits.
- New onboarding screens, changes to required fields, visibility defaults, upload limits, or product moderation.
- Synthetic views, likes, favorites, shares, or other engagement manipulation.

## Behavior and failure handling

- The leave warning applies only while the user has entered data and is not submitting. Browser-native confirmation is acceptable.
- Keep current validation and upload behavior. If submission or upload fails, remain on the form, show the existing error, and allow correction/retry.
- A successful response must identify the created work sufficiently to render the correct next-step link. Do not show success until media/technical uploads have completed.

## Verification

- Test empty form navigation (no warning), populated form navigation (warning), and submission in progress (no duplicate leave warning).
- Test successful public and private submissions and verify the correct next action.
- Run the project's lint/type/build checks available in the environment.
- Inspect the form at a narrow mobile viewport for horizontal overflow and reachable upload/submit controls.
