import type { YogaInitialContext } from 'graphql-yoga';
import { IncomingMessage, ServerResponse } from 'http';

export type Context = YogaInitialContext & {
  req: IncomingMessage;
  res: ServerResponse;
};
