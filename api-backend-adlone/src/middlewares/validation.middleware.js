import { errorResponse } from '../utils/response.js';

/**
 * Validation middleware factory
 * @param {Object} schema - Joi or Zod validation schema
 * @param {string} property - Request property to validate (body, query, params)
 */
export const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false, // Return all errors
            stripUnknown: true, // Remove unknown fields
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
            }));

            return errorResponse(res, 'Validation failed', 400, errors);
        }

        // Replace request property with validated value
        req[property] = value;
        next();
    };
};

/**
 * Async handler wrapper
 * Catches async errors and passes them to error handler
 */
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
