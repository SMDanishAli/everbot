# Robot Work Allocation System

Terminal-based CLI (Node.js + TypeScript) that allocates robots to client work
requests, per the EverBot Solutions spec (4 levels: category distribution,
cost optimization, standby activation, multi-client).

## How to use

### 1. Using as packaged release

Download platform-specific binaries from the latest release artifacts:

```text
Everbot (Linux)/
├── everbot-linux-x64.bin
└── config.yaml
Everbot (macOs)/
├── everbot-macos-x64.bin
└── config.yaml
Everbot (Windows)/
├── everbot-win-x64.exe
└── config.yaml
```
Download the folder for your platform. The folder already contains the matching
`config.yaml`; keep the executable and config file together. The paths in that
config are relative to the platform folder:

```yaml
logging:
  directory: ./logs
database:
  path: ./data/allocation.sqlite
```

From inside the platform folder, run the macOS or Linux binary with `./`:

```bash
cd "/path/to/Everbot (macOs)"
chmod +x everbot-macos-x64.bin
./everbot-macos-x64.bin run
./everbot-macos-x64.bin allocation
```

Use the matching filename for your platform. `/everbot-macos-x64.bin` is
interpreted as an absolute path from the filesystem root, while
`./everbot-macos-x64.bin` means the binary in the current directory.

If macOS blocks the downloaded binary, allow it in **System Settings >
Privacy & Security**, then run the command again.

For Linux, use:

```bash
cd "/path/to/Everbot (Linux)"
chmod +x everbot-linux-x64.bin
./everbot-linux-x64.bin summary
./everbot-linux-x64.bin run
./everbot-linux-x64.bin allocation
```
On Windows, run the executable from PowerShell:

```powershell
cd "C:\path\to\Everbot (Windows)"
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

The source is organized by responsibility:

```text
src/
├── index.ts                         # application entry point
├── cli/
│   ├── bin.ts                        # command definitions
│   ├── commandHandlers.ts            # composition root and command handlers
│   ├── CliController.ts              # prompts and allocation interaction
│   ├── prompts.ts
│   └── formatters/                   # terminal output
├── parsers/
│   ├── ClientHoursParser.ts
│   └── InputValidator.ts
├── services/
│   ├── AllocationService.ts
│   ├── InventoryService.ts
│   ├── AllocationComparator.ts
│   ├── CostCalculator.ts
│   └── UtilizationCalculator.ts
├── strategies/
│   ├── IAllocationStrategy.ts
│   ├── CategoryDistributionStrategy.ts # L1
│   ├── CostOptimizedStrategy.ts        # L2
│   ├── StandbyActivationStrategy.ts    # L3
│   └── MultiClientAllocator.ts
├── domain/
│   ├── entities/
│   ├── errors/
│   └── repositories/                  # repository interfaces
└── infrastructure/
    ├── config/
    ├── db/
    ├── logging/
    └── repositories/
```

`src/cli/commandHandlers.ts` wires the concrete infrastructure together. It
loads `config.yaml`, creates the logger and SQLite database, runs migrations,
builds the in-memory inventory repository and services, selects the allocation
strategy, and passes the resulting `AllocationService` to `CliController`.

During `everbot run`, `CliController` parses the prompt input into
`ClientRequest` objects. `AllocationService` asks `InventoryService` for
available `Robot` objects, invokes the selected strategy, calls the repository
to consume the assigned inventory, and writes one or more records to
`allocation_history`. For multiple clients, `AllocationService` uses
`MultiClientAllocator`, which owns depletion of the shared in-memory pool.

The configured inventory is loaded into `SqliteRobotRepository` at startup and
is held in memory for the process lifetime. SQLite stores allocation history,
which is applied once on startup to calculate the available inventory. The
database layer also provides migrations, WAL mode, and `busy_timeout`.
Repository interfaces in `domain/repositories` keep services and strategies
independent of the SQLite implementations.

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
