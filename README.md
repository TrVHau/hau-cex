# Hau CEX

A full-stack centralized crypto exchange project built for learning, experimentation, and engineering practice. The system combines a web frontend, NestJS backend, worker services, Go matching engine, PostgreSQL, Redis, and Solidity smart contracts.

## Overview

Hau CEX is designed to simulate a real trading platform with the following core responsibilities:

- User authentication and account management
- Wallet and ledger accounting
- Order placement and cancellation
- Market status and matching engine integration
- Event-driven backend communication using Redis streams and outbox patterns
- Smart contract-based asset and vault logic for a local blockchain environment

This repository follows a monorepo structure to keep the application, engine, and contracts clearly separated while still sharing one deployment and development workflow.

## Tech Stack

- Frontend: React, Vite, TypeScript
- Backend: NestJS, TypeScript
- Matching Engine: Go
- Database: PostgreSQL
- Cache / Messaging: Redis
- ORM: Prisma
- Smart Contracts: Solidity, Hardhat
- Tooling: pnpm workspaces, Docker Compose

## Architecture

```text
Client Web App
      |
      v
   NestJS API
      |
      +--> PostgreSQL
      +--> Redis Streams / Outbox
      +--> Worker Services
               |
               v
        Go Matching Engine
               |
               +--> Trade/Event Streams
               +--> Backend Consumer

Smart Contracts
  +--> Hardhat local blockchain
```

## Key Features

- User registration and login flow
- Wallet and ledger balance management
- Limit order creation and cancellation
- Market lifecycle and trading pair bootstrap
- Matching engine for order execution
- Database-first event coordination via outbox pattern
- Realtime market data integration through event-driven services
- Solidity contract foundation for token / faucet / vault-style components

## Repository Structure

```text
hau-cex/
├─ apps/
│  ├─ backend/           # NestJS API + worker services
│  └─ web/               # React frontend application
├─ services/
│  └─ matching-engine/   # Go-based matching engine
├─ contracts/            # Solidity contracts and Hardhat config
├─ docs/                 # Design docs, architecture, roadmap
├─ packages/
│  └─ shared-types/      # Shared types package
├─ docker-compose.yml    # PostgreSQL + Redis infrastructure
├─ package.json          # Root workspace scripts
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ README.md
├─ plan.md
├─ LICENSE
└─ ...
```

## Prerequisites

Before running the project, make sure you have:

- Node.js 20+
- pnpm 9+
- Go 1.22+
- Docker and Docker Compose
- PostgreSQL and Redis available locally or via Docker

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start infrastructure

```bash
pnpm infra:up
```

This starts the required services defined in [docker-compose.yml](docker-compose.yml):

- PostgreSQL
- Redis

### 3. Configure environment variables

Create the required environment variables for the app, for example:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=hau_cex
POSTGRES_PORT=5432
REDIS_PORT=6379
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hau_cex
REDIS_URL=redis://localhost:6379
```

### 4. Prepare the database

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### 5. Run the services

#### Backend API

```bash
pnpm dev:api
```

#### Backend Worker

```bash
pnpm dev:worker
```

#### Frontend

```bash
pnpm dev:web
```

#### Matching Engine

```bash
pnpm dev:engine
```

#### Smart contracts

```bash
pnpm contracts:compile
pnpm contracts:test
```

## Useful Scripts

At the workspace root:

```bash
pnpm build:web
pnpm build:backend
pnpm build:api
pnpm build:worker
pnpm lint:web
pnpm lint:backend
pnpm test:backend
pnpm test:engine
pnpm infra:up
pnpm infra:down
pnpm db:studio
```

## Business Flow

1. User submits an order through the API.
2. Backend validates wallet balance, trading pair status, and order data.
3. Order is written to the database and an outbox event is created.
4. Worker publishes the command to the Redis stream.
5. Matching Engine consumes the command and executes match logic.
6. Engine emits trade or status events.
7. Worker updates the database state and ledger entries.

## Documentation

Project design and planning documents are located in the [docs](docs) folder:

- [docs/01-overview.md](docs/01-overview.md)
- [docs/06-system-architecture.md](docs/06-system-architecture.md)
- [docs/07-database-design.md](docs/07-database-design.md)
- [docs/08-api-design.md](docs/08-api-design.md)
- [docs/10-matching-engine-design.md](docs/10-matching-engine-design.md)
- [docs/11-smart-contract-design.md](docs/11-smart-contract-design.md)
- [docs/13-implementation-roadmap.md](docs/13-implementation-roadmap.md)

## Project Status

This project is currently in active development and is intended as a practical engineering exercise for building a trading platform from end to end.

## License

This project is intended for learning and internal technical development. See [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome as long as they align with the project’s learning goals and architecture direction. Please keep the codebase consistent with the established service boundaries and documentation structure.
