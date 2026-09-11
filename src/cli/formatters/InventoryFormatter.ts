import { RobotInventoryCount } from '../../domain/repositories/IRobotRepository';

export class InventoryFormatter {
  static format(inventory: RobotInventoryCount[], title = 'Inventory'): string {
    const typeWidth = Math.max(
      'Robot type'.length,
      ...inventory.map(({ type }) => type.length),
    );
    const sourceWidth = Math.max(
      'Source'.length,
      ...inventory.map(({ source }) => source.length),
    );
    const countWidth = Math.max(
      'Available'.length,
      ...inventory.map(({ available }) => String(available).length),
    );
    const separator = `+-${'-'.repeat(typeWidth)}-+-${'-'.repeat(sourceWidth)}-+-${'-'.repeat(countWidth)}-+`;
    const row = (type: string, source: string, available: string | number): string =>
      `| ${type.padEnd(typeWidth)} | ${source.padEnd(sourceWidth)} | ${String(available).padStart(countWidth)} |`;

    return [
      `=== ${title} ===`,
      separator,
      row('Robot type', 'Source', 'Available'),
      separator,
      ...inventory.map(({ type, source, available }) => row(type, source, available)),
      separator,
    ].join('\n');
  }
}
