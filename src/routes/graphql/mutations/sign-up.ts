import { builder } from '../builder';

import { accessTokenFieldThunk } from '../fields';

export const SignUpEmailPasswordPayload = builder
  .objectRef<{
    userId: string | null;
  }>('SignUpPayload')
  .implement({
    description: 'Payload for signUpEmailPassword mutation',
    fields: (t) => ({
      userId: t.exposeString('userId', { nullable: true }),
    }),
  });

builder.objectField(
  SignUpEmailPasswordPayload,
  'accessToken',
  accessTokenFieldThunk
);
