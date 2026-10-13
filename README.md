# DFY Funnel sales page - weekly webinar series

One sales page per weekly webinar, all built from a single template.

Live at `https://offers.whitneybateson.com/funnel/<event>/`, for example
`https://offers.whitneybateson.com/funnel/oct-14/`. The bare `/funnel/` link
forwards to whichever event's offer is still open.

## Files

| File | What it is |
|---|---|
| `template.html` | The sales page. Edit copy, design and images here. Changes apply to every event. |
| `events.json` | One entry per webinar: dates, checkout link, replay video. |
| `build.js` | Turns the two files above into the pages. |
| `oct-14/index.html`, `index.html` | Generated. Do not edit these by hand. |

## Add next week's page

1. Open `events.json` and add an entry after the last one (mind the comma between entries):

   ```json
   "oct-21": {
     "webinar": "2026-10-21",
     "cartClose": "2026-10-26 23:59",
     "checkoutUrl": "https://whitneybateson.thrivecart.com/done-for-you-funnel/?coupon=SAVE400",
     "replayVideoId": ""
   }
   ```

   - The entry name (`oct-21`) becomes the page address.
   - `cartClose` is Eastern time, written `YYYY-MM-DD HH:MM` on a 24-hour clock. Daylight saving is handled for you.
   - Leave `replayVideoId` empty to hide the replay banner.

2. Commit to `main`. The deploy builds the page and puts it live.

## After the deadline

The page switches itself in the visitor's browser the moment `cartClose` passes. No redeploy needed.

- Price goes to $1,997 everywhere (pricing box, FAQ, closing section, comparison).
- The bonus section, the bonus lines in the pricing box, and the "special pricing ends" lines disappear.
- The buy button goes to checkout **without** the coupon: `checkoutUrl` with `?coupon=` stripped, or `fullCheckoutUrl` if you set one on the event.
- The top bar reads "This offer ended … Want the $400 off and the bonuses? Join the next free training," linking to `nextTrainingUrl` at the top of `events.json`.

In `template.html`, anything with `class="sale-only"` shows before the deadline and `class="full-only"` after.

## After the webinar: show the replay

Put the YouTube video ID in that event's `replayVideoId` (the part after `v=` in the video link) and commit.

## Previewing on Vercel or locally

Run `node build.js` and commit the generated files too, so the preview matches. The live site does not need this step; the deploy runs it.
