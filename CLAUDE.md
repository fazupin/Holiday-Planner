# Rules for Claude

## Security

- **Stay inside this repo.** Only read, search, or edit files inside this folder (`Holiday-Planner-1`). Never open, list, or search any other folder on this computer, including the home folder, Desktop, Documents, Downloads, or AppData.
- **No email.** Never read, search, or send email, and never use email connectors or tools.
- **No browsers.** Never open a web browser, a URL, or any other app.
- **No web access.** Don't fetch web pages or search the web unless the user asks for it in that message.
- **Ask first.** If a task seems to need anything outside these rules, stop and ask the user instead of working around them.

## Project

Wanderly is a plain HTML/CSS/JS group trip planner with no build step: friends suggest Singapore places, then vote on them. It uses Leaflet + OpenStreetMap for the map and Firebase for Google sign-in and shared data (see `SETUP.md`). Google sign-in doesn't work from `file://`, so run it from GitHub Pages or a local web server (e.g. `python -m http.server 8000`).
