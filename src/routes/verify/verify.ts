import { RequestHandler } from 'express';
import { generateRedirectUrl, pgClient } from '@/utils';
import { Joi, redirectTo } from '@/validation';
import { sendError } from '@/errors';
import { EmailType, EMAIL_TYPES, User } from '@/types';

export const verifySchema = Joi.object({
  redirectTo: redirectTo.required(),
  ticket: Joi.string().required(),
  type: Joi.string()
    .allow(...Object.values(EMAIL_TYPES))
    .required(),
}).meta({ className: 'VerifySchema' });

export const verifyHandler: RequestHandler<
  {},
  {},
  {},
  {
    ticket: string;
    type: EmailType;
    redirectTo: string;
  }
> = async (req, res) => {
  const { ticket, type, redirectTo } = req.query;

  // get the user from the ticket
  const user = await pgClient.getUserByTicket(ticket);

  if (!user) {
    return sendError(res, 'invalid-ticket', { redirectTo }, true);
  }

  const updates: Partial<User> = {
    // user found, delete current ticket
    ticket: null,
  };

  // different types
  if (type === EMAIL_TYPES.VERIFY) {
    updates.emailVerified = true;
  } else if (type === EMAIL_TYPES.CONFIRM_CHANGE) {
    const newEmail = user.newEmail;
    if (!newEmail) {
      return sendError(res, 'invalid-ticket', { redirectTo }, true);
    }
    // * Send an error if the new email is already used by another user
    // * This check is also done when requesting a new email, but is done again here as
    // * an account with `newEmail` as an email could have been created since the email change occurred
    if (await pgClient.getUserByEmail(newEmail)) {
      return sendError(res, 'email-already-in-use', { redirectTo }, true);
    }
    // set new email for user
    updates.email = newEmail;
    updates.newEmail = null;
  } else if (type === EMAIL_TYPES.SIGNIN_PASSWORDLESS) {
    updates.emailVerified = true;
  } else if (type === EMAIL_TYPES.PASSWORD_RESET) {
    // noop
    // just redirecting the user to the client (as signed-in).
  }

  await pgClient.updateUser({
    id: user.id,
    user: updates,
  });

  const refreshToken = await pgClient.insertRefreshToken(user.id);
  const redirectUrl = generateRedirectUrl(redirectTo, { refreshToken, type });

  return res.redirect(redirectUrl);
};
