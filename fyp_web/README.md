# FYP Web Setup

This folder contains the React + Vite frontend for the Smart Attendance System.

## What is in this folder

- `node_modules/` - local frontend dependencies installed by `setup_web.bat`
- `.cache/` - web-local npm cache and temp files
- `.env.example` - template for frontend environment variables
- `setup_web.bat` - installs frontend dependencies
- `run_web.bat` - starts the Vite development server

## Requirements

Before running the frontend, install:

- Windows
- Node.js 20 or newer

## First-time setup

From this `fyp_web` folder:

```bat
copy .env.example .env
setup_web.bat
```

If `.env` already exists and is correct, do not overwrite it.

The setup script pauses before closing so double-click users can read the final
status message.

If `node_modules` already exists, the setup script uses `npm install` instead
of force-cleaning everything with `npm ci`, which avoids common Windows file
locking errors.

## Run the web app

From this `fyp_web` folder:

```bat
run_web.bat
```

The frontend starts on:

```txt
http://127.0.0.1:5173
```

It expects the backend at:

```txt
http://127.0.0.1:8003
```

If the web app stops with an error, the script keeps the final message visible
instead of closing immediately.

## Build for production

From this `fyp_web` folder:

```bat
npm run build
```

Build output goes to:

```txt
fyp_web\dist
```

## If you are starting from the project root

Open terminal in `fyp-main`, then enter the web folder first:

```bat
cd fyp_web
setup_web.bat
run_web.bat
```

## Optional no-pause mode

If you run the scripts from an existing terminal and do not want the final
pause screen:

```bat
setup_web.bat --no-pause
run_web.bat --no-pause
```

## Portable project behavior

This frontend is set up to keep its extra npm files inside the project:

- dependencies go into `fyp_web\node_modules`
- npm cache goes into `fyp_web\.cache\npm`
- temp files go into `fyp_web\.cache\tmp`

That means setup does not need to scatter frontend cache files around your PC.

## Sharing with another person

If you send this project to someone else, they should:

1. Install Node.js 20 or newer
2. Open this `fyp_web` folder
3. Copy `.env.example` to `.env`
4. Adjust `.env` if their backend URL is different
5. Run `setup_web.bat`
6. Run `run_web.bat`

Important:

- do not rely on copying `node_modules` from one PC to another
- let each machine run `setup_web.bat` for itself
- the frontend default backend URL is `http://127.0.0.1:8003`

## Troubleshooting

If `setup_web.bat` fails:

- make sure Node.js is installed
- make sure `npm` works in terminal

If `run_web.bat` fails:

- make sure `node_modules` exists
- make sure `setup_web.bat` completed successfully
- make sure the backend is running on `127.0.0.1:8003`

If dependencies seem broken:

```bat
setup_web.bat
```
