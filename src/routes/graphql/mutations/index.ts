import { ZodError } from 'zod';
import { ENV, getNewRefreshToken, getUserByEmail } from '@/utils';
import { builder } from '../builder';

import { createUserAndSendVerificationEmail } from '@/utils/user/email-verification';
import { StandardError } from '../errors';
import { redirectTo } from '../validation';
import { setCookie } from '../cookies';
import { SignUpEmailPasswordPayload } from './sign-up';

builder.mutationType({
  fields: (t) => ({
    signUpEmailPassword: t.field({
      type: SignUpEmailPasswordPayload,
      errors: {
        types: [ZodError, StandardError],
      },

      args: {
        email: t.arg.string({ required: true, validate: { email: true } }),
        password: t.arg.string({ required: true }),
        locale: t.arg.string(),
        allowedRoles: t.arg.stringList(),
        defaultRole: t.arg.string(),
        displayName: t.arg.string(),
        //   metadata: Metadata; // TODO
        redirectTo: t.arg.string({
          validate: {
            schema: redirectTo,
          },
        }),
      },
      resolve: async (
        _parent,
        {
          email,
          password,
          locale,
          allowedRoles,
          defaultRole,
          displayName,
          redirectTo,
        },
        context
      ) => {
        if (await getUserByEmail(email)) {
          throw new StandardError('email-already-in-use');
        }

        const user = await createUserAndSendVerificationEmail(
          email,
          {
            locale: locale || ENV.AUTH_LOCALE_DEFAULT,
            allowedRoles: allowedRoles || ENV.AUTH_USER_DEFAULT_ALLOWED_ROLES,
            defaultRole: defaultRole || ENV.AUTH_USER_DEFAULT_ROLE,
            displayName: displayName || email,
            redirectTo: redirectTo || ENV.AUTH_CLIENT_URL,
            metadata: {},
          },
          password
        );
        const refreshToken = await getNewRefreshToken(user.id);
        setCookie(context, { userId: user.id, refreshToken });
        return {
          userId: user.id,
        };
      },
    }),
  }),
});
