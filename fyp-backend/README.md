# FYP Backend Setup

This folder contains the FastAPI backend for the Smart Attendance System.

## What is in this folder

- `.venv/` - local Python virtual environment created by `setup_backend.bat`
- `.cache/` - backend-local cache/config so installs stay inside this project
- `.env.example` - template for required backend secrets/config
- `requirements.txt` - Python dependencies
- `setup_backend.bat` - creates/reuses `.venv` and installs requirements
- `run_backend.bat` - starts the FastAPI server in reload mode by default
- `stop_backend.bat` - force-stops anything still holding backend port 8003
- `launch_backend.py` - helper that keeps backend shutdown clean on Windows

## Requirements

Before running the backend, install:

- Windows
- Python 3.11

## First-time setup

From this `fyp-backend` folder:

```bat
copy .env.example .env
setup_backend.bat
```

The setup script now pauses before closing so double-click users can read the
final status message.

Then open `.env` and fill in the real values for:

- `DATABASE_URL`
- `GEMINI_API_KEY`
- `JWT_SECRET_KEY`

Do not skip this. The backend will not start correctly without them.

## Run the backend

From this `fyp-backend` folder:

```bat
run_backend.bat
```

If the backend stops with an error, the script now keeps the final message
visible instead of closing immediately.

The API starts on:

```txt
http://127.0.0.1:8003
```

Basic health check:

```txt
http://127.0.0.1:8003/
```

`run_backend.bat` now starts in reload mode by default, so when you edit
backend Python files and save, the backend restarts automatically.

If you want to run without reload:

```bat
run_backend.bat --no-reload
```

## If you are starting from the project root

Open terminal in `fyp-main`, then enter the backend folder first:

```bat
cd fyp-backend
setup_backend.bat
run_backend.bat
```

## Stop the backend

If `8003` gets stuck or you want to close the backend forcefully:

```bat
stop_backend.bat
```

This kills the whole process tree that is listening on port `8003`.

## Optional no-pause mode

If you run the scripts from an existing terminal and do not want the final
pause screen:

```bat
setup_backend.bat --no-pause
run_backend.bat --no-pause
run_backend.bat --no-reload --no-pause
stop_backend.bat --no-pause
```

## Portable project behavior

This backend is set up to keep its Python-related files inside the project:

- packages go into `fyp-backend\.venv`
- cache/config go into `fyp-backend\.cache`

That means setup does not need to scatter backend cache files around your PC.

## Sharing with another person

If you send this project to someone else, they should:

1. Install Python 3.11
2. Open this `fyp-backend` folder
3. Copy `.env.example` to `.env`
4. Fill in the real `.env` values
5. Run `setup_backend.bat`
6. Run `run_backend.bat`

Important:

- do not rely on copying `.venv` from one PC to another
- let each machine create its own `.venv`
- the `.env` values must be valid for the target machine/project

## Troubleshooting

If `setup_backend.bat` fails:

- make sure Python 3.11 is installed
- make sure `python` or `py -3.11` works in terminal

If `run_backend.bat` fails:

- make sure `.env` exists
- make sure `DATABASE_URL` is valid
- make sure `GEMINI_API_KEY` is set
- make sure `JWT_SECRET_KEY` is set

If the backend closes but port `8003` still stays busy:

```bat
stop_backend.bat
```

If dependencies seem broken:

```bat
setup_backend.bat
```

That will reuse the local `.venv` and reinstall from `requirements.txt`.
