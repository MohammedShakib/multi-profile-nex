# Multi Profile Nex

React frontend and Express proxy backend for running two isolated NexCourses profiles from one deployed app.

## Project Structure

```txt
frontend/   React + Vite profile selection UI
backend/    Express proxy server and production static serving
```

## Local Development

Install dependencies:

```bash
npm install
```

Run the frontend dev server:

```bash
npm run dev
```

Run the backend proxy server:

```bash
npm run dev:server
```

## Production

Build the frontend:

```bash
npm run build
```

Start the backend:

```bash
npm start
```

The backend serves `frontend/dist` and keeps the profile proxy routes available at:

```txt
/proxy/p1/
/proxy/p2/
```

## Render

Create a Render Web Service, not a Static Site.

```txt
Build Command: npm install && npm run build
Start Command: npm start
```
