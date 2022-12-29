import { ENV } from '@/utils';
import micromatch from 'micromatch';
import z from 'zod';
export const redirectTo = z
  .string()
  //   .default(ENV.AUTH_CLIENT_URL)
  .describe('redirectTo')
  .refine(
    (value: string) => {
      // ph.length > 4

      // * If no client url is set, we allow any valid url
      if (!ENV.AUTH_CLIENT_URL) {
        const { success } = z.string().url().safeParse(value);
        if (success) {
          return true;
        }
      }
      // * We allow any sub-path of the client url
      const { success } = z
        .string()
        .regex(new RegExp(`^${ENV.AUTH_CLIENT_URL}`))
        .safeParse(value);
      if (success) {
        return true;
      }

      // * We allow any sub-path of the allowed redirect urls.
      // * Allowed redirect urls also accepts wildcards and other micromatch patterns
      const expressions = ENV.AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS.map(
        (allowed) => {
          // * Replace all the `.` by `/` so micromatch will understand `.` as a path separator
          allowed = allowed.replace(/[.]/g, '/');
          // * Append `/**` to the end of the allowed URL to allow for any subpath
          if (allowed.endsWith('/**')) {
            return allowed;
          }
          if (allowed.endsWith('/*')) {
            return `${allowed}*`;
          }
          if (allowed.endsWith('/')) {
            return `${allowed}**`;
          }
          return `${allowed}/**`;
        }
      );
      try {
        // * Don't take the query parameters into account
        const url = new URL(value);
        const urlWithoutParams =
          // * Remove the query parameters and the hash
          `${url.origin}${url.pathname}`
            // * Replace all the `.` by `/` so micromatch will understand `.` as a path separator
            .replace(/[.]/g, '/');
        const match = micromatch.isMatch(urlWithoutParams, expressions, {
          nocase: true,
        });
        return !!match;
      } catch {
        // * value is not a valid URL
        return false;
      }
    },
    (value) => ({
      message: `${value} is not a valid redirection url`,
    })
  );
