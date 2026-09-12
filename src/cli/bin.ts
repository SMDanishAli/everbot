#!/usr/bin/env node

import { resetInventory, runSession, showAllocations, showLogs, showSummary } from './commandHandlers';

/**
 * everbot <command>
 *
 *   run    Start an allocation session
 *   allocation Show allocation history
 *   summary Show current inventory and utilization
 *   reset  Remove all inventory
 *   logs   Show application logs
 */
async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;

  switch (command) {
    case 'run':
      await runSession();
      break;

    case 'summary':
      await showSummary();
      break;

    case 'allocation':
      await showAllocations();
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
      '  allocation Show allocation history',
      '  summary  Show current inventory and utilization',
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