/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {Subject} from 'rxjs';

/**
 * Minimal stand-in for Angular's `EventEmitter`. This is intentionally a thin
 * wrapper over `Subject` so consumers can subscribe to it like any other RxJS
 * observable. It exists purely to preserve the `.emit(value)` calling
 * convention used throughout the ported reactive-forms code.
 */
export class EventEmitter<T> extends Subject<T> {
  emit(value?: T): void {
    super.next(value as T);
  }
}
