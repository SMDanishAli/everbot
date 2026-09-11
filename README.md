# Robot Work Allocation System

Terminal-based CLI (Node.js + TypeScript) that allocates robots to client work
requests, per the EverBot Solutions spec (4 levels: category distribution,
cost optimization, standby activation, multi-client).

## How to use

### 1. Using as packaged release

Download platform-specific binaries from the latest release artifacts:

```text
everbot-linux-x64.bin
everbot-macos-x64.bin
everbot-win-x64.exe
```
Download the binary for your platform and place it in a directory together with
an external `config.yaml` (Check below for config spec):

To run:

```bash
chmod +x everbot-linux-x64.bin
./everbot-linux-x64.bin summary
./everbot-linux-x64.bin run
./everbot-linux-x64.bin allocation
```
On Windows, run the executable from PowerShell:

```powershell
.\everbot-win-x64.exe summary
.\everbot-win-x64.exe run
.\everbot-win-x64.exe allocation
```

### 2. Developer's Setup

```bash
npm install
npm run build
npm link        # makes `everbot` available globally, use sudo on dev

everbot run
```

## Config

The config.yaml file defines robot specifications, inventory, logging, and
database settings. Sample is shown below:

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

*Note:* The config is in-memory hence every new execution of everbot will use the latest values from the config. 


### For testing / debugging

```bash
npm run dev            # ts-node, no build step
npm test                # jest
npm run test:watch
npm run test:coverage
npm run lint
npm run format
```

## Architecture

TBD

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
