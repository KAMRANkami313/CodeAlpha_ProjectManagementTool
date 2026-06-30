import mongoose from 'mongoose';

const TRANSACTION_NOT_SUPPORTED_PATTERNS = [
  'Transaction numbers are only allowed on a replica set member',
  'This MongoDB deployment does not support retryable writes',
  'Sessions are not supported',
  'not supported in standalone',
];

const isTransactionNotSupported = (error) =>
  TRANSACTION_NOT_SUPPORTED_PATTERNS.some((pattern) =>
    error?.message?.toLowerCase().includes(pattern.toLowerCase())
  );

const withTransaction = async (callback) => {
  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      result = await callback(session);
    });
    return result;
  } catch (error) {
    if (isTransactionNotSupported(error)) {
      return callback(null);
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

export default withTransaction;