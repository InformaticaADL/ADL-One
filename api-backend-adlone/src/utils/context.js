
import { AsyncLocalStorage } from 'async_hooks';

/**
 * AsyncLocalStorage instance to store request context (IP, User, TraceId, etc.)
 * across asynchronous operations without explicit parameter passing.
 */
export const requestContext = new AsyncLocalStorage();

/**
 * Helper to get the current context
 */
export const getContext = () => requestContext.getStore() || {};
