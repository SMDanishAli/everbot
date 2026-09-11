import { RobotTypeRegistry } from '../../../src/infrastructure/config/RobotTypeRegistry';

describe('RobotTypeRegistry', () => {
  const registry = new RobotTypeRegistry([
    { name: 'Bravo', hours: 3, chargingCost: 2 },
    { name: 'Delta', hours: 8, chargingCost: 4 },
  ]);

  it('returns all configured robot types', () => {
    expect(registry.all().map((type) => type.name)).toEqual(['Bravo', 'Delta']);
  });

  it('returns a configured type by name', () => {
    expect(registry.get('Bravo')).toMatchObject({ name: 'Bravo', hours: 3, chargingCost: 2 });
  });

  it('throws for an unknown type', () => {
    expect(() => registry.get('Unknown')).toThrow(
      'Unknown robot type: "Unknown". Check config.yaml.',
    );
  });
});
