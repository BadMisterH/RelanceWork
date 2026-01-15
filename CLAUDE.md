# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RelanceWork is a Node.js + TypeScript application for tracking job applications. It provides a REST API to manage application records with PostgreSQL database integration.

## Development Commands

```bash
# Install dependencies
npm install

# Development mode (executes TypeScript directly with ts-node and auto-reload)
npm run dev

# Build TypeScript to ./dist
npm run build

# Run compiled code (production)
npm start

# Development on built JS (watch dist and restart node ./dist/server.js)
npm run start:dev

# Create database table
npm run create-table
```

## Architecture

### Entry Points

- [server.ts](src/server.ts) - Main entry point that starts the Express server on port 3000
- [app.ts](src/app.ts) - Express application configuration with routes and middleware
- [index.ts](src/index.ts) - Minimal file (currently unused in favor of server.ts)

### Key Components

**Database Layer**
- [config/database.ts](src/config/database.ts) - PostgreSQL connection pool using `pg` library
  - Configurable via environment variables: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
  - Defaults to localhost:5432/relancework with postgres/password credentials

**Data Layer**
- [data/Applications.ts](src/data/Applications.ts) - In-memory array of applications (used for POST/DELETE operations)
- Note: GET operations query the PostgreSQL database, but POST/DELETE currently use in-memory array

**Type Definitions**
- [types/Application.ts](src/types/Application.ts) - Defines the Application type with fields: id, compagny, post, email

**Database Scripts**
- [scripts/createTable.ts](src/scripts/createTable.ts) - Creates the `applications` table in PostgreSQL
  - Table schema: id (SERIAL), company, position, status, date, created_at

### API Endpoints

- `GET /health` - Health check endpoint returning `{ "status": "ok" }`
- `GET /applications` - Fetches all applications from PostgreSQL database
- `POST /application` - Adds application to in-memory array (returns 201)
- `DELETE /applications/:id` - Removes application from in-memory array by ID (returns 204)

## TypeScript Configuration

- Module system: **CommonJS** (note: README mentions ESM but tsconfig.json uses CommonJS)
- Target: ES2020
- Output directory: `./dist`
- Source directory: `./src`
- Strict mode enabled with additional strict checks: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`

## Important Notes

**Data Persistence Inconsistency**: The application has a mixed approach to data storage:
- GET requests fetch from PostgreSQL database
- POST and DELETE operations modify the in-memory `applications` array
- This means data added via POST is not persisted to the database and won't appear in GET requests

**Database Setup**: Before running the application, execute `npm run create-table` to initialize the PostgreSQL database schema.

**Module System**: Despite the README mentioning ESM configuration, the current tsconfig.json uses CommonJS. The project does not have `"type": "module"` in package.json.
