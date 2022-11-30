import { sendError, sendUnspecifiedError } from '@/errors';
import {
  ENV,
  getSignInResponse,
  verifyWebAuthnRegistration,
  gqlSdk,
  getUserByEmail,
  sendEmailIfNotVerified,
} from '@/utils';
import { RequestHandler } from 'express';

import { RegistrationCredentialJSON } from '@simplewebauthn/typescript-types';
import { Joi, redirectTo } from '@/validation';
import { SignInResponse, UserRegistrationOptionsWithRedirect } from '@/types';

export type SignUpVerifyWebAuthnRequestBody = {
  credential: RegistrationCredentialJSON;
  options: Pick<UserRegistrationOptionsWithRedirect, 'redirectTo'> & {
    nickname?: string;
  };
};

export type SignUpVerifyWebAuthnResponseBody = SignInResponse;

export const signUpVerifyWebauthnSchema =
  Joi.object<SignUpVerifyWebAuthnRequestBody>({
    credential: Joi.object().required(),
    options: Joi.object({
      redirectTo,
      nickname: Joi.string().optional(),
    }).default(),
  }).meta({ className: 'SignUpVerifyWebauthnSchema' });

export const signInVerifyWebauthnHandler: RequestHandler<
  {},
  SignUpVerifyWebAuthnResponseBody,
  SignUpVerifyWebAuthnRequestBody
> = async (
  {
    body: {
      credential,
      options: { redirectTo, nickname },
    },
  },
  res
) => {
  if (!ENV.AUTH_WEBAUTHN_ENABLED) {
    return sendError(res, 'disabled-endpoint');
  }

  let challenge: string;
  try {
    challenge = JSON.parse(
      Buffer.from(credential.response.clientDataJSON, 'base64').toString()
    ).challenge;
  } catch {
    return sendError(res, 'invalid-request', {
      customMessage: 'Could not parse challenge',
    });
  }

  const {
    users: [user],
  } = await gqlSdk.users({ where: { currentChallenge: { _eq: challenge } } });

  if (!user) {
    return sendError(res, 'user-not-found');
  }

  // Edge case: if another user registered with the same email while the webauthn requester is between the first and second step
  if (await getUserByEmail(user.newEmail)) {
    return sendError(res, 'email-already-in-use');
  }

  try {
    await verifyWebAuthnRegistration(user, credential, nickname);

    await gqlSdk.updateUser({
      id: user.id,
      user: {
        isAnonymous: false,
        email: user.newEmail,
        newEmail: null,
      },
    });

    if (user.disabled) {
      return sendError(res, 'disabled-user');
    }

    if (ENV.AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED && !user.emailVerified) {
      await sendEmailIfNotVerified({
        user,
        displayName: user.displayName || user.email,
        newEmail: user.email,
        redirectTo,
        email: user.email,
      });

      return res.send({ session: null, mfa: null });
    }
    const signInResponse = await getSignInResponse({
      userId: user.id,
      checkMFA: false,
    });
    return res.send(signInResponse);
  } catch (e) {
    return sendUnspecifiedError(res, e);
  }
};
