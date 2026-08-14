'use strict';
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

function globalErrorHandler(err, req, res, next) {
  // Default to 500
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errorCode = err.errorCode || 'INTERNAL_ERROR';

  // ── Handle specific Mongoose/MongoDB errors ────────────────────────────────
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
    errorCode = 'INVALID_ID';
  }

  if (err.code === 11000) {
    // Duplicate key error
    const keyPattern = err.keyPattern || err.keyValue || {};
    const field = Object.keys(keyPattern)[0] || 'field';
    statusCode = 409;
    if (field === 'phone' || (err.errmsg && err.errmsg.includes('phone_1'))) {
      errorCode = 'PHONE_ALREADY_EXISTS';
      message = 'This mobile number is already registered with another OneWayFix account.';
    } else {
      errorCode = 'DUPLICATE_KEY';
      message = `${field} already exists`;
    }
  }

  if (err.name === 'ValidationError') {
    statusCode = 422;
    const fields = err.errors 
      ? Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }))
      : err.fields || [];
    
    const fieldDetails = fields.map(f => f.message || `${f.field} is invalid`).join(', ');
    message = fieldDetails ? `Validation failed: ${fieldDetails}` : 'Validation failed';
    errorCode = 'VALIDATION_ERROR';

    return res.status(statusCode).json({
      success: false,
      error: message,
      errorCode,
      fields,
    });
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Invalid or expired token';
    errorCode = 'AUTH_ERROR';
  }

  // ── Log server errors ──────────────────────────────────────────────────────
  if (statusCode >= 500) {
    logger.error('Server Error:', {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      userId: req.userId,
    });
  } else {
    logger.warn('Client Error:', {
      message: err.message,
      statusCode,
      url: req.originalUrl,
      method: req.method,
    });
  }

  // ── Send response ──────────────────────────────────────────────────────────
  const response = {
    success: false,
    error: message,
    errorCode,
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
    errorCode: 'NOT_FOUND',
  });
}

module.exports = { globalErrorHandler, notFoundHandler };
