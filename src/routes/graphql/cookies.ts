import cookie from 'cookie';
import { Context } from './context';

export const NHOST_COOKIE = 'nhost_cookie';

export const setCookie = (
  context: Context,
  payload: { refreshToken: string; userId: string }
) => {
  context.request.headers.append(
    'Set-Cookie',
    cookie.serialize(NHOST_COOKIE, JSON.stringify(payload), {
      httpOnly: true,
      sameSite: 'lax', // TODO 'strict' with secure = true
      // secure: true, // TODO only in production (https)
      //   TODO expires vs maxAge
      maxAge: 60 * 60 * 24 * 30, // * 30 days, in seconds
    })
  );
};
