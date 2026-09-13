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
    hours: 3        # <= 0 will throw error
    chargingCost: 2
  - name: Charlie
    hours: 5
    chargingCost: 3
  - name: Delta
    hours: 8
    chargingCost: 4

inventory:
  - type: Bravo
    source: ACTIVE
    count: 5
  - type: Charlie
    source: ACTIVE
    count: 5
  - type: Delta
    source: ACTIVE
    count: 5
  - type: Bravo
    source: STANDBY
    count: 2
  - type: Charlie
    source: STANDBY
    count: 2
  - type: Delta
    source: STANDBY
    count: 2

logging:
  level: debug          # trace | debug | info | warn | error
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



## Approach

- Domain layer is immutable and serve singular purpose
- Domain and strategy logic were written test-first: a spec example
becomes a failing test, then the minimum code to pass it. Infrastructure
(SQLite repositories, config loading) was tested against real behavior
(temp DB files, real YAML) rather than mocks, so tests catch real wiring
bugs, not just unit-level correctness.
- Robot types and inventory can be changed in `config.yaml` without changing code.
- Allocation rules are kept separate from the database, making the application easier to test and maintain.
- Level 1 and 2 algorithms are based on bounded knapsack (polynomial complexity) instead of cartesian / bruteforce (exponential complexity); this allows the application to scale well if we added more reobot types in the future.
- `tsconfig.json` follows strict rules for code hygiene
- Allocation is persisted in sqlite database with concurrency across terminal sessions (caveats are mentioned in Assumptions section below)
- Fair use of object-oriented & solid principles:
  1. *Single responsiblity* - each section of the code does only its own job without side effects
  2. *Configurable* - Robots property and inventory can be updated by changing `config.yaml` without touching code
  3. *Extensible* - new strategies can be added or updated without having to change allocation service or cli controllers. sqlite db migration is also supported
- It is ensured to keep functions and classes as reusable as possible without adding extra complexities.
- All logs are persisted in *logs* folder for debugging

**Patterns:**
- *Strategy* — L1/L2/L3 allocation logic, swapped at runtime by CLI choice.
- *Decorator* — `StandbyActivationStrategy` wraps `CostOptimizedStrategy`
  rather than duplicating its logic, adding standby fallback on top.
- *Repository* — all persistence (inventory, reservations, history) sits
  behind interfaces so SQLite can be swapped or mocked in tests.

## Code Structure

The project is split into simple areas:

- **CLI** — handles commands, prompts, and display.
- **Services** — coordinates actions such as allocation and reporting.
- **Strategies** — contains the different ways robots can be allocated.
- **Domain** — contains the robot interfaces, errors, and request rules.
- **Infrastructure** — handles configuration, the database, and logging.

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

## Assumptions / Trade-offs considered

  1. Robot availability constraints follow the daily allocation quota. This mean the robots availability will be reset at midnight. We do not cater for the working duration of the robot as it is beyond the scope (as per the spec document). If a robot starts work at 11 pm, it will be reset at 12am eventhough it has work duration of 3 hours
  2. The allocation history is persisted in the sqlite database which is stateless and file-based. The application is asssumed to be run on a single-host machine (Not in centralized / file-sharing system).
  3. The configured inventory is loaded in memory, while allocation history is
  stored in SQLite. Each allocation re-reads the day's history and uses an
  immediate SQLite transaction for the final capacity check and history write.
  4. Users don't have to choose L4 (multi-client) strategy explicitly - it is always used implicitly when multiple values are provided. Internally, it will use L3 + L2 (cost optimised strategy including standby-robots) even if users pick L1. There is a console log in yellow to which mentions that your strategy has been overriden due to multi-client input.

## Potential areas of improvement

  1. Send email alerts when there are any fatal errors
  2. Add `persist: true` in config.yaml - if false, sqlite will not be used and allocation will only stay in-memory. This can be useful for testing done during development.
  3. Save total cost and utilization stats in the db - this can be used for graphical analysis against time periods
  4. Currently, CI only runs on new tag (i.e. new release). I did it on purpose since I am using github shared runners. In an actual environment where multiple contributors use different branches, the test stage should run on every major commit.

## AI Usage

- Claude and GitHub Copilot
- Claude was used for initial project planning and scaffolding
- Copilot was used for code generation within VS code

## Using as packaged release (experimental)

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