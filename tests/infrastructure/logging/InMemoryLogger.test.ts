import { InMemoryLogger } from '../../../src/infrastructure/logging/InMemoryLogger';

describe('InMemoryLogger', () => {
  it('captures log messages and metadata by level', () => {
    const logger = new InMemoryLogger();

    logger.info('started');
    logger.warn('warning', { count: 1 });
    logger.error('failed', { code: 'ERR' });
    logger.warn('default metadata');
    logger.error('default metadata');

    expect(logger.entries).toEqual([
      { level: 'info', message: 'started', meta: {} },
      { level: 'warn', message: 'warning', meta: { count: 1 } },
      { level: 'error', message: 'failed', meta: { code: 'ERR' } },
      { level: 'warn', message: 'default metadata', meta: {} },
      { level: 'error', message: 'default metadata', meta: {} },
    ]);
  });
});
