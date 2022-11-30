import { RequestHandler } from 'express';
import { ReasonPhrases } from 'http-status-codes';

import {
  gqlSdk,
  generateTicketExpiresAt,
  getUserByEmail,
  generateTicket,
} from '@/utils';
import { sendEmail } from '@/email';
import { Joi, email, redirectTo } from '@/validation';
import { sendError } from '@/errors';

export const userEmailChangeSchema = Joi.object({
  newEmail: email,
  options: Joi.object({
    redirectTo,
  }).default(),
}).meta({ className: 'UserEmailChangeSchema' });

export const userEmailChange: RequestHandler<
  {},
  {},
  {
    newEmail: string;
    options: {
      redirectTo: string;
    };
  }
> = async (req, res) => {
  const {
    newEmail,
    options: { redirectTo },
  } = req.body;

  const { userId } = req.auth as RequestAuth;

  const ticket = generateTicket('emailConfirmChange');
  const ticketExpiresAt = generateTicketExpiresAt(60 * 60); // 1 hour

  // * Send an error if the new email is already used by another user
  if (await getUserByEmail(newEmail)) {
    return sendError(res, 'email-already-in-use');
  }

  // set newEmail for user
  const updatedUserResponse = await gqlSdk.updateUser({
    id: userId,
    user: {
      ticket,
      ticketExpiresAt,
      newEmail,
    },
  });

  const user = updatedUserResponse.updateUser;

  if (!user) {
    return sendError(res, 'user-not-found');
  }

  if (user.isAnonymous) {
    return sendError(res, 'forbidden-anonymous');
  }

  await sendEmail('emailConfirmChange', {
    newEmail,
    email: user.email,
    redirectTo,
    ticket,
    user,
  });

  return res.json(ReasonPhrases.OK);
};
