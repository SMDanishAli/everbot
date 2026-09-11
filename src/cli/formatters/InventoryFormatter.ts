import { RobotInventoryCount } from '../../domain/repositories/IRobotRepository';

type InventoryDisplayRow = RobotInventoryCount & { total?: number };

export class InventoryFormatter {
  static format(inventory: InventoryDisplayRow[], title = 'Inventory'): string {
    const typeWidth = Math.max(
      'Robot type'.length,
      ...inventory.map(({ type }) => type.length),
    );
    const sourceWidth = Math.max(
      'Source'.length,
      ...inventory.map(({ source }) => source.length),
    );
    const numberWidth = Math.max(
      'Total'.length,
      'Available'.length,
      ...inventory.flatMap(({ total, available }) => [
        String(total ?? available).length,
        String(available).length,
      ]),
    );
    const separator = `+-${'-'.repeat(typeWidth)}-+-${'-'.repeat(sourceWidth)}-+-${'-'.repeat(numberWidth)}-+-${'-'.repeat(numberWidth)}-+`;
    const row = (type: string, source: string, total: string | number, available: string | number): string =>
      `| ${type.padEnd(typeWidth)} | ${source.padEnd(sourceWidth)} | ${String(total).padStart(numberWidth)} | ${String(available).padStart(numberWidth)} |`;

    return [
      `=== ${title} ===`,
      separator,
      row('Robot type', 'Source', 'Total', 'Available'),
      separator,
      ...inventory.map(({ type, source, total, available }) =>
        row(type, source, total ?? available, available),
      ),
      separator,
    ].join('\n');
  }
}
