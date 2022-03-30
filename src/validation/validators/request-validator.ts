import { RequestHandler } from 'express';
import { ValidationError, Schema } from 'joi';

import { REQUEST_VALIDATION_ERROR, sendError } from '@/errors';

const buildError = (error: ValidationError) => {
  const errorPayload = REQUEST_VALIDATION_ERROR;
  errorPayload.message = error.details
    .map((detail) => detail.message)
    .join(', ');
  return errorPayload;
};

export const bodyValidator: (schema: Schema) => RequestHandler =
  (schema) => async (req, res, next) => {
    try {
      req.body = await schema.validateAsync(req.body);
      next();
    } catch (err: any) {
      const error = buildError(err);
      return sendError(res, 'request-validation-error', {
        customMessage: error.message,
        redirectTo: err._original.redirectTo,
      });
    }
  };

export const queryValidator: (schema: Schema) => RequestHandler =
  (schema) => async (req, res, next) => {
    try {
      req.query = await schema.validateAsync(req.query, { convert: true });
      next();
    } catch (err: any) {
      const error = buildError(err);
      return sendError(res, 'request-validation-error', {
        customMessage: error.message,
        redirectTo: err._original.redirectTo,
      });
    }
  };