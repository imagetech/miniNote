# GN Studio

A graphic-narrative development application based on MiniNote v1.0.0 and its freeform creative-board foundation.

Development for GN Studio takes place on the `gn-studio` branch. MiniNote remains preserved independently on `main`, with its version 1.0 baseline tagged as `v1.0.0`.

## Included in milestone 1

- Infinite-feeling dotted canvas
- Pan with `Space` + drag or the middle mouse button
- Zoom with the mouse wheel or on-screen controls
- Create text notes with the toolbar or by double-clicking the canvas
- Drag, edit, select, and delete notes
- Automatic persistence in browser `localStorage`
- Image cards from drag-and-drop, clipboard paste, or the image picker
- Image blobs stored separately in IndexedDB
- Full-resolution image lightbox on double-click
- Project workspace with preset Characters, Settings, Shots, and Storyboard boards
- Board navigation with breadcrumbs and board-specific content
- Drag notes and images onto a project board card to move them into that board
- Save and load portable `.mininote.json` project bundles, including original images
- Start a clean project with confirmation and freshly recreated preset boards
- Compact Projects and Add menus, including current-board clearing
- Boards menu for direct navigation between preset reference boards
- Arbitrarily nested boards created from Add → Board
- Configurable image-card previews (Small, Medium, or Large) from the Settings menu
- Global app settings embedded in saved and autosaved project JSON files
- Editable board title and responsive layout

## Run locally

This milestone has no package dependencies. Serve the directory with any static web server, for example:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Installable app and GitHub Pages

GN Studio includes a web app manifest and service worker. When served over HTTPS it can be installed as a Progressive Web App and continues to load offline. Project data remains local to each browser; use Projects → Save and Load to transfer it.

The workflow in `.github/workflows/pages.yml` publishes the static application on every push to `main`. In the repository, select **Settings → Pages → Build and deployment → Source: GitHub Actions** once to enable it.

## Local project folder

In supported Chromium browsers, **Projects → Set Storage Folder** selects a directory for automatic disk backups. GN Studio retains the directory handle in IndexedDB and writes a self-contained `<project>.mininote.json` file after changes. The browser may require permission to be renewed after a restart. Firefox and Safari do not currently expose the required directory-access API; manual Save and Load remain available there.

## Suggested next milestone

Add AI-focused reference fields and richer content cards for each preset board.
