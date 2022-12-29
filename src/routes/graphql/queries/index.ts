import { builder } from '../builder';
import cookie from 'cookie';
import { NHOST_COOKIE } from '../cookies';
import {
  gqlSdk,
  getNewOrUpdateCurrentSession,
  updateRefreshTokenExpiry,
} from '@/utils';
import { StandardError } from '../errors';
import { AccessToken } from '../fields';

builder.queryType({
  fields: (t) => ({
    accessToken: t.field({
      errors: {
        types: [StandardError],
      },
      type: AccessToken,
      resolve: async (_, __, context) => {
        const cookieHeader = context.request.headers.get('Cookie');
        if (!cookieHeader) {
          throw new StandardError('invalid-refresh-token', 'No cookie header');
        }

        const { refreshToken } = JSON.parse(
          cookie.parse(cookieHeader)[NHOST_COOKIE]
        ) as { refreshToken: string; userId: string };

        const user = (
          await gqlSdk.getUsersByRefreshTokenOld({
            refreshToken,
          })
        ).authRefreshTokens[0]?.user;

        if (!user) {
          throw new StandardError('invalid-refresh-token');
        }

        if (user.disabled) {
          throw new StandardError('disabled-user');
        }

        // * Update refresh token expiry
        await updateRefreshTokenExpiry(refreshToken);

        const session = await getNewOrUpdateCurrentSession({
          user,
          currentRefreshToken: refreshToken,
        });

        return {
          value: session.accessToken,
          expiresInSeconds: session.accessTokenExpiresIn,
        };
      },
    }),
  }),
});
