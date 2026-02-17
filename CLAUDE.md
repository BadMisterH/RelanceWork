# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RelanceWork is a Node.js + TypeScript application for tracking job applications. It provides a REST API to manage application records with SQLite database integration using better-sqlite3.

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
- [config/database.ts](src/config/database.ts) - SQLite database connection using `better-sqlite3`
  - Database file: `./data/relancework.sqlite` (configurable via `DB_PATH` environment variable)
  - WAL mode enabled for better concurrency

**Controllers**
- [controllers/applicationController.ts](src/controllers/applicationController.ts) - Application CRUD operations
  - All operations (GET, POST, PUT, DELETE) interact directly with SQLite database
  - Includes utility function `addApplication` for programmatic use

**Type Definitions**
- [types/Application.ts](src/types/Application.ts) - Defines the Application type with fields:
  - id, company, poste, status, date, created_at
  - relanced (0/1), email, userEmail, relance_count

**Database Scripts**
- [scripts/createTable.ts](src/scripts/createTable.ts) - Creates the complete `applications` table in SQLite
  - Table schema: id (INTEGER PRIMARY KEY), company, poste, status, date, created_at, relanced, email, userEmail, relance_count
- [scripts/createUsersTable.ts](src/scripts/createUsersTable.ts) - Creates users table for authentication
- Migration scripts for adding columns (legacy, no longer needed if using createTable.ts):
  - addRelancedColumn.ts, addEmailColumn.ts, addUserEmailColumn.ts, addRelanceCountColumn.ts

### API Endpoints

**Health**
- `GET /health` - Health check endpoint returning `{ "status": "ok" }`

**Applications**
- `GET /api/applications` - Fetches all applications from SQLite database
- `POST /api/application` - Creates a new application in database (returns 201)
- `PUT /api/applications/:id/relance` - Updates relance status (0/1)
- `PUT /api/applications/:id/send-relance` - Increments relance counter
- `DELETE /api/applications/:id` - Deletes application by ID

**Authentication**
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

**Gmail Integration**
- Routes in [routes/gmailRoutes.ts](src/routes/gmailRoutes.ts)

**Email Enrichment**
- Routes in [routes/emailEnrichmentRoutes.ts](src/routes/emailEnrichmentRoutes.ts)

## TypeScript Configuration

- Module system: **CommonJS** (note: README mentions ESM but tsconfig.json uses CommonJS)
- Target: ES2020
- Output directory: `./dist`
- Source directory: `./src`
- Strict mode enabled with additional strict checks: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`

## Important Notes

**Database Setup**: Before running the application for the first time, execute `npm run create-table` to initialize the SQLite database schema with all required columns.

**Module System**: The project uses CommonJS (tsconfig.json). The project does not have `"type": "module"` in package.json.

**CORS Configuration**: The application allows all origins (`*`) for development. The CORS middleware includes `Access-Control-Allow-Private-Network` header to support requests from Chrome extensions and Gmail contexts to localhost.

**Static Files**:
- Landing page served from `./public` at root `/`
- Client application served from `./client/dist` at `/app`

