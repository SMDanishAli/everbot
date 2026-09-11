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
});
