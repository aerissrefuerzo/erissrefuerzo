# Resume Builder

A customizable resume builder that government agencies can adopt with no server, database or build step.

![Screenshot](docs/screenshot.png)

## Features

- **Profiles:** start from a preset layout (fresh graduate, experienced professional, government applicant, career shifter).
- **Editable sections:** add, remove, rename, reorder, hide and show any section, including custom sections.
- **Live preview:** A4 layout that updates as you type.
- **Print / PDF:** uses the browser's print dialog ("Save as PDF").
- **Save / open:** export the resume as a `.json` file and reopen it later on any device.
- **Privacy:** all data stays in the user's browser (autosaved to local storage). Nothing is uploaded.

## Run it

Open `index.html` in a browser. That's it.

To host it, copy the four files (`index.html`, `styles.css`, `app.js`, `config.js`) to any static web host (agency web server, GitHub Pages, intranet).

## Adopt it for your agency

Edit `config.js` only:

| Setting | What it controls |
|---|---|
| `agency` | Name, tagline, brand color, privacy note |
| `personalFields` | Identity and contact fields collected |
| `sectionTypes` | Section building blocks and their fields |
| `profiles` | Preset layouts per user type |

## Project structure

```
index.html   Page layout
styles.css   Editor and resume styling, print rules
app.js       Editor logic, preview rendering, save/load
config.js    Agency configuration (the file adopters edit)
```

## Known limitations

- Not a replacement for the CSC Personal Data Sheet (CS Form 212), which has a fixed official format.
- Local storage autosave is per browser. On shared or kiosk computers, users should click **Clear my data** when done.
- Single resume template (layout style). Additional templates are on the roadmap.
