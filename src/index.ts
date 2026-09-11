import { runSession } from './cli/runSession';

/**
 * Entry-point of the application
 * Used for concrete implementations and initialisations only  
 */
async function main(): Promise<void> {
  await runSession();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
