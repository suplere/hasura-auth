import { Router } from 'express';
import { createYoga } from 'graphql-yoga';
import { builder } from './builder';
import { Context } from './context';

import './errors';
import './queries';
import './mutations';

const graphqlRouter = Router();

const yoga = createYoga<Context>({
  cors: (req, { res }) => {
    const setCookie = req.headers.get('Set-Cookie');
    if (setCookie) {
      res.setHeader('Set-Cookie', setCookie.split(','));
    }
    return false;
  },
  schema: builder.toSchema(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
graphqlRouter.use('/graphql', yoga as any);

export { graphqlRouter };
