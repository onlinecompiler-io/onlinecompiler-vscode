// Where a file's stdin can come from. Paths here are URI paths, which always use forward slashes.

import { posix } from 'node:path';

/**
 * The files checked for stdin, in order: the file's own name plus ".in" (main.py.in), then
 * input.txt in the same folder.
 */
export function inputCandidates(filePath: string): string[] {
	return [`${filePath}.in`, posix.join(posix.dirname(filePath), 'input.txt')];
}
