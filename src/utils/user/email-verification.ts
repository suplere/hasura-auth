import { ENV } from '../env';
import { generateTicket, generateTicketExpiresAt } from '../ticket';
import { insertUser } from './insert';
import { getGravatarUrl } from '../avatar';
import { UserRegistrationOptionsWithRedirect } from '@/types';
import { hashPassword } from '../password';
import { sendEmail } from '@/email';
import { getUserByEmail } from './getters';
import { Users_Set_Input } from '../__generated__/graphql-request';
import { gqlSdk } from '../gql-sdk';

export const sendEmailIfNotVerified = async (
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
  },
  force = false
) => {
  if (
    force ||
    (!ENV.AUTH_DISABLE_NEW_USERS &&
      ENV.AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED &&
      !user.emailVerified)
  ) {
    const ticket = user.ticket || generateTicket('emailVerify');
    const ticketExpiresAt = generateTicketExpiresAt(60 * 60);

    await gqlSdk.updateUser({
      id: user.id,
      user: {
        ticket,
        ticketExpiresAt,
      },
    });

    await sendEmail('emailVerify', {
      email,
      newEmail,
      redirectTo,
      ticket,
      user: { ...user, displayName: displayName || user.displayName || email },
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
    await sendEmailIfNotVerified({
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

  await sendEmailIfNotVerified({
    email,
    newEmail: user.newEmail,
    user,
    displayName,
    redirectTo,
  });

  return user;
};
