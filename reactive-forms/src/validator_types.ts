/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {Observable} from 'rxjs';

import type {AbstractControl} from './model/abstract_model';

/**
 * Defines the map of errors returned from failed validation checks.
 */
export type ValidationErrors = {
  [key: string]: any;
};

/**
 * A function that receives a control and synchronously returns a map of
 * validation errors if present, otherwise null.
 */
export interface ValidatorFn {
  (control: AbstractControl): ValidationErrors | null;
}

/**
 * A function that receives a control and returns a Promise or Observable
 * that emits validation errors if present, otherwise null.
 */
export interface AsyncValidatorFn {
  (
    control: AbstractControl,
  ): Promise<ValidationErrors | null> | Observable<ValidationErrors | null>;
}

/**
 * An interface implemented by classes that perform synchronous validation.
 */
export interface Validator {
  validate(control: AbstractControl): ValidationErrors | null;
  registerOnValidatorChange?(fn: () => void): void;
}

/**
 * An interface implemented by classes that perform asynchronous validation.
 */
export interface AsyncValidator extends Validator {
  validate(
    control: AbstractControl,
  ): Promise<ValidationErrors | null> | Observable<ValidationErrors | null>;
}
