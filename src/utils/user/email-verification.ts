import { ENV } from '../env';
import { generateTicketExpiresAt } from '../ticket';
import { v4 as uuidv4 } from 'uuid';
import { insertUser } from './insert';
import { getGravatarUrl } from '../avatar';
import { EMAIL_TYPES, UserRegistrationOptionsWithRedirect } from '@/types';
import { hashPassword } from '../password';
import { emailClient } from '@/email';
import { createEmailRedirectionLink } from '../redirect';
import { getUserByEmail } from './getters';
import { Users_Set_Input } from '../__generated__/graphql-request';
import { gqlSdk } from '../gql-sdk';

export const sendEmailIfNotVerified = async (
  template: string,
  {
    newEmail,
    email = newEmail,
    user,
    displayName,
    redirectTo,
  }: {
    email?: string;
    newEmail: string;
    user: Users_Set_Input;
    displayName: string;

    redirectTo: string;
  }
) => {
  if (
    !ENV.AUTH_DISABLE_NEW_USERS &&
    ENV.AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED &&
    !user.emailVerified
  ) {
    const ticket = user.ticket || `${template}:${uuidv4()}`;
    const ticketExpiresAt = generateTicketExpiresAt(60 * 60);

    await gqlSdk.updateUser({
      id: user.id,
      user: {
        ticket,
        ticketExpiresAt,
      },
    });

    const link = createEmailRedirectionLink(
      EMAIL_TYPES.VERIFY,
      ticket,
      redirectTo
    );
    await emailClient.send({
      template,
      message: {
        to: email,
        headers: {
          /** @deprecated */
          'x-ticket': {
            prepared: true,
            value: ticket,
          },
          /** @deprecated */
          'x-redirect-to': {
            prepared: true,
            value: redirectTo,
          },
          'x-email-template': {
            prepared: true,
            value: template,
          },
          'x-link': {
            prepared: true,
            value: link,
          },
        },
      },
      locals: {
        link,
        displayName,
        email,
        newEmail: newEmail,
        ticket,
        redirectTo: encodeURIComponent(redirectTo),
        locale: user?.locale || ENV.AUTH_LOCALE_DEFAULT,
        serverUrl: ENV.AUTH_SERVER_URL,
        clientUrl: ENV.AUTH_CLIENT_URL,
      },
    });
  }
};

export const createUserAndSendVerificationEmail = async (
  email: string,
  options: UserRegistrationOptionsWithRedirect,
  password?: string
) => {
  const {
    redirectTo,
    locale,
    defaultRole,
    allowedRoles,
    metadata,
    displayName = email,
  } = options;

  const existingUser = await getUserByEmail(email);

  if (existingUser) {
    await sendEmailIfNotVerified('email-verify', {
      email,
      newEmail: email,
      user: existingUser,
      displayName,
      redirectTo,
    });

    return existingUser;
  }

  // hash password
  const passwordHash = password && (await hashPassword(password));

  // insert user
  const user = await insertUser({
    disabled: ENV.AUTH_DISABLE_NEW_USERS,
    displayName,
    avatarUrl: getGravatarUrl(email),
    email,
    passwordHash,
    emailVerified: false,
    locale,
    defaultRole,
    roles: {
      // restructure user roles to be inserted in GraphQL mutation
      data: allowedRoles.map((role: string) => ({ role })),
    },
    metadata,
  });

  await sendEmailIfNotVerified('email-verify', {
    email,
    newEmail: user.newEmail,
    user,
    displayName,
    redirectTo,
  });

  return user;
};
