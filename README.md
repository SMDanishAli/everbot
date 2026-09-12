# Robot Work Allocation System

Terminal-based CLI (Node.js + TypeScript) that allocates robots to client work
requests, per the EverBot Solutions spec (4 levels: category distribution,
cost optimization, standby activation, multi-client).

## To Install

- Install Node.js 18+ on your machine
- Clone the repo and run the following:

```bash
npm install
npm run build
npm link        # makes `everbot` available globally, use with sudo on

everbot run
```
For testing / debugging:

```bash
npm run dev            # ts-node, no build step
npm test                # jest
npm run test:watch
npm run test:coverage
npm run lint
npm run format
```

## CLI interface

Use the following command format:

```text
everbot <command>
```

| Command | Description | Options / Output |
| --- | --- | --- |
| `run` | Starts an interactive allocation session. Prompts for one or more client work-hour requests and an allocation strategy. | Supports L1, L2, and L3 strategies. Level 2, Level 3, and every multi-client allocation print the Level 1 vs Level 2 cost comparison. Multi-client runs also print Level 4 totals and utilisation. |
| `allocation` | Displays persisted allocation history. | Reads records from the configured SQLite database. |
| `summary` | Displays current inventory, charging cost, and robot utilisation. | Uses the configured inventory and allocation history. |
| `reset` | Clears allocation history. | Add `--hard` to drop all application SQLite tables. |
| `logs` | Displays application logs and available log-file paths. | Uses the logging directory and file name from `config.yaml`. |
| `--help`, `-h` | Displays command usage. | Also shown when no command is provided. |

For packaged releases, replace `everbot` with the platform executable name and
run it from inside the corresponding `Everbot (...)` folder.

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







## Architecture

The project is split into simple areas:

- **CLI** — handles commands, prompts, and display.
- **Services** — coordinates actions such as allocation and reporting.
- **Strategies** — contains the different ways robots can be allocated.
- **Domain** — contains the main robot and request rules.
- **Infrastructure** — handles configuration, the database, and logging.

Key benefits:

- L1, L2, and L3 can be selected without changing the rest of the application.
- Standby robots are used only when active robots are not enough.
- Robot types and inventory can be changed in `config.yaml` without changing code.
- Allocation rules are kept separate from the database, making the application
  easier to test and maintain.
- SQLite uses WAL mode and an immediate write transaction around each allocation
  to re-check capacity and persist the allocation safely when multiple sessions
  run at the same time.
- The project follows a test-driven approach, with automated tests covering
  allocation strategies, services, CLI behavior, and database operations.


```text
src/
├── index.ts                         # application entry point
├── cli/
│   ├── bin.ts                        # command definitions
│   ├── commandHandlers.ts            # composition root and command handlers
│   ├── CliController.ts              # prompts and allocation interaction
│   ├── prompts.ts                    # helper functions for clack prompts
│   └── formatters/                   # terminal output
├── parsers/                          # To parse and validate CLI inputs
│   ├── ClientHoursParser.ts
│   └── InputValidator.ts
├── services/
│   ├── AllocationService.ts          # Run the given strategy & persist the result
│   ├── InventoryService.ts           # Get available resources
├── strategies/
│   ├── IAllocationStrategy.ts        # Interface implemented by all other strategies 
│   ├── CategoryDistributionStrategy.ts # L1
│   ├── CostOptimizedStrategy.ts        # L2
│   ├── StandbyActivationStrategy.ts    # L3
│   └── MultiClientAllocator.ts         # Triggered when there is multi-client input.
├── domain/                             # Repo interfaces & error types
│   ├── entities/
│   ├── errors/
│   └── repositories/            
└── infrastructure/
    ├── config/                         # To load config.yaml
    ├── db/                             # sqlite db migrations
    ├── logging/                        # Pino logger
    └── repositories/                   # Inventory and allocation persistence
```

### Assumptions

- 1. Robot availability constraints follow the daily allocation quota. This mean the robots availability will be reset at midnight. We do not cater for the working duration of the robot as it is beyond the scope (as per the spec document). If a robot starts work at 11 pm, it will be reset at 12am eventhough it has work duration of 3 hours
- 2. The allocation history is persisted in the sqlite database which is stateless and file-based. The application is asssumed to be run on a single-host machine (Not in centralized / file-sharing system).
- 3. The configured inventory is loaded in memory, while allocation history is
  stored in SQLite. Each allocation re-reads the day's history and uses an
  immediate SQLite transaction for the final capacity check and history write.
- 4. For multi-client input, L3 (Standby Activation Strategy) is always used implicitly which internally uses cost-optimised strategy. The CLI prints this in yellow color clearly.


### Using as packaged release (experimental)

*Note:* Since we are using shared github runners, packaged release may fail or stay stuck. 

Download the zip file for your platform from the latest release and extract it.
Each zip contains the executable, its matching `config.yaml`, and the
platform-specific SQLite native binding:

```text
everbot-linux-x64.zip
├── everbot
├── better_sqlite3.node
└── config.yaml
everbot-macos-x64.zip
├── everbot
├── better_sqlite3.node
└── config.yaml
everbot-win-x64.zip
├── everbot.exe
├── better_sqlite3.node
└── config.yaml
```

After extraction, the folder should look like this:

```text
Everbot (Linux)/
├── everbot
├── better_sqlite3.node
└── config.yaml
Everbot (macOs)/
├── everbot
├── better_sqlite3.node
└── config.yaml
Everbot (Windows)/
├── everbot.exe
├── better_sqlite3.node
└── config.yaml
```
Keep all three files together. The paths in that
config are relative to the platform folder:

```yaml
logging:
  directory: ./logs
database:
  path: ./data/allocation.sqlite
```

From inside the platform folder, run the macOS or Linux binary with `./`: