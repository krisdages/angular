/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {Observable} from 'rxjs';

export function removeListItem<T>(list: T[], el: T): void {
  const index = list.indexOf(el);
  if (index > -1) list.splice(index, 1);
}

export function isPromise<T = unknown>(obj: unknown): obj is Promise<T> {
  return !!obj && typeof (obj as Promise<T>).then === 'function';
}

export function isSubscribable(obj: unknown): obj is Observable<unknown> {
  return !!obj && typeof (obj as Observable<unknown>).subscribe === 'function';
}

/** ngDevMode shim — always treated as enabled for diagnostics. */
export const ngDevMode = true;
