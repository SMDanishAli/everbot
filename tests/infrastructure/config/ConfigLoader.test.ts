import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ConfigLoader } from '../../../src/infrastructure/config/ConfigLoader';

describe('ConfigLoader', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'config-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeConfig(yaml: string): string {
    const path = join(dir, 'config.yaml');
    writeFileSync(path, yaml);
    return path;
  }

  it('loads a valid config file', () => {
    const path = writeConfig(`
robots:
  - name: Bravo
    hours: 3
    chargingCost: 2
inventory:
  - type: Bravo
    source: ACTIVE
    count: 5
logging:
  level: info
  directory: ./logs
  fileName: app.log
  maxSizeMb: 10
  maxFiles: 5
database:
  path: ./data/allocation.sqlite
  busyTimeoutMs: 5000
  walMode: true
`);

    const config = ConfigLoader.load(path);

    expect(config.robots).toHaveLength(1);
    expect(config.robots[0].name).toBe('Bravo');
    expect(config.inventory[0].count).toBe(5);
    expect(config.logging.level).toBe('info');
  });

  it('loads config.yaml from the current directory when no path is provided', () => {
    const path = writeConfig(`
robots:
  - name: Bravo
    hours: 3
    chargingCost: 2
inventory: []
logging:
  level: info
  directory: ./logs
database:
  path: ./data/allocation.sqlite
  walMode: true
`);
    const originalDirectory = process.cwd();
    process.chdir(dir);

    try {
      expect(ConfigLoader.load()).toEqual(expect.objectContaining({ robots: [{ name: 'Bravo', hours: 3, chargingCost: 2 }] }));
    } finally {
      process.chdir(originalDirectory);
    }
    expect(path).toContain('config.yaml');
  });

  it('throws when no robot types are defined', () => {
    const path = writeConfig(`
robots: []
logging:
  level: info
  directory: ./logs
  fileName: app.log
  maxSizeMb: 10
  maxFiles: 5
database:
  path: ./data/allocation.sqlite
  busyTimeoutMs: 5000
`);

    expect(() => ConfigLoader.load(path)).toThrow(/at least one robot type/);
  });

  it('throws when a robot has non-positive working hours', () => {
    const path = writeConfig(`
robots:
  - name: Bravo
    hours: 0
    chargingCost: 2
inventory:
  - type: Bravo
    source: ACTIVE
    count: 5
logging:
  level: info
  directory: ./logs
  fileName: app.log
  maxSizeMb: 10
  maxFiles: 5
database:
  path: ./data/allocation.sqlite
  busyTimeoutMs: 5000
`);

    expect(() => ConfigLoader.load(path)).toThrow(/hours must be a positive number/);
  });

  it.each([
    ['robot without a name', 'robots:\n  - hours: 3\n    chargingCost: 2', 'must have a "name"'],
    ['robot with invalid charging cost', 'robots:\n  - name: Bravo\n    hours: 3\n    chargingCost: 0', 'chargingCost must be a positive number'],
    ['missing inventory', 'robots:\n  - name: Bravo\n    hours: 3\n    chargingCost: 2', 'must define "inventory"'],
    [
      'unknown inventory type',
      'robots:\n  - name: Bravo\n    hours: 3\n    chargingCost: 2\ninventory:\n  - type: Delta\n    source: ACTIVE\n    count: 1',
      'unknown robot type',
    ],
    [
      'invalid inventory source',
      'robots:\n  - name: Bravo\n    hours: 3\n    chargingCost: 2\ninventory:\n  - type: Bravo\n    source: OTHER\n    count: 1',
      'invalid source',
    ],
    [
      'negative inventory count',
      'robots:\n  - name: Bravo\n    hours: 3\n    chargingCost: 2\ninventory:\n  - type: Bravo\n    source: ACTIVE\n    count: -1',
      'non-negative integer',
    ],
  ])('rejects %s', (_name, body, message) => {
    const path = writeConfig(`
${body}
logging:
  level: info
  directory: ./logs
  fileName: app.log
  maxSizeMb: 10
  maxFiles: 5
database:
  path: ./data/allocation.sqlite
  busyTimeoutMs: 5000
  walMode: true
`);

    expect(() => ConfigLoader.load(path)).toThrow(new RegExp(message));
  });

  it.each([
    ['missing logging', 'robots:\n  - name: Bravo\n    hours: 3\n    chargingCost: 2\ninventory: []', 'logging'],
    ['missing database', 'robots:\n  - name: Bravo\n    hours: 3\n    chargingCost: 2\ninventory: []\nlogging:\n  level: info\n  directory: ./logs', 'database'],
    [
      'invalid wal mode',
      'robots:\n  - name: Bravo\n    hours: 3\n    chargingCost: 2\ninventory: []\nlogging:\n  level: info\n  directory: ./logs\ndatabase:\n  path: ./data/allocation.sqlite\n  walMode: yes',
      'walMode',
    ],
  ])('rejects config with %s', (_name, body, message) => {
    const path = writeConfig(`
${body}
`);

    expect(() => ConfigLoader.load(path)).toThrow(new RegExp(message));
  });
});
