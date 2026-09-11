jest.mock('@clack/prompts', () => ({
  cancel: jest.fn(),
  isCancel: jest.fn(),
  select: jest.fn(),
}));

jest.mock('readline', () => ({
  createInterface: jest.fn(),
}));

import { cancel, isCancel, select } from '@clack/prompts';
import { createInterface } from 'readline';
import { prompt, selectPrompt } from '../../src/cli/prompts';

describe('CLI prompts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('trims text input and closes the readline interface', async () => {
    const close = jest.fn();
    (createInterface as jest.Mock).mockReturnValue({
      close,
      question: (_question: string, callback: (answer: string) => void) => callback('  12  '),
    });

    await expect(prompt('Hours: ')).resolves.toBe('12');
    expect(close).toHaveBeenCalled();
  });

  it('returns the selected value', async () => {
    (select as jest.Mock).mockResolvedValue('L2');
    (isCancel as unknown as jest.Mock).mockReturnValue(false);

    await expect(
      selectPrompt('Strategy', [{ label: 'L2', value: 'L2' }]),
    ).resolves.toBe('L2');
    expect(select).toHaveBeenCalledWith({
      message: 'Strategy',
      options: [{ label: 'L2', value: 'L2' }],
    });
    expect(cancel).not.toHaveBeenCalled();
  });

  it('cancels and returns an empty value when selection is cancelled', async () => {
    (select as jest.Mock).mockResolvedValue(Symbol('cancelled'));
    (isCancel as unknown as jest.Mock).mockReturnValue(true);

    await expect(selectPrompt('Strategy', [])).resolves.toBe('');
    expect(cancel).toHaveBeenCalledWith('Operation cancelled.');
  });
});
