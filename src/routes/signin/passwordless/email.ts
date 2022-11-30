import { RequestHandler } from 'express';
import { ReasonPhrases } from 'http-status-codes';

import {
  gqlSdk,
  getUserByEmail,
  insertUser,
  getGravatarUrl,
  generateTicketExpiresAt,
  ENV,
  generateTicket,
} from '@/utils';
import { sendEmail } from '@/email';
import { UserRegistrationOptionsWithRedirect } from '@/types';
import { sendError } from '@/errors';
import { Joi, email, registrationOptions } from '@/validation';

export type PasswordLessEmailRequestBody = {
  email: string;
  options: UserRegistrationOptionsWithRedirect;
};

export const signInPasswordlessEmailSchema =
  Joi.object<PasswordLessEmailRequestBody>({
    email: email.required(),
    options: registrationOptions,
  }).meta({ className: 'SignInPasswordlessEmailSchema' });

export const signInPasswordlessEmailHandler: RequestHandler<
  {},
  {},
  PasswordLessEmailRequestBody
> = async (req, res) => {
  if (!ENV.AUTH_EMAIL_PASSWORDLESS_ENABLED) {
    return sendError(res, 'disabled-endpoint');
  }

  const {
    email,
    options: {
      redirectTo,
      defaultRole,
      allowedRoles,
      displayName,
      locale,
      metadata,
    },
  } = req.body;

  // check if email already exist
  let user = await getUserByEmail(email);

  // if no user exists, create the user
  if (!user) {
    user = await insertUser({
      displayName: displayName ?? email,
      locale,
      roles: {
        // restructure user roles to be inserted in GraphQL mutation
        data: allowedRoles.map((role: string) => ({ role })),
      },
      disabled: ENV.AUTH_DISABLE_NEW_USERS,
      avatarUrl: getGravatarUrl(email),
      email,
      defaultRole,
      metadata,
    });
  }

  if (user?.disabled) {
    return sendError(res, 'disabled-user');
  }

  // create ticket
  const ticket = generateTicket('signinPasswordless');
  const ticketExpiresAt = generateTicketExpiresAt(60 * 60);

  await gqlSdk.updateUser({
    id: user.id,
    user: {
      ticket,
      ticketExpiresAt,
    },
  });

  await sendEmail('signinPasswordless', {
    email,
    ticket,
    redirectTo,
    user,
  });

  return res.json(ReasonPhrases.OK);
};
