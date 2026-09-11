import { LogsFormatter } from '../../../src/cli/formatters/LogsFormatter';

describe('LogsFormatter', () => {
  it('formats timestamps, known levels, messages, and metadata', () => {
    const output = LogsFormatter.format([
      {
        time: '2026-01-01T00:00:00.000Z',
        level: 40,
        msg: 'Allocation rejected',
        code: 'ZERO_ROBOTS',
        count: 2,
        pid: 10,
        hostname: 'host',
      },
    ]);

    expect(output).toContain('=== Everbot Logs ===');
    expect(output).toContain('WARN');
    expect(output).toContain('Allocation rejected');
    expect(output).toContain('code=ZERO_ROBOTS');
    expect(output).toContain('count=2');
    expect(output).not.toContain('pid=10');
    expect(output).not.toContain('hostname=host');
  });

  it('handles missing values and unknown levels', () => {
    const output = LogsFormatter.format([{ level: 99 }, { msg: 'Default level' }]);

    expect(output).toContain('LEVEL 99');
    expect(output).toContain('Unknown time');
    expect(output).toContain('INFO  Default level');
  });

  it('formats every supported log level and nullish level fallback', () => {
    const output = LogsFormatter.format([
      { level: 10, msg: 'trace' },
      { level: 20, msg: 'debug' },
      { level: 30, msg: 'info' },
      { level: 40, msg: 'warn' },
      { level: 50, msg: 'error' },
      { level: 60, msg: 'fatal' },
      { level: null as unknown as number, msg: 'unknown' },
    ]);

    expect(output).toContain('TRACE trace');
    expect(output).toContain('DEBUG debug');
    expect(output).toContain('INFO  info');
    expect(output).toContain('WARN  warn');
    expect(output).toContain('ERROR error');
    expect(output).toContain('FATAL fatal');
    expect(output).toContain('INFO  unknown');
  });
});
