import { RobotInventoryCount } from '../../domain/repositories/IInventoryProvider';

type InventoryDisplayRow = RobotInventoryCount & {
  total?: number;
  chargingCost?: number;
  utilization?: number;
};

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
    const totalWidth = Math.max(
      'Total'.length,
      ...inventory.map(({ total, available }) => String(total ?? available).length),
    );
    const usedWidth = Math.max(
      'Used'.length,
      ...inventory.map(({ total, available }) => String((total ?? available) - available).length),
    );
    const costWidth = Math.max(
      'Charging Cost'.length,
      ...inventory.map(({ chargingCost = 0 }) => `$${chargingCost.toFixed(2)}`.length),
    );
    const utilizationWidth = Math.max(
      'Avg Utilisation'.length,
      ...inventory.map(({ utilization = 0 }) => `${utilization.toFixed(1)}%`.length),
    );
    const separator = `+-${'-'.repeat(typeWidth)}-+-${'-'.repeat(sourceWidth)}-+-${'-'.repeat(totalWidth)}-+-${'-'.repeat(usedWidth)}-+-${'-'.repeat(costWidth)}-+-${'-'.repeat(utilizationWidth)}-+`;
    const row = (
      type: string,
      source: string,
      total: string | number,
      used: string | number,
      chargingCost: string | number,
      utilization: string | number,
    ): string =>
      `| ${type.padEnd(typeWidth)} | ${source.padEnd(sourceWidth)} | ${String(total).padStart(totalWidth)} | ${String(used).padStart(usedWidth)} | ${String(chargingCost).padStart(costWidth)} | ${String(utilization).padStart(utilizationWidth)} |`;

    return [
      `=== ${title} ===`,
      separator,
      row('Robot type', 'Source', 'Total', 'Used', 'Charging Cost', 'Utilisation'),
      separator,
      ...inventory.map(({ type, source, total, available, chargingCost = 0, utilization = 0 }) =>
        row(
          type,
          source,
          total ?? available,
          (total ?? available) - available,
          `$${chargingCost.toFixed(2)}`,
          `${utilization.toFixed(1)}%`,
        ),
      ),
      separator,
    ].join('\n');
  }
}
