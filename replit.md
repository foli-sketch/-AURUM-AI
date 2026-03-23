# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Python**: Flask + yfinance + ta library for trading analysis

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (proxies to Python Flask)
│   │   └── python/         # Python Flask trading server (port 8082)
│   └── aura-terminal/      # React + Vite frontend trading terminal
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml     # pnpm workspace
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package
```

## Aura Terminal Pro

A professional Gold (XAU/USD) trading signal web app.

### Architecture

1. **Python Flask server** (`artifacts/api-server/python/trading_server.py`) runs on port 8082
   - Fetches live gold data from yfinance (GC=F)
   - Computes 20+ technical indicators using the `ta` library
   - Detects candlestick patterns, Smart Money Concepts (SMC)
   - Multi-timeframe bias analysis (1h, 4h, 1d)
   - Support/resistance level detection
   - Groq AI summary (optional)
   - Routes: GET /api/trading/signal, /api/trading/news, /api/trading/history

2. **Express API server** (`artifacts/api-server`) runs on port 8080
   - Proxies /api/trading/* requests to Python Flask on port 8082
   - Health check at /api/healthz

3. **React + Vite frontend** (`artifacts/aura-terminal`) at port 18963 (served at /)
   - Dark terminal-style trading dashboard
   - Components: TopBar, MainSignal, TechnicalIndicators, SmartMoney, MTFBiasPanel, SupportResistancePanel, MarketNews, SignalHistory
   - Auto-refresh every 30 seconds
   - React Query for data fetching

### Python Dependencies

Installed via pip: flask, flask-cors, yfinance, pandas, numpy, ta, requests, feedparser, python-dateutil, pytz

### Startup

The api-server `dev` script runs `./start-dev.sh` which:
1. Starts Python Flask on port 8082 in background
2. Builds Express TypeScript
3. Starts Express on port 8080 (reads `PORT` env var set to 8080)

### Environment Variables

- `PYTHON_PORT`: Port for Python Flask server (default: 8082)
- `GROQ_API_KEY`: Optional Groq API key for AI summaries

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
