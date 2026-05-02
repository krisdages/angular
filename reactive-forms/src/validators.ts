/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {forkJoin, from, Observable} from 'rxjs';
import {map} from 'rxjs/operators';

import {RuntimeErrorCode} from './errors';
import {RuntimeError} from './runtime_error';
import {isPromise, isSubscribable, ngDevMode} from './util';
import type {
  AsyncValidator,
  AsyncValidatorFn,
  ValidationErrors,
  Validator,
  ValidatorFn,
} from './validator_types';
import type {AbstractControl} from './model/abstract_model';

function isEmptyInputValue(value: unknown): boolean {
  return value == null || lengthOrSize(value) === 0;
}

/**
 * Extract the length property in case it's an array or a string.
 * Extract the size property in case it's a set.
 * Return null else.
 */
function lengthOrSize(value: unknown): number | null {
  if (value == null) {
    return null;
  } else if (Array.isArray(value) || typeof value === 'string') {
    return value.length;
  } else if (value instanceof Set) {
    return value.size;
  }

  return null;
}

const EMAIL_REGEXP =
  /^(?=.{1,254}$)(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Provides a set of built-in validators that can be used by form controls.
 *
 * A validator is a function that processes a `FormControl` or collection of
 * controls and returns an error map or null. A null map means that validation has passed.
 */
export class Validators {
  static min(min: number): ValidatorFn {
    return minValidator(min);
  }

  static max(max: number): ValidatorFn {
    return maxValidator(max);
  }

  static required(control: AbstractControl): ValidationErrors | null {
    return requiredValidator(control);
  }

  static requiredTrue(control: AbstractControl): ValidationErrors | null {
    return requiredTrueValidator(control);
  }

  static email(control: AbstractControl): ValidationErrors | null {
    return emailValidator(control);
  }

  static minLength(minLength: number): ValidatorFn {
    return minLengthValidator(minLength);
  }

  static maxLength(maxLength: number): ValidatorFn {
    return maxLengthValidator(maxLength);
  }

  static pattern(pattern: string | RegExp): ValidatorFn {
    return patternValidator(pattern);
  }

  static nullValidator(control: AbstractControl): ValidationErrors | null {
    return nullValidator(control);
  }

  static compose(validators: null): null;
  static compose(validators: (ValidatorFn | null | undefined)[]): ValidatorFn | null;
  static compose(validators: (ValidatorFn | null | undefined)[] | null): ValidatorFn | null {
    return compose(validators);
  }

  static composeAsync(validators: (AsyncValidatorFn | null)[]): AsyncValidatorFn | null {
    return composeAsync(validators);
  }
}

export function minValidator(min: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (control.value == null || min == null) {
      return null;
    }
    const value = parseFloat(control.value);
    return !isNaN(value) && value < min ? {'min': {'min': min, 'actual': control.value}} : null;
  };
}

export function maxValidator(max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (control.value == null || max == null) {
      return null;
    }
    const value = parseFloat(control.value);
    return !isNaN(value) && value > max ? {'max': {'max': max, 'actual': control.value}} : null;
  };
}

export function requiredValidator(control: AbstractControl): ValidationErrors | null {
  return isEmptyInputValue(control.value) ? {'required': true} : null;
}

export function requiredTrueValidator(control: AbstractControl): ValidationErrors | null {
  return control.value === true ? null : {'required': true};
}

export function emailValidator(control: AbstractControl): ValidationErrors | null {
  if (isEmptyInputValue(control.value)) {
    return null;
  }
  return EMAIL_REGEXP.test(control.value) ? null : {'email': true};
}

export function minLengthValidator(minLength: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const length = control.value?.length ?? lengthOrSize(control.value);
    if (length === null || length === 0) {
      return null;
    }

    return length < minLength
      ? {'minlength': {'requiredLength': minLength, 'actualLength': length}}
      : null;
  };
}

export function maxLengthValidator(maxLength: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const length = control.value?.length ?? lengthOrSize(control.value);
    if (length !== null && length > maxLength) {
      return {'maxlength': {'requiredLength': maxLength, 'actualLength': length}};
    }
    return null;
  };
}

export function patternValidator(pattern: string | RegExp): ValidatorFn {
  if (!pattern) return nullValidator;
  let regex: RegExp;
  let regexStr: string;
  if (typeof pattern === 'string') {
    regexStr = '';

    if (pattern.charAt(0) !== '^') regexStr += '^';

    regexStr += pattern;

    if (pattern.charAt(pattern.length - 1) !== '$') regexStr += '$';

    regex = new RegExp(regexStr);
  } else {
    regexStr = pattern.toString();
    regex = pattern;
  }
  return (control: AbstractControl): ValidationErrors | null => {
    if (isEmptyInputValue(control.value)) {
      return null;
    }
    const value: string = control.value;
    return regex.test(value)
      ? null
      : {'pattern': {'requiredPattern': regexStr, 'actualValue': value}};
  };
}

export function nullValidator(control: AbstractControl): ValidationErrors | null {
  return null;
}

function isPresent(o: any): boolean {
  return o != null;
}

export function toObservable(value: any): Observable<any> {
  const obs = isPromise(value) ? from(value) : value;
  if (ngDevMode && !isSubscribable(obs)) {
    let errorMessage = `Expected async validator to return Promise or Observable.`;
    if (typeof value === 'object') {
      errorMessage +=
        ' Are you using a synchronous validator where an async validator is expected?';
    }
    throw new RuntimeError(RuntimeErrorCode.WRONG_VALIDATOR_RETURN_TYPE, errorMessage);
  }
  return obs;
}

function mergeErrors(arrayOfErrors: (ValidationErrors | null)[]): ValidationErrors | null {
  let res: {[key: string]: any} = {};
  arrayOfErrors.forEach((errors: ValidationErrors | null) => {
    res = errors != null ? {...res!, ...errors} : res!;
  });

  return Object.keys(res).length === 0 ? null : res;
}

type GenericValidatorFn = (control: AbstractControl) => any;

function executeValidators<V extends GenericValidatorFn>(
  control: AbstractControl,
  validators: V[],
): ReturnType<V>[] {
  return validators.map((validator) => validator(control));
}

function isValidatorFn<V>(validator: V | Validator | AsyncValidator): validator is V {
  return !(validator as Validator).validate;
}

/**
 * Given the list of validators that may contain both functions as well as classes, return the list
 * of validator functions (convert validator classes into validator functions).
 */
export function normalizeValidators<V>(validators: (V | Validator | AsyncValidator)[]): V[] {
  return validators.map((validator) => {
    return isValidatorFn<V>(validator)
      ? validator
      : (((c: AbstractControl) => validator.validate(c)) as unknown as V);
  });
}

function compose(validators: (ValidatorFn | null | undefined)[] | null): ValidatorFn | null {
  if (!validators) return null;
  const presentValidators: ValidatorFn[] = validators.filter(isPresent) as any;
  if (presentValidators.length == 0) return null;

  return function (control: AbstractControl) {
    return mergeErrors(executeValidators<ValidatorFn>(control, presentValidators));
  };
}

export function composeValidators(validators: Array<Validator | ValidatorFn>): ValidatorFn | null {
  return validators != null ? compose(normalizeValidators<ValidatorFn>(validators)) : null;
}

function composeAsync(validators: (AsyncValidatorFn | null)[]): AsyncValidatorFn | null {
  if (!validators) return null;
  const presentValidators: AsyncValidatorFn[] = validators.filter(isPresent) as any;
  if (presentValidators.length == 0) return null;

  return function (control: AbstractControl) {
    const observables = executeValidators<AsyncValidatorFn>(control, presentValidators).map(
      toObservable,
    );
    return forkJoin(observables).pipe(map(mergeErrors));
  };
}

export function composeAsyncValidators(
  validators: Array<AsyncValidator | AsyncValidatorFn>,
): AsyncValidatorFn | null {
  return validators != null
    ? composeAsync(normalizeValidators<AsyncValidatorFn>(validators))
    : null;
}

export function mergeValidators<V>(controlValidators: V | V[] | null, dirValidator: V): V[] {
  if (controlValidators === null) return [dirValidator];
  return Array.isArray(controlValidators)
    ? [...controlValidators, dirValidator]
    : [controlValidators, dirValidator];
}

export function getControlValidators(control: AbstractControl): ValidatorFn | ValidatorFn[] | null {
  return (control as any)._rawValidators as ValidatorFn | ValidatorFn[] | null;
}

export function getControlAsyncValidators(
  control: AbstractControl,
): AsyncValidatorFn | AsyncValidatorFn[] | null {
  return (control as any)._rawAsyncValidators as AsyncValidatorFn | AsyncValidatorFn[] | null;
}

export function makeValidatorsArray<T extends ValidatorFn | AsyncValidatorFn>(
  validators: T | T[] | null,
): T[] {
  if (!validators) return [];
  return Array.isArray(validators) ? validators : [validators];
}

export function hasValidator<T extends ValidatorFn | AsyncValidatorFn>(
  validators: T | T[] | null,
  validator: T,
): boolean {
  return Array.isArray(validators) ? validators.includes(validator) : validators === validator;
}

export function addValidators<T extends ValidatorFn | AsyncValidatorFn>(
  validators: T | T[],
  currentValidators: T | T[] | null,
): T[] {
  const current = makeValidatorsArray(currentValidators);
  const validatorsToAdd = makeValidatorsArray(validators);
  validatorsToAdd.forEach((v: T) => {
    if (!hasValidator(current, v)) {
      current.push(v);
    }
  });
  return current;
}

export function removeValidators<T extends ValidatorFn | AsyncValidatorFn>(
  validators: T | T[],
  currentValidators: T | T[] | null,
): T[] {
  return makeValidatorsArray(currentValidators).filter((v) => !hasValidator(validators, v));
}
