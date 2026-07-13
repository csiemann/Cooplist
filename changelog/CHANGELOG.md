# CHANGELOG

## v2.1.3 - 2026-07-13

- Frontend: add Socket.IO client to receive `song_added`, `song_removed`, and `song_updated` events and update the UI in realtime.
- Frontend: join playlist rooms on view open so users see immediate queue updates.
- Backend: auto-join users to playlist when they add a song (prevents permission 403 for moderators who weren't explicit members).
- Backend: ensure `position_in_queue` is set on song insert.
- Backend: prevent moderators from removing admins.
- Repo: moved documentation files into `changelog/` for organization.

## v2.1.2

- Previous release notes (see files moved into `changelog/`)
