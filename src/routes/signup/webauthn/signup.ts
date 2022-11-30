import { sendError } from '@/errors';
import {
  ENV,
  getUserByEmail,
  getGravatarUrl,
  insertUser,
  getWebAuthnRelyingParty,
} from '@/utils';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { v4 as uuidv4 } from 'uuid';
import { RequestHandler } from 'express';

import { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/typescript-types';
import { email, Joi, registrationOptions } from '@/validation';
import { UserRegistrationOptionsWithRedirect } from '@/types';
import { deanonymizeUser, sendEmailIfNotVerified } from '@/utils';

export type SignUpWebAuthnRequestBody = {
  email: string;
  options: UserRegistrationOptionsWithRedirect;
};
export type SignUpWebAuthnResponseBody = PublicKeyCredentialRequestOptionsJSON;

export const signUpWebauthnSchema = Joi.object<SignUpWebAuthnRequestBody>({
  email: email.required(),
  options: registrationOptions.unknown(true),
}).meta({ className: 'SignUpWebauthnSchema' });

export const signUpWebauthnHandler: RequestHandler<
  {},
  SignUpWebAuthnResponseBody,
  SignUpWebAuthnRequestBody
> = async ({ body: { email, options } }, res) => {
  if (!ENV.AUTH_WEBAUTHN_ENABLED) {
    return sendError(res, 'disabled-endpoint');
  }

  // check if email already in use by some other user
  const existingUser = await getUserByEmail(email);
  if (existingUser && !existingUser.isAnonymous) {
    return sendError(res, 'email-already-in-use');
  }

  const {
    locale,
    defaultRole,
    allowedRoles,
    metadata,
    displayName = email,
  } = options;

  const userId = existingUser?.id || uuidv4();

  const registrationOptions = generateRegistrationOptions({
    rpID: getWebAuthnRelyingParty(),
    rpName: ENV.AUTH_WEBAUTHN_RP_NAME,
    userID: userId,
    userName: displayName,
    attestationType: 'indirect',
  });

  if (existingUser) {
    // * Deanonymisation
    const user = await deanonymizeUser(
      userId,
      {
        newEmail: email,
        email: null,
        currentChallenge: registrationOptions.challenge,
        // * We keep the user anonymous for now, until they complete the webauthn choreography
        isAnonymous: true,
      },
      options
    );
    await sendEmailIfNotVerified({
      user,
      newEmail: email,
      displayName: user.displayName || 'email',
      redirectTo: options.redirectTo,
    });
  } else {
    await insertUser({
      id: userId,
      isAnonymous: true,
      newEmail: email,
      email: null,
      disabled: ENV.AUTH_DISABLE_NEW_USERS,
      displayName,
      avatarUrl: getGravatarUrl(email),
      emailVerified: false,
      locale,
      defaultRole,
      roles: {
        // restructure user roles to be inserted in GraphQL mutation
        data: allowedRoles.map((role: string) => ({ role })),
      },
      metadata,
      currentChallenge: registrationOptions.challenge,
    });
  }

  return res.send(registrationOptions);
};
