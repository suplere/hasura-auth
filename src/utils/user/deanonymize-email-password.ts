import { Response } from 'express';
import { ReasonPhrases } from 'http-status-codes';

import { getUserByEmail, sendEmailIfNotVerified } from '@/utils';
import { sendError } from '@/errors';

import { gqlSdk } from '../gql-sdk';
import { hashPassword } from '../password';
import { UserRegistrationOptionsWithRedirect } from '@/types';
import { deanonymizeUser } from './deanonymize';

export type BodyTypeEmailPassword = {
  signInMethod: 'email-password';
  email: string;
  password: string;
  options: UserRegistrationOptionsWithRedirect;
};

export const handleDeanonymizeUserEmailPassword = async (
  body: BodyTypeEmailPassword,
  userId: string,
  res: Response
): Promise<unknown> => {
  const { user } = await gqlSdk.user({
    id: userId,
  });
  if (user?.isAnonymous) {
    return sendError(res, 'user-not-anonymous');
  }

  const { email, password, options } = body;

  // check if email already in use by some other user
  if (await getUserByEmail(email)) {
    return sendError(res, 'email-already-in-use');
  }

  const passwordHash = await hashPassword(password);

  const updatedUser = await deanonymizeUser(
    userId,
    { email, passwordHash },
    options
  );

  await sendEmailIfNotVerified('verify-email', {
    newEmail: email,
    user: updatedUser,
    displayName: updatedUser.displayName || email,
    redirectTo: options.redirectTo,
  });

  res.json(ReasonPhrases.OK);
};
