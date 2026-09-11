#!/usr/bin/env node

import { initInventory, resetInventory, runSession, showLogs, showResources } from './runSession';

/**
 * everbot <command>
 *
 *   run    Start an allocation session
 *   init   Initialize inventory from config.yaml
 *   resources  Show current inventory
 *   reset  Remove all inventory
 *   logs   Show application logs
 *
 * A plain switch is sufficient for the current single-command surface.
 * If more commands are added, extract this into a small command registry
 * (name -> handler map) rather than growing this switch indefinitely.
 */
async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;

  switch (command) {
    case 'run':
      await runSession();
      break;

    case 'init':
      await initInventory();
      break;

    case 'resources':
      await showResources();
      break;

    case 'reset':
      await resetInventory(args.includes('--hard'));
      break;

    case 'logs':
      showLogs();
      break;

    case undefined:
    case '--help':
    case '-h':
      printUsage();
      break;

    default:
      console.error(`Unknown command: "${command}"\n`);
      printUsage();
      process.exitCode = 1;
  }
}

function printUsage(): void {
  console.log(
    [
      'Usage: everbot <command>',
      '',
      'Commands:',
      '  run      Start an allocation session',
      '  init     Initialize inventory from config.yaml',
      '  resources Show current inventory',
      '  reset    Remove all inventory (use --hard to drop all SQL tables)',
      '  logs     Show application logs',
      '',
    ].join('\n'),
  );
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});