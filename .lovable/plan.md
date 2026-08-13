Swap logo word colors in header and footer

Update the wordmark in both `SiteHeader` and `SiteFooter` in `src/routes/__root.tsx` so that:
- "The" is rendered in black (`text-black`)
- "Progressor" is rendered in white (`text-white`)

This reverses the current styling where "Progressor" is black and "The" inherits the light foreground color against the blue navbar/footer background.

No other files or logic need to change.