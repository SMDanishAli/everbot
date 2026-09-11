import { readFileSync } from 'fs';
import { parse } from 'yaml';

export interface RobotSpecConfig {
  name: string;
  hours: number;
  chargingCost: number;
}

export interface InitialInventoryEntry {
  type: string;
  source: 'ACTIVE' | 'STANDBY';
  count: number;
}

export interface LoggingConfig {
  level: string;
  directory: string;
  fileName: string;
  maxSizeMb: number;
  maxFiles: number;
}

export interface DatabaseConfig {
  path: string;
  busyTimeoutMs: number;
  walMode: boolean;
}

export interface AppConfig {
  robots: RobotSpecConfig[];
  inventory: InitialInventoryEntry[];
  logging: LoggingConfig;
  database: DatabaseConfig;
}

/**
 * Loads and validates config.yaml. Fails fast at startup (composition root)
 * rather than letting bad config surface as a confusing runtime error later.
 */
export class ConfigLoader {
  static load(path: string = './config.yaml'): AppConfig {
    const raw = readFileSync(path, 'utf-8');
    const parsed = parse(raw) as AppConfig;
    ConfigLoader.validate(parsed);
    return parsed;
  }

  private static validate(config: AppConfig): void {
    if (!config.robots || config.robots.length === 0) {
      throw new Error('config.yaml must define at least one robot type under "robots".');
    }

    for (const robot of config.robots) {
      if (!robot.name) {
        throw new Error('Each robot entry in config.yaml must have a "name".');
      }
      if (!Number.isFinite(robot.hours) || robot.hours <= 0) {
        throw new Error(`Robot "${robot.name}": hours must be a positive number.`);
      }
      if (!Number.isFinite(robot.chargingCost) || robot.chargingCost <= 0) {
        throw new Error(`Robot "${robot.name}": chargingCost must be a positive number.`);
      }
    }

    if (!config.inventory) {
      throw new Error('config.yaml must define "inventory".');
    }

    const knownTypes = new Set(config.robots.map((r) => r.name));
    for (const entry of config.inventory) {
      if (!knownTypes.has(entry.type)) {
        throw new Error(
          `inventory references unknown robot type "${entry.type}". Add it under "robots" first.`,
        );
      }
      if (entry.source !== 'ACTIVE' && entry.source !== 'STANDBY') {
        throw new Error(
          `inventory entry for "${entry.type}" has invalid source "${entry.source}" (must be ACTIVE or STANDBY).`,
        );
      }
      if (!Number.isInteger(entry.count) || entry.count < 0) {
        throw new Error(`inventory entry for "${entry.type}" (${entry.source}): count must be a non-negative integer.`);
      }
    }

    if (!config.logging || !config.logging.level || !config.logging.directory) {
      throw new Error('config.yaml must define "logging.level" and "logging.directory".');
    }

    if (!config.database || !config.database.path) {
      throw new Error('config.yaml must define "database.path".');
    }
    if (typeof config.database.walMode !== 'boolean') {
      throw new Error('config.yaml must define "database.walMode" as true or false.');
    }
  }
}