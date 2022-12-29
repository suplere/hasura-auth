import ErrorsPlugin from '@pothos/plugin-errors';
import ValidationPlugin from '@pothos/plugin-validation';

import SchemaBuilder from '@pothos/core';
import { Context } from './context';

export const builder = new SchemaBuilder<{
  Context: Context;
}>({
  plugins: [ErrorsPlugin, ValidationPlugin],
  validationOptions: {
    // optionally customize how errors are formatted
    validationError: (zodError, args, context, info) => {
      // the default behavior is to just throw the zod error directly
      return zodError;
    },
  },
  errorOptions: {
    defaultTypes: [],
  },
});
