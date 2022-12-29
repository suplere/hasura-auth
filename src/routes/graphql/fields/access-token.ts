import { getSignInResponse } from '@/utils';
import { ObjectFieldThunk } from '@pothos/core';
import { builder } from '../builder';
import { Context } from '../context';

import '../errors';

export const AccessToken = builder
  .objectRef<{ value: string; expiresInSeconds: number }>('AccessToken')
  .implement({
    description: 'JSON Web Token',
    fields: (t) => ({
      value: t.exposeString('value', {
        nullable: false,
      }),
      expiresInSeconds: t.exposeInt('expiresInSeconds', { nullable: false }),
    }),
  });

export const accessTokenFieldThunk: ObjectFieldThunk<
  PothosSchemaTypes.ExtendDefaultTypes<{
    Context: Context;
  }>,
  { userId: string | null }
> = (t) =>
  t.field({
    nullable: true,
    type: AccessToken,
    resolve: async ({ userId }, _, _context) => {
      if (!userId) {
        return null;
      }
      // if (!ENV.AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED) {
      const signInResponse = await getSignInResponse({
        userId,
        checkMFA: false,
      });
      const token = signInResponse.session?.accessToken!;
      // context.res.setHeader('Authorization', `Bearer ${token}`);
      return {
        value: token,
        expiresInSeconds: signInResponse.session?.accessTokenExpiresIn!,
      };
      // }
      return null;
    },
  });
