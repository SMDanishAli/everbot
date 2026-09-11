import { RobotType } from '../../../src/domain/entities/RobotType';

describe('RobotType', () => {
  it('compares robot types by name', () => {
    const bravo = new RobotType('Bravo', 3, 2);

    expect(bravo.equals(new RobotType('Bravo', 8, 4))).toBe(true);
    expect(bravo.equals(new RobotType('Delta', 3, 2))).toBe(false);
  });
});
