# Product Editing and Version History

## Goal

Let a creator complete or revise every part of a product after its first save while keeping the product's lifecycle meaningful and preserving all earlier published states.

## User experience

- Each product in Creator Center has an edit/complete-content entry.
- The editor is prefilled from the current product state.
- Creators can update title, description, type, status, product URL, tags, story, technical notes, resource links, product images/videos, and technical files.
- Saving creates a new immutable version. The live product page and public creator page show the latest version.
- The product lifecycle lists every version. Opening an older version shows its text, media, links, and attachments as they were at that point.
- Removing a media item or attachment from the current version only removes it from the current product. Historical versions retain access to their referenced objects.

## Data flow and preservation

1. Load the creator-owned product and its current media and technical data.
2. Validate edits and upload any new media/technical files through the existing quota and ownership checks.
3. Snapshot the current state before applying the edit if it has no version history.
4. Update the current product fields and media/technical associations.
5. Create a new version snapshot containing the updated fields and references to the updated media and technical files.
6. The current product view reads the updated product tables; the lifecycle view reads immutable version snapshots.

Historical objects must not be deleted when they are removed from the current product. They continue to count toward storage usage unless a future, explicit history-retention feature is introduced.

## Access and validation

- Only the authenticated owner may read or edit a product through the editor endpoints.
- Existing public visibility and contact-email settings are preserved.
- Existing upload limits, MIME/type allowlists, same-origin validation, and storage quota checks apply to new files.
- A failed edit must not publish a partial version. Newly uploaded objects that are not committed to a version should be cleaned up or remain subject to the existing expiry cleanup.

## Scope

This feature adds post-publication completion/editing and version snapshots. It does not add collaborative editing, rollback to an old version, or deletion of historical versions.

## Acceptance criteria

- A creator can open any owned saved product and edit all supported product fields.
- A creator can add and remove current product media and technical attachments.
- Existing versions remain readable after edits, including their original media and attachments.
- The latest edit is reflected on the live product page and public creator profile.
- Unauthorized users cannot use the editor endpoints to read or change product data.
- Product history records a version for each successful save and no version for a failed save.
