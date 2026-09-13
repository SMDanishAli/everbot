import { AllocationResult } from '../../domain/entities/AllocationResult';
import { RobotSource } from '../../domain/entities/Robot';

export class AssignmentFormatter {
  static format(result: AllocationResult, strategyName: string): string {
    const activeCounts = new Map<string, number>();
    const standbyCounts = new Map<string, number>();
    let activeRobotCapacity = 0;
    for (const robot of result.assignedRobots) {
      if (robot.source == RobotSource.ACTIVE) {
        activeRobotCapacity += robot.workingHours;
        activeCounts.set(robot.type.name, (activeCounts.get(robot.type.name) ?? 0) + 1);
      }
      else if (robot.source == RobotSource.STANDBY) {
        standbyCounts.set(robot.type.name, (standbyCounts.get(robot.type.name) ?? 0) + 1);
      }
    }

    const activeRobotUsage = Array.from(activeCounts.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([type, count]) => `${type} (${count})`)
      .join(', ');
    const standByRobotUsage = Array.from(standbyCounts.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([type, count]) => `${type} (${count})`)
      .join(', ');

    const emptyArr = ['','','',''];

    const rows: string[][] = [
      ['Strategy', strategyName, ''],
      ['Hours requested', String(result.hoursRequested), ''],
      ( result.hoursRequested > activeRobotCapacity ? ['Active Robots Capacity', `${activeRobotCapacity} hours`, 'blue'] : emptyArr),
      ['Active Robots used', activeRobotUsage || 'None', 'blue'],
      (standbyCounts.size > 0 ? ['Standby Robots used', standByRobotUsage || 'None', 'orange'] : emptyArr),
      ['Total hours provided', String(result.totalHoursProvided), ''],
      ['Total cost', `$${result.totalCost}`, 'green'],
    ].filter(f=> f.length && f?.[0].length);
    if (result.excessHours > 0) {
      rows.splice(4, 0, ['Excess hours', String(result.excessHours), 'red']);
    }
    const labelWidth = Math.max(...rows.map(([label]) => label?.length||0));
    const valueWidth = Math.max(...rows.map(([, value]) => value?.length||0));
    const separator = `+${'-'.repeat(labelWidth + 2)}+${'-'.repeat(valueWidth + 2)}+`;
    const color = (value: string, name: string): string => {
      if (!process.stdout.isTTY) return value;
      const codes: Record<string, string> = { blue: '34', green: '32', red: '31', orange: '33' };
      return codes[name] ? `\x1b[${codes[name]}m${value}\x1b[0m` : value;
    };
    const row = ([label, value, colorName]: string[]): string =>
      `| ${label.padEnd(labelWidth)} | ${color(value.padEnd(valueWidth), colorName)} |`;

    return [
      separator,
      row(rows[0]),
      separator,
      ...rows.slice(1).map(row),
      separator,
    ].join('\n');
  }
}
