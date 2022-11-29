import { UserRegistrationOptionsWithRedirect } from '@/types';

import { ENV } from '../env';
import { gqlSdk } from '../gql-sdk';
import { Users_Set_Input } from '../__generated__/graphql-request';
import { getGravatarUrl } from '../avatar';

export const deanonymizeUser = async (
  userId: string,
  user: Users_Set_Input,
  options: UserRegistrationOptionsWithRedirect
) => {
  const { allowedRoles, defaultRole, locale, metadata, displayName } = options;
  // delete existing (anonymous) user roles
  await gqlSdk.deleteUserRolesByUserId({
    userId,
  });

  // insert new user roles (userRoles)
  await gqlSdk.insertUserRoles({
    userRoles: allowedRoles.map((role: string) => ({ role, userId })),
  });

  const updatedUser = {
    disabled: ENV.AUTH_DISABLE_NEW_USERS,
    isAnonymous: false,
    emailVerified: false,
    displayName,
    defaultRole,
    locale,
    metadata,
    avatarUrl: getGravatarUrl(user?.email),
    ...user,
  };
  await gqlSdk.updateUser({
    id: userId,
    user: updatedUser,
  });

  // delete old refresh tokens for user
  await gqlSdk.deleteUserRefreshTokens({
    userId: user.id,
  });

  return updatedUser;
};
