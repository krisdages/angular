/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

/**
 * A simple replacement for Angular's `ɵRuntimeError`. The original carries a
 * numeric error code which we preserve as a property on the thrown error so
 * callers can branch on it.
 */
export class RuntimeError<T extends number = number> extends Error {
  constructor(
    public code: T,
    message: string,
  ) {
    super(formatRuntimeError(code, message));
  }
}

function formatRuntimeError(code: number, message: string): string {
  const fullCode = `RF${code < 0 ? -code : code}`;
  return `${fullCode}: ${message}`;
}
