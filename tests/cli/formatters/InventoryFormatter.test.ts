import { RobotSource } from '../../../src/domain/entities/Robot';
import { InventoryFormatter } from '../../../src/cli/formatters/InventoryFormatter';

describe('InventoryFormatter', () => {
  it('formats totals, used counts, costs, and utilization', () => {
    const output = InventoryFormatter.format(
      [
        {
          type: 'Bravo',
          source: RobotSource.ACTIVE,
          available: 3,
          total: 5,
          chargingCost: 4,
          utilization: 40,
        },
      ],
      'Current Resources',
    );

    expect(output).toContain('=== Current Resources ===');
    expect(output).toContain('Robot type');
    expect(output).toContain('Bravo');
    expect(output).toContain('ACTIVE');
    expect(output).toContain('$4.00');
    expect(output).toContain('40.0%');
    expect(output).toContain('|    2 |');
  });

  it('uses available counts and default display values when optional fields are absent', () => {
    const output = InventoryFormatter.format([
      { type: 'Delta', source: RobotSource.STANDBY, available: 2 },
    ]);

    expect(output).toContain('=== Inventory ===');
    expect(output).toContain('Delta');
    expect(output).toContain('STANDBY');
    expect(output).toContain('$0.00');
    expect(output).toContain('0.0%');
  });

  it('formats an empty inventory with header-based column widths', () => {
    const output = InventoryFormatter.format([]);

    expect(output).toContain('=== Inventory ===');
    expect(output).toContain('Robot type');
    expect(output).toContain('Charging Cost');
    expect(output).toContain('Utilisation');
  });
});
