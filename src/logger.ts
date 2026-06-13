import { pino } from 'pino';
import { config } from './config.js';

const isDev = config.logLevel === 'debug' || config.logLevel === 'trace';

export const logger = pino({
  level: config.logLevel,
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});