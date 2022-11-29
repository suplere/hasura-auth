import { Response } from 'express';

import { gqlSdk } from '../gql-sdk';
import { getUserByEmail } from '@/utils';
import { sendError } from '@/errors';
import { UserRegistrationOptionsWithRedirect } from '@/types';
import { deanonymizeUser } from './deanonymize';
import { sendEmailIfNotVerified } from './email-verification';

export type BodyTypePasswordlessEmail = {
  signInMethod: 'passwordless';
  connection: 'email';
  email: string;
  options: UserRegistrationOptionsWithRedirect;
};

export const handleDeanonymizeUserPasswordlessEmail = async (
  body: BodyTypePasswordlessEmail,
  userId: string,
  res: Response
): Promise<unknown> => {
  const { user } = await gqlSdk.user({
    id: userId,
  });

  if (user?.isAnonymous !== true) {
    return sendError(res, 'user-not-anonymous');
  }

  const { email, options } = body;

  // check if email already in use by some other user
  if (await getUserByEmail(email)) {
    return sendError(res, 'email-already-in-use');
  }

  const updatedUser = await deanonymizeUser(userId, { email }, options);

  await sendEmailIfNotVerified('verify-email', {
    newEmail: email,
    user: updatedUser,
    displayName: updatedUser.displayName || email,
    redirectTo: options.redirectTo,
  });
};
