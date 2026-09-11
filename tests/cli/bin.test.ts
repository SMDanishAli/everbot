const mockRunSession = jest.fn().mockResolvedValue(undefined);
const mockShowAllocations = jest.fn().mockResolvedValue(undefined);
const mockShowSummary = jest.fn().mockResolvedValue(undefined);
const mockResetInventory = jest.fn().mockResolvedValue(undefined);
const mockShowLogs = jest.fn();

jest.mock('../../src/cli/commandHandlers', () => ({
  runSession: mockRunSession,
  showAllocations: mockShowAllocations,
  showSummary: mockShowSummary,
  resetInventory: mockResetInventory,
  showLogs: mockShowLogs,
}));

describe('CLI command entrypoint', () => {
  const originalArgv = process.argv;
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.exitCode = undefined;
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
    jest.restoreAllMocks();
  });

  async function runCommand(...args: string[]): Promise<void> {
    process.argv = ['node', 'everbot', ...args];
    await import('../../src/cli/bin');
    await new Promise((resolve) => setImmediate(resolve));
  }

  it.each([
    ['run', 'runSession'],
    ['allocation', 'showAllocations'],
    ['summary', 'showSummary'],
    ['logs', 'showLogs'],
  ])('routes %s to %s', async (command, handler) => {
    await runCommand(command);

    expect(
      {
        runSession: mockRunSession,
        showAllocations: mockShowAllocations,
        showSummary: mockShowSummary,
        showLogs: mockShowLogs,
      }[
        handler
      ],
    ).toHaveBeenCalled();
  });

  it('passes --hard to reset', async () => {
    await runCommand('reset', '--hard');

    expect(mockResetInventory).toHaveBeenCalledWith(true);
  });

  it('passes false to reset without --hard', async () => {
    await runCommand('reset');

    expect(mockResetInventory).toHaveBeenCalledWith(false);
  });

  it.each([[], ['--help'], ['-h']])('prints usage for %s', async (...args) => {
    await runCommand(...args);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Usage: everbot <command>'));
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('init'));
  });

  it('reports unknown commands and sets a failure exit code', async () => {
    await runCommand('unknown');

    expect(console.error).toHaveBeenCalledWith('Unknown command: "unknown"\n');
    expect(process.exitCode).toBe(1);
  });

  it('reports fatal errors from command handlers', async () => {
    const exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    mockRunSession.mockRejectedValueOnce(new Error('startup failed'));

    await runCommand('run');

    expect(console.error).toHaveBeenCalledWith('Fatal error:', expect.any(Error));
    expect(exit).toHaveBeenCalledWith(1);
  });
});
