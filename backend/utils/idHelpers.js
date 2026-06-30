/**
 * Mongoose ObjectId arrays cannot be reliably checked with the native
 * Array.prototype.includes(), because it uses strict reference equality
 * and two ObjectId instances representing the same id are never `===` equal.
 * These helpers centralize the correct comparison so every controller
 * uses the same (correct) logic instead of repeating a bug.
 */

const idsEqual = (a, b) => {
  if (a === undefined || a === null || b === undefined || b === null) return false;
  return a.toString() === b.toString();
};

const containsId = (idArray = [], id) => idArray.some((entry) => idsEqual(entry, id));

const removeId = (idArray = [], id) => idArray.filter((entry) => !idsEqual(entry, id));

export { idsEqual, containsId, removeId };
