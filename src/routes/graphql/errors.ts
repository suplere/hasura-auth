import { ERRORS } from '@/errors';
import { ZodFormattedError, ZodError } from 'zod';

import { builder } from './builder';
function flattenErrors(
  error: ZodFormattedError<unknown>,
  path: string[]
): { path: string[]; message: string }[] {
  // eslint-disable-next-line no-underscore-dangle
  const errors = error._errors.map((message) => ({
    path,
    message,
  }));

  Object.keys(error).forEach((key) => {
    if (key !== '_errors') {
      errors.push(
        ...flattenErrors(
          (error as Record<string, unknown>)[key] as ZodFormattedError<unknown>,
          [...path, key]
        )
      );
    }
  });

  return errors;
}

// A type for the individual validation issues
const ZodFieldError = builder
  .objectRef<{
    message: string;
    path: string[];
  }>('ZodFieldError')
  .implement({
    fields: (t) => ({
      message: t.exposeString('message'),
      path: t.exposeStringList('path'),
    }),
  });

const ErrorInterface = builder.interfaceRef<Error>('Error').implement({
  fields: (t) => ({
    message: t.exposeString('message'),
  }),
});

// TODO get rid of this
builder.objectType(Error, {
  name: 'BaseError',
  interfaces: [ErrorInterface],
});

// The actual error type
builder.objectType(ZodError, {
  name: 'ValidationError',
  interfaces: [ErrorInterface],
  fields: (t) => ({
    fieldErrors: t.field({
      type: [ZodFieldError],
      resolve: (err) => flattenErrors(err.format(), []),
    }),
  }),
});

export class StandardError extends Error {
  code: keyof typeof ERRORS;
  status: number;

  constructor(code: keyof typeof ERRORS, message?: string) {
    const error = ERRORS[code];
    super(message || error.message);

    this.code = code;
    this.status = error.status;
  }
}

builder.objectType(StandardError, {
  name: 'StandardError',
  interfaces: [ErrorInterface],
  fields: (t) => ({
    code: t.exposeString('code'),
    status: t.exposeInt('status'),
  }),
});
