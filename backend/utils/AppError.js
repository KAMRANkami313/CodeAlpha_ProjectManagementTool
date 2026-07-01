/**
 * Operational error class.
 *
 * "Operational" = expected, recoverable error the app knows how to handle
 * (e.g. "user not found", "invalid password"). Safe to return to client.
 *
 * "Programmer errors" (bugs) should NOT be wrapped in AppError — they
 * should propagate up so the global error handler logs them and returns 500.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert an arbitrary error into an AppError, preserving status code if
   * the source already had one. Useful when calling third-party libs.
   */
  static fromError(err, fallbackStatusCode = 500, fallbackMessage) {
    if (err instanceof AppError) return err;
    const message = fallbackMessage || err?.message || 'Internal Server Error';
    return new AppError(message, err?.statusCode || fallbackStatusCode);
  }

  toJSON() {
    return {
      message: this.message,
      statusCode: this.statusCode,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export default AppError;