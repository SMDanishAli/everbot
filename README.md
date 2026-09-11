# Robot Work Allocation System

Terminal-based CLI (Node.js + TypeScript) that allocates robots to client work
requests, per the EverBot Solutions spec (4 levels: category distribution,
cost optimization, standby activation, multi-client).

## Setup

```bash
npm install
npm run build
npm link        # makes `everbot` available globally, use sudo on dev

everbot run
```

## Using a packaged release

Tagged releases publish platform-specific binaries as GitHub Release assets:

```text
everbot-linux-x64.bin
everbot-macos-x64.bin
everbot-win-x64.exe
```

Download the binary for your platform and place it in a directory together with
an external `config.yaml`:

```text
everbot/
├── everbot-linux-x64.bin
├── config.yaml
├── data/
└── logs/
```

On Linux or macOS, make the binary executable and run it from that directory:

```bash
chmod +x everbot-linux-x64.bin
./everbot-linux-x64.bin summary
./everbot-linux-x64.bin run
```

On Windows, run the executable from PowerShell:

```powershell
.\everbot-win-x64.exe summary
.\everbot-win-x64.exe run
```

The binary does not embed `config.yaml`. It loads `./config.yaml` from the
current working directory each time it starts, so users can edit the file
without rebuilding the binary. The database and log paths are also resolved
relative to the current working directory unless absolute paths are configured.

The configuration file defines robot specifications, inventory, logging, and
database settings:

```yaml
robots:
  - name: Bravo
    hours: 3
    chargingCost: 2

inventory:
  - type: Bravo
    source: ACTIVE
    count: 10
  - type: Bravo
    source: STANDBY
    count: 2

logging:
  level: info
  directory: ./logs
  fileName: app.log
  maxSizeMb: 5
  maxFiles: 3

database:
  path: ./data/allocation.sqlite
  busyTimeoutMs: 5000
  walMode: true
```

After changing the configuration, restart the command for the changes to be
loaded. Allocation history remains in the configured SQLite database, so it can
continue to affect the `summary` command. Use `reset` to clear allocation
history when required:

```bash
./everbot-linux-x64.bin reset
```

Development:

```bash
npm run dev            # ts-node, no build step
npm test                # jest
npm run test:watch
npm run test:coverage
npm run lint
npm run format
```

## Architecture

```
config.yaml                 Robot specs, inventory, logging, and database settings

src/
├── domain/                 Zero dependencies. Entities, errors, repository interfaces.
├── strategies/              Strategy pattern — one class per allocation level (1-4).
├── services/                Orchestration: AllocationService, InventoryService, calculators.
├── parsers/                 Input validation and parsing, pure functions.
├── infrastructure/
│   ├── config/               ConfigLoader + RobotTypeRegistry (config.yaml -> domain objects)
│   ├── logging/               ILogger abstraction, PinoLogger (real), InMemoryLogger (test double)
│   ├── db/                    better-sqlite3 connection (WAL + busy_timeout), migrations
│   └── repositories/          SQLite implementations of the domain repository interfaces
├── cli/                     Thin I/O layer: prompts, formatters, CliController
└── index.ts                 Composition root — the only place concretes are wired together

tests/                      Mirrors src/. Unit tests use InMemoryLogger + in-memory/fake
                             repositories; no real DB or disk I/O outside repository tests.
```

## Design decisions

- **Strategy pattern** (`IAllocationStrategy`) — each allocation level is a swappable
  implementation; adding a new level means adding a class, not editing existing ones.
- **Decorator pattern** — Level 3 (`StandbyActivationStrategy`) wraps a base strategy
  rather than duplicating its selection logic.
- **Repository pattern** + Dependency Inversion — `services`/`strategies` depend on
  `IRobotRepository`/`IAllocationHistoryRepository` interfaces, not SQLite directly.
- **Config-driven robot specs** — `RobotType` is a plain value object; actual hours/cost
  come from `config.yaml` via `RobotTypeRegistry`. Changing a robot's numbers, or adding
  a new type, requires no code change.
- **Logging abstraction** — `ILogger` interface, `PinoLogger` real implementation
  (rotating file + console, ISO timestamps), `InMemoryLogger` for tests. Logical errors
  (`DomainError` subclasses) are logged at `warn`; unexpected/system errors at `error`.
  Logging happens once, at the boundary where an error is caught — not duplicated at
  every layer it passes through.
- **SQLite via `better-sqlite3`** — WAL mode + `busy_timeout` so multiple CLI instances
  run concurrently without corrupting data; inventory allocation is wrapped in a single
  transaction (atomic read-check-write) to prevent race conditions.

## TDD status

Domain entities, `ConfigLoader`, and project tooling are implemented and tested.
Strategy classes, parsers, and remaining services are scaffolded with `IAllocationStrategy`
contracts and throw `Not implemented` — write the failing test first (see the spec's
worked examples for expected inputs/outputs), then implement.
