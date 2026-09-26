# Product sharing poster design

## Goal

Give each published product a trustworthy, cover-like image that creators and visitors can preview, save, and share through familiar phone workflows. This is an alternative to sending a bare product name and URL; it does not promise to repair a crash inside WeChat's iOS share extension.

## User flow

1. On a product page, the user taps **分享海报**.
2. A preview opens without navigating away from the product.
3. The poster shows the product cover, title, short description, First Look identity, and a QR code that opens that exact product page.
4. The user chooses **分享图片** to hand the poster image to the device share sheet, or **保存图片** to save/download the poster. The preview remains available if the share sheet is dismissed or a target app fails.
5. Show a clear success or recovery message; do not claim a photo has been saved until the browser confirms the save/download action.

## Poster layout

- Vertical mobile-first poster, approximately 3:4 portrait ratio.
- Use the first available product image as cover; if none exists, use the product's first media preview when feasible; otherwise use the existing First Look logo artwork.
- Put the product title and a concise, safely truncated description below the cover.
- Keep the existing First Look name/logo; avoid fabricated badges, pricing, or album/record terminology.
- Include a high-contrast QR code and a small “扫码查看产品” cue near the footer.

## Implementation boundaries

- Generate the image on-device from the public product data already used by the detail page; do not upload poster images or add product data to persistent storage.
- Encode the canonical product URL in the QR code. Generate the QR locally rather than sending product URLs to an external QR service.
- Add an explicit poster preview/dialog near the existing product actions. Keep the current non-poster share action separate until poster sharing is verified; do not silently replace it.
- On supported mobile browsers, offer the poster image to the system share sheet as an image file. Offer a separate save action; on iOS, explain if the browser presents a system action sheet or image preview rather than directly writing to Photos. On desktop, download the generated image.
- If image rendering, image loading, QR creation, sharing, or saving fails, keep the preview usable where possible and provide an actionable message. Never imply that sending to WeChat is guaranteed not to crash.

## Acceptance checks

- Poster is a vertical image with the correct product cover, title, truncated description, First Look branding, and a scannable QR code to the matching product page.
- Preview opens and closes on phone and desktop without losing the product page state.
- Save/share controls are visible and produce truthful success/fallback feedback on iOS Safari and desktop browsers.
- Missing cover, long title/description, and image-load failure have sensible fallbacks.
- Existing product actions and unrelated page branding remain unchanged.
