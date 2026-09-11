export interface LogRecord {
  level?: number;
  time?: string;
  msg?: string;
  [key: string]: unknown;
}

const levelNames: Record<number, string> = {
  10: 'TRACE',
  20: 'DEBUG',
  30: 'INFO',
  40: 'WARN',
  50: 'ERROR',
  60: 'FATAL',
};

export class LogsFormatter {
  static format(records: LogRecord[]): string {
    const lines = ['=== Everbot Logs ===', ''];

    for (const record of records) {
      const level = levelNames[record.level ?? 30] ?? `LEVEL ${record.level ?? 'UNKNOWN'}`;
      const timestamp = record.time ? new Date(record.time).toLocaleString() : 'Unknown time';
      const metadata = Object.entries(record)
        .filter(([key]) => !['level', 'time', 'msg', 'pid', 'hostname'].includes(key))
        .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
        .join(' ');

      lines.push(`[${timestamp}] ${level.padEnd(5)} ${record.msg ?? ''}${metadata ? ` (${metadata})` : ''}`);
    }

    return lines.join('\n');
  }
}
