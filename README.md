# Web Notepad

A lightweight, browser-based text editor backed by a small Flask API. It looks
and feels like a classic desktop notepad — menu bar, line numbers, keyboard
shortcuts, modal Open/Save dialogs — but your files are saved server-side to a
storage directory instead of your local machine, so they persist across sessions
and devices that reach the same server.

> **Scope:** This is a **single-user** editor. It is not a real-time collaborative
> tool — there is no multi-user syncing or conflict resolution. (An earlier version
> of this repo was named "Collaborative Notepad"; it has been renamed to describe
> what it actually does.)

<!-- Add a screenshot or GIF here for a stronger portfolio impression:
     ![Web Notepad](docs/screenshot.png) -->

## Features

- **Notepad-style UI** — File/Edit menu bar, live line numbers, tab-to-indent.
- **Server-side file storage** — create, open, edit, duplicate, and delete text
  files that live in a configurable storage directory.
- **Nested paths** — organize notes in subdirectories (e.g. `notes/todo.txt`).
- **Safe filenames** — path input is sanitized to prevent directory traversal
  outside the storage root.
- **Duplicate handling** — saving over an existing name prompts to overwrite or
  auto-create a numbered duplicate (`file_1.txt`, `file_2.txt`, …).
- **Keyboard shortcuts** — `Ctrl/Cmd+S` save, `Ctrl/Cmd+O` open, `Ctrl/Cmd+N` new.

## How it works

The Flask backend (`app.py`) exposes a small JSON REST API and serves a single-page
front end (`templates/index.html` + `static/`). All file operations go through a
`sanitize_path` / `get_file_path` pair that resolves every request inside the
storage root and rejects anything that would escape it.

| Method   | Endpoint                   | Purpose                                  |
| -------- | -------------------------- | ---------------------------------------- |
| `GET`    | `/`                        | Serve the editor UI                      |
| `GET`    | `/api/files`               | List all stored files                    |
| `GET`    | `/api/files/<path>`        | Read a file's contents                   |
| `POST`   | `/api/files`               | Create a new file (`409` if it exists)   |
| `PUT`    | `/api/files/<path>`        | Update an existing file                  |
| `DELETE` | `/api/files/<path>`        | Delete a file (and prune empty dirs)     |
| `POST`   | `/api/files/duplicate`     | Copy a file to an auto-numbered name     |

## Requirements

- **Python 3.9+** (developed and verified on Python 3.14)
- Python packages in `requirements.txt`: Flask, python-dotenv

No database or native system libraries required — files are stored as plain text
on disk.

## Setup

```bash
# 1. Clone and enter the project
git clone <your-repo-url>
cd collaborative-notepad

# 2. Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. (Optional) configure via environment
cp .env.example .env             # then edit if you want non-default paths/ports
```

## Running

```bash
python app.py
```

Then open <http://localhost:5000> in your browser. Notes are written to the
`storage/` directory (created automatically) by default.

### Configuration

All settings are optional and read from the environment (or a `.env` file):

| Variable       | Default     | Description                                    |
| -------------- | ----------- | ---------------------------------------------- |
| `STORAGE_PATH` | `./storage` | Directory where notes are saved                |
| `FLASK_HOST`   | `0.0.0.0`   | Interface to bind (use `127.0.0.1` for local)  |
| `FLASK_PORT`   | `5000`      | Port to listen on                              |

## Usage & controls

- **File → New / Open / Save**, or the equivalent `Ctrl/Cmd + N / O / S` shortcuts.
- **Edit → Cut / Copy / Paste / Undo / Redo.** Clipboard actions use the browser's
  Clipboard API and require a secure context (`localhost` or HTTPS); if the browser
  blocks clipboard access, use the native `Ctrl/Cmd + X / C / V` shortcuts instead.
- **Open** lists existing files; click one (or type a name) and confirm.
- **Save** prompts for a name when the document is untitled; saving over an existing
  file offers **Overwrite** or **Create Duplicate**.

## Notes & caveats

- This uses Flask's built-in development server. For real deployment, run it behind
  a production WSGI server (e.g. gunicorn) and set `FLASK_HOST=127.0.0.1` or a proper
  reverse proxy.
- There is no authentication — anyone who can reach the server can read and write
  files in the storage directory. Intended for local/personal use as-is.

## License

No license file is currently included. Add one (e.g. MIT) if you intend others to
reuse this code.
