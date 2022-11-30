import { RequestHandler } from 'express';
import { ReasonPhrases } from 'http-status-codes';

import { sendEmail } from '@/email';
import {
  gqlSdk,
  getUserByEmail,
  generateTicketExpiresAt,
  generateTicket,
} from '@/utils';
import { sendError } from '@/errors';
import { Joi, email, redirectTo } from '@/validation';

export const userPasswordResetSchema = Joi.object({
  email: email.required(),
  options: Joi.object({
    redirectTo,
  }).default(),
}).meta({ className: 'UserPasswordResetSchema' });

export const userPasswordResetHandler: RequestHandler<
  {},
  {},
  {
    email: string;
    options: {
      redirectTo: string;
    };
  }
> = async (req, res) => {
  const {
    email,
    options: { redirectTo },
  } = req.body;
  const user = await getUserByEmail(email);

  if (!user || user.disabled) {
    return sendError(res, 'user-not-found');
  }

  const ticket = generateTicket('passwordReset');
  const ticketExpiresAt = generateTicketExpiresAt(60 * 60); // 1 hour

  await gqlSdk.updateUser({
    id: user.id,
    user: {
      ticket,
      ticketExpiresAt,
    },
  });

  await sendEmail('passwordReset', {
    email,
    user,
    redirectTo,
    ticket,
  });

  return res.json(ReasonPhrases.OK);
};
