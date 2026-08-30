# MiniNote

The first increment of a visual notes application inspired by freeform creative boards.

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
- Editable board title and responsive layout

## Run locally

This milestone has no package dependencies. Serve the directory with any static web server, for example:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Suggested next milestone

Add AI-focused reference fields and richer content cards for each preset board.
