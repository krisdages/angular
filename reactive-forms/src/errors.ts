/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

/**
 * Runtime error codes used by the reactive-forms library.
 * These mirror the codes from the original `@angular/forms` package.
 */
export const enum RuntimeErrorCode {
  NO_CONTROLS = 1000,
  MISSING_CONTROL = 1001,
  MISSING_CONTROL_VALUE = -1002,
  WRONG_VALIDATOR_RETURN_TYPE = -1101,
}

export const asyncValidatorsDroppedWithOptsWarning = `
  It looks like you're constructing a FormControl with both an options argument and an
  async validators argument. Mixing these arguments will cause your async validators to be dropped.
  You should either put all your validators in the options object, or in separate validators
  arguments. For example:

  // Using validators arguments
  fc = new FormControl(42, Validators.required, myAsyncValidator);

  // Using AbstractControlOptions
  fc = new FormControl(42, {validators: Validators.required, asyncValidators: myAV});

  // Do NOT mix them: async validators will be dropped!
  fc = new FormControl(42, {validators: Validators.required}, /* Oops! */ myAsyncValidator);
`;

function describeKey(isFormGroup: boolean, key: string | number): string {
  return isFormGroup ? `with name: '${key}'` : `at index: ${key}`;
}

export function noControlsError(isFormGroup: boolean): string {
  return `There are no form controls registered with this ${
    isFormGroup ? 'group' : 'array'
  } yet.`;
}

export function missingControlError(isFormGroup: boolean, key: string | number): string {
  return `Cannot find form control ${describeKey(isFormGroup, key)}`;
}

export function missingControlValueError(isFormGroup: boolean, key: string | number): string {
  return `Must supply a value for form control ${describeKey(isFormGroup, key)}`;
}
