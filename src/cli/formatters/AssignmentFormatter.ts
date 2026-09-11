import { AllocationResult } from '../../domain/entities/AllocationResult';

export class AssignmentFormatter {
  static format(result: AllocationResult, strategyName: string): string {
    const counts = new Map<string, number>();
    for (const robot of result.assignedRobots) {
      counts.set(robot.type.name, (counts.get(robot.type.name) ?? 0) + 1);
    }

    const robotUsage = Array.from(counts.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([type, count]) => `${type} (${count})`)
      .join(', ');
    const rows: string[][] = [
      ['Strategy', strategyName, ''],
      ['Hours requested', String(result.hoursRequested), ''],
      ['Robots used', robotUsage || 'None', 'blue'],
      ['Total hours provided', String(result.totalHoursProvided), ''],
      ['Total cost', `$${result.totalCost}`, 'green'],
    ];
    if (result.excessHours > 0) {
      rows.splice(4, 0, ['Excess hours', String(result.excessHours), 'red']);
    }
    const labelWidth = Math.max(...rows.map(([label]) => label.length));
    const valueWidth = Math.max(...rows.map(([, value]) => value.length));
    const separator = `+${'-'.repeat(labelWidth + 2)}+${'-'.repeat(valueWidth + 2)}+`;
    const color = (value: string, name: string): string => {
      if (!process.stdout.isTTY) return value;
      const codes: Record<string, string> = { blue: '34', green: '32', red: '31' };
      return codes[name] ? `\x1b[${codes[name]}m${value}\x1b[0m` : value;
    };
    const row = ([label, value, colorName]: string[]): string =>
      `| ${label.padEnd(labelWidth)} | ${color(value.padEnd(valueWidth), colorName)} |`;

    return [
      `=== Allocation Result ===`,
      separator,
      row(rows[0]),
      separator,
      ...rows.slice(1).map(row),
      separator,
    ].join('\n');
  }
}
