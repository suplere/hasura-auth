// TODO this library takes more than one third of the time required by hasura-auth to load
import Email from 'email-templates';
import nodemailer from 'nodemailer';

import { TransactionType, TRANSACTION_TYPES } from './types';
import { ENV } from './utils/env';
import { EmailLocals, renderTemplate } from './templates';
import { createEmailRedirectionLink } from './utils';

/**
 * SMTP transport.
 */
const transport = nodemailer.createTransport({
  host: ENV.AUTH_SMTP_HOST,
  port: Number(ENV.AUTH_SMTP_PORT),
  secure: Boolean(ENV.AUTH_SMTP_SECURE),
  auth: {
    pass: ENV.AUTH_SMTP_PASS,
    user: ENV.AUTH_SMTP_USER,
  },
  authMethod: ENV.AUTH_SMTP_AUTH_METHOD,
});

/**
 * Reusable email client.
 */
export const emailClient = new Email<EmailLocals>({
  transport,
  message: { from: ENV.AUTH_SMTP_SENDER },
  send: true,
  render: renderTemplate as (
    view: string,
    locals?: EmailLocals
  ) => Promise<string>,
});

export const sendEmail = async (
  type: TransactionType,
  {
    email,
    ticket,
    redirectTo,
    user,
    newEmail,
  }: {
    email: string;
    ticket: string;
    redirectTo: string;
    user: {
      email?: string;
      displayName?: string | null;
      locale?: string | null;
    };
    newEmail?: string;
  }
) => {
  const link = createEmailRedirectionLink(type, ticket, redirectTo);
  const template = TRANSACTION_TYPES[type];
  await emailClient.send({
    template,
    message: {
      to: newEmail || email,
      headers: {
        /** @deprecated */
        'x-ticket': {
          prepared: true,
          value: ticket,
        },
        /** @deprecated */
        'x-redirect-to': {
          prepared: true,
          value: redirectTo,
        },
        'x-email-template': {
          prepared: true,
          value: template,
        },
        'x-link': {
          prepared: true,
          value: link,
        },
      },
    },
    locals: {
      link,
      email,
      newEmail,
      displayName: user?.displayName || email,
      ticket,
      redirectTo: encodeURIComponent(redirectTo),
      locale: user?.locale || ENV.AUTH_LOCALE_DEFAULT,
      serverUrl: ENV.AUTH_SERVER_URL,
      clientUrl: ENV.AUTH_CLIENT_URL,
    },
  });
};
