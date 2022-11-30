import { RequestHandler } from 'express';
import { ReasonPhrases } from 'http-status-codes';

import { getUserByEmail, sendEmailIfNotVerified } from '@/utils';
import { sendError } from '@/errors';
import { Joi, email, redirectTo } from '@/validation';

export const userEmailSendVerificationEmailSchema = Joi.object({
  email: email.required(),
  options: Joi.object({
    redirectTo,
  }).default(),
}).meta({ className: 'UserEmailSendVerificationEmailSchema' });

export const userEmailSendVerificationEmailHandler: RequestHandler<
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

  if (!user) {
    return sendError(res, 'user-not-found');
  }

  if (user.emailVerified) {
    return sendError(res, 'email-already-verified');
  }

  // TODO: possibly check when last email was sent to minimize abuse
  await sendEmailIfNotVerified(
    {
      user,
      redirectTo,
      displayName: user.displayName || email,
      newEmail: email,
      email,
    },
    true
  );

  return res.json(ReasonPhrases.OK);
};
