/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {AbstractControl, AbstractControlOptions} from './model/abstract_model';
import {FormArray, UntypedFormArray} from './model/form_array';
import {
  FormControl,
  FormControlOptions,
  FormControlState,
  UntypedFormControl,
} from './model/form_control';
import {FormGroup, FormRecord, UntypedFormGroup} from './model/form_group';
import type {AsyncValidatorFn, ValidatorFn} from './validator_types';

function isAbstractControlOptions(
  options: AbstractControlOptions | {[key: string]: any} | null | undefined,
): options is AbstractControlOptions {
  return (
    !!options &&
    ((options as AbstractControlOptions).asyncValidators !== undefined ||
      (options as AbstractControlOptions).validators !== undefined ||
      (options as AbstractControlOptions).updateOn !== undefined)
  );
}

/** The union of all validator types that can be accepted by a ControlConfig. */
type ValidatorConfig = ValidatorFn | AsyncValidatorFn | ValidatorFn[] | AsyncValidatorFn[];

type PermissiveControlConfig<T> = Array<T | FormControlState<T> | ValidatorConfig>;

interface PermissiveAbstractControlOptions extends Omit<AbstractControlOptions, 'updateOn'> {
  updateOn?: string;
}

/** A map of nullable form controls. */
export type ɵNullableFormControls<T> = {[K in keyof T]: ɵElement<T[K], null>};

/** A map of non-nullable form controls. */
export type ɵNonNullableFormControls<T> = {[K in keyof T]: ɵElement<T[K], never>};

/** ControlConfig<T> is a tuple containing a value of type T, plus optional validators. */
export type ControlConfig<T> = [
  T | FormControlState<T>,
  (ValidatorFn | ValidatorFn[])?,
  (AsyncValidatorFn | AsyncValidatorFn[])?,
];

/**
 * FormBuilder accepts values in various container shapes, as well as raw values.
 * Element returns the appropriate corresponding model class, given the container T.
 * The flag N, if not never, makes the resulting `FormControl` have N in its type.
 */
export type ɵElement<T, N extends null> = [T] extends [FormControl<infer U>]
  ? FormControl<U>
  : [T] extends [FormControl<infer U> | undefined]
    ? FormControl<U>
    : [T] extends [FormGroup<infer U>]
      ? FormGroup<U>
      : [T] extends [FormGroup<infer U> | undefined]
        ? FormGroup<U>
        : [T] extends [FormRecord<infer U>]
          ? FormRecord<U>
          : [T] extends [FormRecord<infer U> | undefined]
            ? FormRecord<U>
            : [T] extends [FormArray<infer U>]
              ? FormArray<U>
              : [T] extends [FormArray<infer U> | undefined]
                ? FormArray<U>
                : [T] extends [AbstractControl<infer U>]
                  ? AbstractControl<U>
                  : [T] extends [AbstractControl<infer U> | undefined]
                    ? AbstractControl<U>
                    : [T] extends [FormControlState<infer U>]
                      ? FormControl<U | N>
                      : [T] extends [PermissiveControlConfig<infer U>]
                        ? FormControl<
                            Exclude<U, ValidatorConfig | PermissiveAbstractControlOptions> | N
                          >
                        : FormControl<T | N>;

/**
 * Creates an `AbstractControl` from a user-specified configuration.
 *
 * The `FormBuilder` provides syntactic sugar that shortens creating instances of `FormControl`,
 * `FormGroup`, or `FormArray`. It reduces the amount of boilerplate needed to build complex forms.
 */
export class FormBuilder {
  private useNonNullable: boolean = false;

  /**
   * Returns a FormBuilder in which automatically constructed `FormControl` elements
   * have `{nonNullable: true}` and are non-nullable.
   */
  get nonNullable(): NonNullableFormBuilder {
    const nnfb = new FormBuilder();
    nnfb.useNonNullable = true;
    return nnfb as NonNullableFormBuilder;
  }

  group<T extends {}>(
    controls: T,
    options?: AbstractControlOptions | null,
  ): FormGroup<ɵNullableFormControls<T>>;
  /** @deprecated Use the `AbstractControlOptions` overload instead. */
  group(controls: {[key: string]: any}, options: {[key: string]: any}): FormGroup;

  group(
    controls: {[key: string]: any},
    options: AbstractControlOptions | {[key: string]: any} | null = null,
  ): FormGroup {
    const reducedControls = this._reduceControls(controls);
    let newOptions: FormControlOptions = {};
    if (isAbstractControlOptions(options)) {
      newOptions = options;
    } else if (options !== null) {
      newOptions.validators = (options as any).validator;
      newOptions.asyncValidators = (options as any).asyncValidator;
    }
    return new FormGroup(reducedControls, newOptions);
  }

  record<T>(
    controls: {[key: string]: T},
    options: AbstractControlOptions | null = null,
  ): FormRecord<ɵElement<T, null>> {
    const reducedControls = this._reduceControls(controls);
    return new FormRecord(reducedControls, options) as any;
  }

  /** @deprecated Use `nonNullable` instead. */
  control<T>(
    formState: T | FormControlState<T>,
    opts: FormControlOptions & {initialValueIsDefault: true},
  ): FormControl<T>;

  control<T>(
    formState: T | FormControlState<T>,
    opts: FormControlOptions & {nonNullable: true},
  ): FormControl<T>;

  /** @deprecated When passing an `options` argument, the `asyncValidator` argument has no effect. */
  control<T>(
    formState: T | FormControlState<T>,
    opts: FormControlOptions,
    asyncValidator: AsyncValidatorFn | AsyncValidatorFn[],
  ): FormControl<T | null>;

  control<T>(
    formState: T | FormControlState<T>,
    validatorOrOpts?: ValidatorFn | ValidatorFn[] | FormControlOptions | null,
    asyncValidator?: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ): FormControl<T | null>;

  control<T>(
    formState: T | FormControlState<T>,
    validatorOrOpts?: ValidatorFn | ValidatorFn[] | FormControlOptions | null,
    asyncValidator?: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ): FormControl {
    let newOptions: FormControlOptions = {};
    if (!this.useNonNullable) {
      return new FormControl(formState, validatorOrOpts, asyncValidator);
    }
    if (isAbstractControlOptions(validatorOrOpts)) {
      newOptions = validatorOrOpts;
    } else {
      newOptions.validators = validatorOrOpts;
      newOptions.asyncValidators = asyncValidator;
    }
    return new FormControl<T>(formState, {...newOptions, nonNullable: true});
  }

  array<T>(
    controls: Array<T>,
    validatorOrOpts?: ValidatorFn | ValidatorFn[] | AbstractControlOptions | null,
    asyncValidator?: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ): FormArray<ɵElement<T, null>> {
    const createdControls = controls.map((c) => this._createControl(c));
    return new FormArray(createdControls, validatorOrOpts, asyncValidator) as any;
  }

  /** @internal */
  _reduceControls<T>(controls: {
    [k: string]: T | ControlConfig<T> | FormControlState<T> | AbstractControl<T>;
  }): {[key: string]: AbstractControl} {
    const createdControls: {[key: string]: AbstractControl} = {};
    Object.keys(controls).forEach((controlName) => {
      createdControls[controlName] = this._createControl(controls[controlName]);
    });
    return createdControls;
  }

  /** @internal */
  _createControl<T>(
    controls: T | FormControlState<T> | ControlConfig<T> | FormControl<T> | AbstractControl<T>,
  ): FormControl<T> | FormControl<T | null> | AbstractControl<T> {
    if (controls instanceof FormControl) {
      return controls as FormControl<T>;
    } else if (controls instanceof AbstractControl) {
      return controls;
    } else if (Array.isArray(controls)) {
      const value: T | FormControlState<T> = controls[0];
      const validator: ValidatorFn | ValidatorFn[] | null =
        controls.length > 1 ? controls[1]! : null;
      const asyncValidator: AsyncValidatorFn | AsyncValidatorFn[] | null =
        controls.length > 2 ? controls[2]! : null;
      return this.control<T>(value, validator, asyncValidator);
    } else {
      return this.control<T>(controls);
    }
  }
}

/**
 * `NonNullableFormBuilder` is similar to {@link FormBuilder}, but automatically constructed
 * {@link FormControl} elements have `{nonNullable: true}` and are non-nullable.
 */
export abstract class NonNullableFormBuilder {
  abstract group<T extends {}>(
    controls: T,
    options?: AbstractControlOptions | null,
  ): FormGroup<ɵNonNullableFormControls<T>>;

  abstract record<T>(
    controls: {[key: string]: T},
    options?: AbstractControlOptions | null,
  ): FormRecord<ɵElement<T, never>>;

  abstract array<T>(
    controls: Array<T>,
    validatorOrOpts?: ValidatorFn | ValidatorFn[] | AbstractControlOptions | null,
    asyncValidator?: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ): FormArray<ɵElement<T, never>>;

  abstract control<T>(
    formState: T | FormControlState<T>,
    validatorOrOpts?: ValidatorFn | ValidatorFn[] | AbstractControlOptions | null,
    asyncValidator?: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ): FormControl<T>;
}

/** UntypedFormBuilder is the same as `FormBuilder`, but provides untyped controls. */
export class UntypedFormBuilder extends FormBuilder {
  override group(
    controlsConfig: {[key: string]: any},
    options?: AbstractControlOptions | null,
  ): UntypedFormGroup;
  /** @deprecated Use the `AbstractControlOptions` overload instead. */
  override group(
    controlsConfig: {[key: string]: any},
    options: {[key: string]: any},
  ): UntypedFormGroup;

  override group(
    controlsConfig: {[key: string]: any},
    options: AbstractControlOptions | {[key: string]: any} | null = null,
  ): UntypedFormGroup {
    return super.group(controlsConfig, options as AbstractControlOptions | null);
  }

  override control(
    formState: any,
    validatorOrOpts?: ValidatorFn | ValidatorFn[] | FormControlOptions | null,
    asyncValidator?: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ): UntypedFormControl {
    return super.control(formState, validatorOrOpts, asyncValidator);
  }

  override array(
    controlsConfig: any[],
    validatorOrOpts?: ValidatorFn | ValidatorFn[] | AbstractControlOptions | null,
    asyncValidator?: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ): UntypedFormArray {
    return super.array(controlsConfig, validatorOrOpts, asyncValidator);
  }
}
