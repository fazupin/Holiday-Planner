# Changelog

A record of how Wanderly was built, one iteration at a time. The newest changes are at the top. Commit hashes link each change to the git history.

## 27 September 2026

### Place search
- **Nearest MRT comes from the pin.** New places get a separate "Nearest MRT" field, filled with the closest station and its distance, e.g. "Stadium MRT (~350 m)". It follows the pin when dragged. Before, the neighbourhood name (e.g. "Kallang") appeared where people expected a station.
  - Older places show their nearest MRT the same way.
- **Everything at an address.** Searching an address or postal code also lists the other named places there, such as the mall itself and the shops inside it.

### Voting controls
- **Time limits are set per place**, instead of one limit for the whole project.
  - Choose one when adding a place ("Vote within 2 hours"), or leave it with no limit.
  - Anyone can set, change or clear a place's limit while its voting is open. It counts from that moment.
  - Reopening voting asks how long the new round should last.
- **Rename a place.** Anyone in the project can rename it, and a matching itinerary stop is renamed too.
- **End voting now.** Voting on a place can be ended early.
  - If Yes is ahead of No, the place goes into the itinerary automatically.
  - Otherwise it's greyed out, and taken out of the itinerary if it was in.
- **Confirm anyway.** A place can go into the itinerary without enough votes.
- **Remove from itinerary.** A place can be taken out even if it was voted Yes.
- **Voting time limit.** Set per project, from 30 minutes to 3 days.
  - Each new place counts down, for example "⏱ 1 h 20 min left to vote".
  - When time runs out, the votes cast so far decide the result.
  - If nobody voted, the place goes grey.
- **Reopen voting.** A new round where everyone votes again.
  - Earlier results stay visible, for example "First vote: not going · 0 Yes, 1 No".
  - Earlier votes are kept separately, not overwritten.

### Itinerary
- **Confirm voted places into the itinerary** (`06c55df`)
  - Once more than half the group votes Yes on a place, and Yes is ahead of No, a **Confirm location** button appears.
  - Confirming adds the place to the itinerary, meeting at the nearest MRT, and posts a notice in the chat.
- **Trip dates** (`06c55df`): each project has a first and last day. One-day trips fix every stop's date.
- **Public transport comes first** (`06c55df`): car or motorbike is an optional tick box.
- **Don't leave a project when only part of it fails to load** (`c03ab96`), for example while the security rules are out of date.
- **Itinerary tab** (`69b057c`)
  - Stops are grouped by day, each with a time, a place and meeting points.
  - A shared reservations checklist shows who ticked each item.

### Hosting and phones
- **Invite links always use the Firebase Hosting address** (`2d3fbc6`).
- **Publish to Firebase Hosting** (`34f1092`)
  - This fixes Google sign-in on phones ("Unable to save initial state").
  - A GitHub Action deploys on every push.
  - People inside in-app browsers (Instagram, Facebook, TikTok…) are warned to open the page in Safari or Chrome.
- **Mobile layout** (`93c1b28`)
  - 16px text boxes, so iPhones don't zoom in.
  - Finger-sized buttons, a stacked header, and panels that fit a phone screen.
  - An app icon and web manifest for adding Wanderly to a home screen.

### Account, privacy and settings
- **Profile panel** from the name chip (`6b5fbdb`): Sign out, Delete my account, Terms and Privacy.
- **Settings panel** behind a gear button (`ead2c3b`)
  - Theme, map style, and MRT lines, station names and bus stops on or off.
  - Place labels, and whether Enter sends a chat message.
  - Clear saved map data, or reset all settings.
- **Age check before sign-in** (`d4ed339`): 13 and over, and under-18s need a parent's or guardian's permission.
- **Privacy Policy, Terms of Use, account deletion and moderation** (`03792f0`)
  - Delete my account.
  - Leave or delete a project.
  - Report and remove chat messages.
  - 12-month expiry dates on saved data.
  - Optional App Check support.

### Projects
- **"← All projects" button** in the header (`21045d5`).
- **Start page** after sign-in (`c3c01f5`), later shown as one card (`c1a9956`) with a pink title (`50b5a03`) and the Wanderly logo (`ca8ae3f`).
- **Project menu** styled to match the app (`f7dfc18`).
- **Projects** (`13aa549`)
  - One per trip or group, each with its own places, votes and chat.
  - Invite links, rename with a chat notice, and member photos.

### MRT map
- **Hide unopened lines** (Jurong Region Line, Cross Island Line) and **add the Bukit Panjang LRT** (`e3accc3`).
- **Map popups** styled like the app, and no outline around a station when clicked (`7af3bd6`).
- **Station names** only when zoomed right in (`c1e9147`).
- **Double-click a station** to zoom in on it (`38e385f`).
- **Map key** (`1a4028f`, `a55ad94`).
- **One MRT style on both maps**, and a clearer bus stop icon (`93058a7`).
- **Lines meet exactly at interchanges**, and station dots are easier to hover (`7c56c97`).
- **Each MRT line drawn once** (`41ea7cb`), as **faint dotted lines** (`abe1755`).
- **MRT and LRT lines on the simple map** (`b8f612e`).

### Map styles
- **Simple / Detailed switch** (`8bf6591`), with Simple as the default (`d8da4e0`).
- **Street map, MRT stations and bus stops** (`3dfc848`), using OpenFreeMap and OpenStreetMap data.

### Places and voting
- **Grey out places that are voted out**: more No than Yes (`6edbfc5`).
- **Anyone on the trip can delete any place** (`1634831`, replacing organiser-only deletion in `c8c1176`).

### Housekeeping
- **Private `inbox/` folder** for sharing files, never pushed (`539c7df`).

## 26 September 2026

### Map
- **Version tags on CSS and JS links**, so browsers load updates (`32bce9a`).
- **Hand-drawn Singapore map** (`6e5b2e7`), after CARTO map tiles started requiring an API key (`3fbb134`).

### First version
- **Connected to Firebase** (`1f8acc4`).
- **Singapore trip voting app with Google sign-in** (`d1fcd01`)
  - A shared map of places, Yes/No voting, a ranked list and a group chat for suggesting places.
  - Security rules and a setup guide.
- **Project files, licence and config** (`63efe60`).
- **README and initial commit** (`4f4a0fc`, `cc3c1b2`).
