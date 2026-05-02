/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

/**
 * Minimal signal/computed/untracked implementations sufficient for the
 * reactive-forms classes. They are not reactive in the Angular sense — there
 * is no dependency tracking — but they preserve the call surface used by the
 * ported code. `untracked` runs the callback synchronously and `computed`
 * recomputes on every read.
 */

export interface WritableSignal<T> {
  (): T;
  set(value: T): void;
  update(updater: (value: T) => T): void;
}

export interface Signal<T> {
  (): T;
}

export function signal<T>(initialValue: T): WritableSignal<T> {
  let current = initialValue;
  const accessor = (() => current) as WritableSignal<T>;
  accessor.set = (value: T) => {
    current = value;
  };
  accessor.update = (updater: (value: T) => T) => {
    current = updater(current);
  };
  return accessor;
}

export function computed<T>(compute: () => T): Signal<T> {
  return () => compute();
}

export function untracked<T>(fn: () => T): T {
  return fn();
}
