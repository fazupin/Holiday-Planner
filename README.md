# Wanderly 🌴

A group trip planner that runs in your browser. Friends suggest places on a map of Singapore, see what there is to do at each one, and vote on where to go.

## Features

- Map of Singapore with a pin for every suggested place
- Tap a pin to see things to do there, then vote **Yes** or **No**
- Ranked list that puts the most-wanted places at the top, updated live
- Group chat: paste a Google Maps link, coordinates or a place name to suggest somewhere
- Projects: one per trip or group, each with its own map, votes and chat. Invite friends with a link, and anyone in the project can rename it.
- Sign in with Google. No other account needed.

## Getting started

The app needs a free Firebase project for sign-in, shared data and hosting. Follow [SETUP.md](SETUP.md) step by step (about 15 minutes).

Once it's set up, send your friends the link: `https://wander-ly-50ea5.firebaseapp.com` (use the invite link from a project's **Project** tab)

## Adding places

| What you paste in the chat | What happens |
|---|---|
| Coordinates, like `1.28473, 103.83251` | Pin goes on the exact spot |
| A full Google Maps link (from a computer browser) | Pin goes on the exact spot |
| A place name, like `Tiong Bahru Bakery` | Searches OpenStreetMap and lets you pick the right match |
| A short link (`maps.app.goo.gl/...`) | Can't be opened, so the app asks for the name or coordinates instead |

To get exact coordinates on a phone: in the Google Maps app, press and hold on the place, then copy the numbers shown at the top.

## Project structure

```
├── index.html
├── privacy.html            Privacy Policy
├── terms.html              Terms of Use
├── css/style.css
├── js/app.js               app code
├── js/firebase-config.js   your Firebase project settings
├── firestore.rules         database security rules
├── SETUP.md                setup guide
├── assets/                 (icons, images, screenshots)
├── README.md
├── LICENSE
└── .gitignore
```

## Built with

- HTML, CSS and JavaScript (no build step)
- [Leaflet](https://leafletjs.com) with an [OpenFreeMap](https://openfreemap.org) street map, and a hand-drawn Singapore as a backup (no API keys)
- [OpenStreetMap](https://www.openstreetmap.org) data for place search, MRT/LRT stations and bus stops
- [Firebase](https://firebase.google.com) for Google sign-in and the shared database

## License

[MIT](LICENSE)
