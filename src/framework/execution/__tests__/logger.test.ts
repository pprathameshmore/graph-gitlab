import { createIntegrationLogger } from '../logger';
import Logger from 'bunyan';
import { IntegrationInvocationConfig } from '../types';

const invocationConfig = {} as IntegrationInvocationConfig;
const loggerName = 'integration-logger';

describe('logger.trace', () => {
  test('includes verbose: true for downstream verbose log pruning', () => {
    const integrationLogger = createIntegrationLogger(
      loggerName,
      invocationConfig,
    );
    const stream = (integrationLogger as any).streams[0]
      .stream as Logger.RingBuffer;

    integrationLogger.trace();
    expect(stream.records).toEqual([]);

    integrationLogger.trace({ stuff: 'yo!' }, 'Me message');
    integrationLogger.trace(Error('Yo!'), 'Me message');
    integrationLogger.trace('formatit', 'Me message');

    expect(stream.records).toEqual([
      expect.objectContaining({
        stuff: 'yo!',
        verbose: true,
        msg: 'Me message',
      }),
      expect.objectContaining({
        err: expect.objectContaining({
          message: 'Yo!',
        }),
        verbose: true,
        msg: 'Me message',
      }),
      expect.objectContaining({
        verbose: true,
        msg: 'formatit Me message',
      }),
    ]);
  });

  test('logger.child.trace', () => {
    const integrationLogger = createIntegrationLogger(
      loggerName,
      invocationConfig,
    );
    const childLogger = integrationLogger.child({
      mostuff: 'smile',
    });
    const stream = (childLogger as any).streams[0].stream as Logger.RingBuffer;

    integrationLogger.trace();
    childLogger.trace();
    expect(stream.records).toEqual([]);

    integrationLogger.trace({ stuff: 'parents right?' }, 'Dad joke');
    childLogger.trace({ stuff: 'yo!' }, 'Me message');
    expect(stream.records).toEqual([
      expect.objectContaining({
        stuff: 'parents right?',
        verbose: true,
        msg: 'Dad joke',
      }),
      expect.objectContaining({
        stuff: 'yo!',
        mostuff: 'smile',
        verbose: true,
        msg: 'Me message',
      }),
    ]);
    expect(stream.records[0].mostuff).toBeUndefined();
  });
});

describe('createIntegrationLogger', () => {
  let addSerializers: jest.Mock;

  beforeEach(() => {
    addSerializers = jest.fn();
    jest.spyOn(Logger, 'createLogger').mockReturnValue(({
      addSerializers,
    } as unknown) as Logger);
  });

  test('installs expected properties', async () => {
    createIntegrationLogger(loggerName, invocationConfig);

    expect(Logger.createLogger).toHaveBeenCalledWith({
      name: 'integration-logger',
      level: 'info',
      serializers: {
        err: Logger.stdSerializers.err,
      },
    });
  });

  test('adds provided serializers', () => {
    createIntegrationLogger(loggerName, invocationConfig, {});
    expect(addSerializers).toHaveBeenLastCalledWith({});
  });

  describe('integrationInstanceConfig serializer', () => {
    test('is a function', () => {
      createIntegrationLogger(loggerName, invocationConfig);

      expect(addSerializers).toHaveBeenNthCalledWith(1, {
        integrationInstanceConfig: expect.any(Function),
        instance: expect.any(Function),
      });
    });

    test('handles undefined config', () => {
      createIntegrationLogger(loggerName, invocationConfig);
      const serializer = addSerializers.mock.calls[0][0]
        .integrationInstanceConfig as Function;
      expect(serializer(undefined)).toEqual(undefined);
    });

    test('handles null config', () => {
      createIntegrationLogger(loggerName, invocationConfig);
      const serializer = addSerializers.mock.calls[0][0]
        .integrationInstanceConfig as Function;

      expect(serializer(null)).toEqual(null);
    });

    test('masks everything when field metadata not provided', () => {
      createIntegrationLogger(loggerName, invocationConfig);
      const serializer = addSerializers.mock.calls[0][0]
        .integrationInstanceConfig as Function;

      expect(serializer({ anything: 'bob', everything: 'jane' })).toEqual({
        anything: '***',
        everything: '***',
      });
    });

    test('shows unmasked data', () => {
      createIntegrationLogger(loggerName, {
        ...invocationConfig,
        instanceConfigFields: {
          masked: {
            mask: true,
          },
          unmasked: {
            mask: false,
          },
        },
      });
      const serializer = addSerializers.mock.calls[0][0]
        .integrationInstanceConfig as Function;

      expect(
        serializer({
          anything: 'bob',
          masked: 'this is secret',
          unmasked: 'this is clear',
        }),
      ).toEqual({
        anything: '***',
        masked: '****cret',
        unmasked: 'this is clear',
      });
    });
  });
});
