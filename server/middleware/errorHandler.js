const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  let statusCode = error.statusCode ?? (res.statusCode >= 400 ? res.statusCode : 500);
  let code = error.code ?? 'INTERNAL_SERVER_ERROR';
  let message = error.message || 'An unexpected server error occurred.';

  if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'The supplied resource ID is invalid.';
  }

  if (statusCode >= 500) {
    console.error(`[${code}]`, error);
    if (process.env.NODE_ENV === 'production') {
      message = 'An unexpected server error occurred.';
    }
  }

  return res.status(statusCode).json({ error: { code, message } });
};

export default errorHandler;
