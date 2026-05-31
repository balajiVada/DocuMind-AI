import crypto from 'crypto';
import fs from 'fs';

/**
 * Generate a SHA-256 hash from a file using streams to prevent memory spikes on large files.
 * @param filePath The absolute path to the file
 * @returns The hex representation of the file's SHA-256 hash
 */
export const generateFileHash = (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => {
      hash.update(data);
    });

    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });

    stream.on('error', (err) => {
      reject(err);
    });
  });
};
