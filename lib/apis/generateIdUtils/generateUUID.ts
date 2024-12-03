/**
 * Generates a deterministic UUID based on the XXHash algorithm.
 *
 * @param {...any} args - The input parameters used to generate the UUID.
 * @returns {string} A UUID string generated from the input.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateUUID(...args: any[]) {
  // Serialize the input arguments to a consistent string format
  const input = JSON.stringify(args);

  // Generate the hash using the XXHash algorithm
  const hash = xxHash(input);

  // Convert the hash to a UUID format
  const uuid = [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-');

  return uuid;
}

/**
 * XXHash algorithm (32-bit).
 * A very fast and low-collision probability hash function.
 *
 * @param {string} input - The input string to be hashed.
 * @returns {string} The 32-bit hash value in hexadecimal format.
 */
function xxHash(input: string) {
  const prime1 = 0x9e3779b1;
  const prime2 = 0x85ebca6b;
  const prime3 = 0xc2b2ae35;
  const prime4 = 0x27d4eb2f;
  const prime5 = 0x165667b1;

  let h32 = prime5;

  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h32 += c * prime1;
    h32 = (h32 << 13) | (h32 >>> 19);
    h32 *= prime2;
  }

  // Finalize the hash calculation
  h32 = (h32 ^ (h32 >>> 16)) * prime3;
  h32 = (h32 ^ (h32 >>> 13)) * prime4;
  h32 = h32 ^ (h32 >>> 16);

  // Convert the result to a 8-character hexadecimal string
  return (h32 >>> 0).toString(16).padStart(8, '0');
}
