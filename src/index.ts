import { runSession } from './cli/commandHandlers';

/**
 * Entry-point of the application
 * runSession will use concrete implementations and initialisations only  
 */
async function main(): Promise<void> {
  await runSession();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
