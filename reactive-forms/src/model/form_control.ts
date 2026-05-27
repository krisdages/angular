/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {untracked} from '../signals';
import {removeListItem} from '../util';
import type {AsyncValidatorFn, ValidatorFn} from '../validator_types';

import {
  AbstractControl,
  AbstractControlOptions,
  FormResetEvent,
  isOptionsObj,
  pickAsyncValidators,
  pickValidators,
} from './abstract_model';

type Writable<T> = {-readonly [P in keyof T]: T[P]};

/**
 * FormControlState is a boxed form value. It is an object with a `value` key and a `disabled` key.
 */
export interface FormControlState<T> {
  value: T;
  disabled: boolean;
}

/**
 * Interface for options provided to a `FormControl`.
 */
export interface FormControlOptions extends AbstractControlOptions {
  /**
   * Whether to use the initial value used to construct the `FormControl` as its default value.
   * If false or omitted, the default value is `null`. When a FormControl is reset without an
   * explicit value, its value reverts to its default value.
   */
  nonNullable?: boolean;

  /** @deprecated Use `nonNullable` instead. */
  initialValueIsDefault?: boolean;
}

/**
 * Tracks the value and validation status of an individual form control.
 *
 * @overriddenImplementation ɵFormControlCtor
 */
export interface FormControl<TValue = any> extends AbstractControl<TValue> {
  /**
   * The default value of this FormControl, used whenever the control is reset without an explicit
   * value. See {@link FormControlOptions#nonNullable} for more information on configuring
   * a default value.
   */
  defaultValue: TValue;

  /** @internal */
  _onChange: Function[];

  /** @internal */
  _pendingValue: TValue;

  /** @internal */
  _pendingChange: boolean;

  setValue(
    value: TValue,
    options?: {
      onlySelf?: boolean;
      emitEvent?: boolean;
      emitModelToViewChange?: boolean;
      emitViewToModelChange?: boolean;
    },
  ): void;

  patchValue(
    value: TValue,
    options?: {
      onlySelf?: boolean;
      emitEvent?: boolean;
      emitModelToViewChange?: boolean;
      emitViewToModelChange?: boolean;
    },
  ): void;

  reset(
    formState?: TValue | FormControlState<TValue>,
    options?: {
      onlySelf?: boolean;
      emitEvent?: boolean;
      overwriteDefaultValue?: boolean;
    },
  ): void;

  getRawValue(): TValue;

  /** @internal */
  _updateValue(): void;

  /** @internal */
  _anyControls(condition: (c: AbstractControl) => boolean): boolean;

  /** @internal */
  _allControlsDisabled(): boolean;

  registerOnChange(fn: Function): void;

  /** @internal */
  _unregisterOnChange(fn: (value?: any, emitModelEvent?: boolean) => void): void;

  registerOnDisabledChange(fn: (isDisabled: boolean) => void): void;

  /** @internal */
  _unregisterOnDisabledChange(fn: (isDisabled: boolean) => void): void;

  /** @internal */
  _forEachChild(cb: (c: AbstractControl) => void): void;

  /** @internal */
  _syncPendingControls(): boolean;
}

// Avoid a naming clash with the const FormControl below.
type FormControlInterface<TValue = any> = FormControl<TValue>;

/**
 * Various available constructors for `FormControl`.
 * Do not use this interface directly. Instead, use `FormControl`:
 * ```ts
 * const fc = new FormControl('foo');
 * ```
 */
export interface ɵFormControlCtor {
  new (): FormControl<any>;

  new <T = any>(
    value: FormControlState<T> | T,
    opts: FormControlOptions & {nonNullable: true},
  ): FormControl<T>;

  /** @deprecated Use `nonNullable` instead. */
  new <T = any>(
    value: FormControlState<T> | T,
    opts: FormControlOptions & {
      initialValueIsDefault: true;
    },
  ): FormControl<T>;

  /** @deprecated When passing an `options` argument, the `asyncValidator` argument has no effect. */
  new <T = any>(
    value: FormControlState<T> | T,
    opts: FormControlOptions,
    asyncValidator: AsyncValidatorFn | AsyncValidatorFn[],
  ): FormControl<T | null>;

  new <T = any>(
    value: FormControlState<T> | T,
    validatorOrOpts?: ValidatorFn | ValidatorFn[] | FormControlOptions | null,
    asyncValidator?: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ): FormControl<T | null>;

  prototype: FormControl<any>;
}

function isFormControlState(formState: unknown): formState is FormControlState<unknown> {
  return (
    typeof formState === 'object' &&
    formState !== null &&
    Object.keys(formState).length === 2 &&
    'value' in formState &&
    'disabled' in formState
  );
}

export const FormControl: ɵFormControlCtor = class FormControl<TValue = any>
  extends AbstractControl<TValue>
  implements FormControlInterface<TValue>
{
  public defaultValue: TValue = null as unknown as TValue;

  /** @internal */
  _onChange: Array<Function> = [];

  /** @internal */
  _pendingValue!: TValue;

  /** @internal */
  _pendingChange: boolean = false;

  constructor(
    formState: FormControlState<TValue> | TValue = null as unknown as TValue,
    validatorOrOpts?: ValidatorFn | ValidatorFn[] | FormControlOptions | null,
    asyncValidator?: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ) {
    super(pickValidators(validatorOrOpts), pickAsyncValidators(asyncValidator, validatorOrOpts));
    this._applyFormState(formState);
    this._setUpdateStrategy(validatorOrOpts);
    this._initObservables();
    this.updateValueAndValidity({
      onlySelf: true,
      emitEvent: !!this.asyncValidator,
    });
    if (
      isOptionsObj(validatorOrOpts) &&
      ((validatorOrOpts as FormControlOptions).nonNullable ||
        (validatorOrOpts as FormControlOptions).initialValueIsDefault)
    ) {
      if (isFormControlState(formState)) {
        this.defaultValue = formState.value as TValue;
      } else {
        this.defaultValue = formState as TValue;
      }
    }
  }

  override setValue(
    value: TValue,
    options: {
      onlySelf?: boolean;
      emitEvent?: boolean;
      emitModelToViewChange?: boolean;
      emitViewToModelChange?: boolean;
    } = {},
  ): void {
    untracked(() => {
      (this as Writable<this>).value = this._pendingValue = value;
      if (this._onChange.length && options.emitModelToViewChange !== false) {
        this._onChange.forEach((changeFn) =>
          changeFn(this.value, options.emitViewToModelChange !== false),
        );
      }
      this.updateValueAndValidity(options);
    });
  }

  override patchValue(
    value: TValue,
    options: {
      onlySelf?: boolean;
      emitEvent?: boolean;
      emitModelToViewChange?: boolean;
      emitViewToModelChange?: boolean;
    } = {},
  ): void {
    this.setValue(value, options);
  }

  override reset(
    formState: TValue | FormControlState<TValue> = this.defaultValue,
    options: {onlySelf?: boolean; emitEvent?: boolean; overwriteDefaultValue?: boolean} = {},
  ): void {
    this._applyFormState(formState);
    this.markAsPristine(options);
    this.markAsUntouched(options);
    this.setValue(this.value, options);
    if (options.overwriteDefaultValue) {
      this.defaultValue = this.value;
    }
    this._pendingChange = false;
    if (options?.emitEvent !== false) {
      this._events.next(new FormResetEvent(this));
    }
  }

  /**  @internal */
  override _updateValue(): void {}

  /**  @internal */
  override _anyControls(condition: (c: AbstractControl) => boolean): boolean {
    return false;
  }

  /**  @internal */
  override _allControlsDisabled(): boolean {
    return this.disabled;
  }

  registerOnChange(fn: Function): void {
    this._onChange.push(fn);
  }

  /** @internal */
  _unregisterOnChange(fn: (value?: any, emitModelEvent?: boolean) => void): void {
    removeListItem(this._onChange, fn);
  }

  registerOnDisabledChange(fn: (isDisabled: boolean) => void): void {
    this._onDisabledChange.push(fn);
  }

  /** @internal */
  _unregisterOnDisabledChange(fn: (isDisabled: boolean) => void): void {
    removeListItem(this._onDisabledChange, fn);
  }

  /** @internal */
  override _forEachChild(cb: (c: AbstractControl) => void): void {}

  /** @internal */
  override _syncPendingControls(): boolean {
    if (this.updateOn === 'submit') {
      if (this._pendingDirty) this.markAsDirty();
      if (this._pendingTouched) this.markAsTouched();
      if (this._pendingChange) {
        this.setValue(this._pendingValue, {onlySelf: true, emitModelToViewChange: false});
        return true;
      }
    }
    return false;
  }

  private _applyFormState(formState: FormControlState<TValue> | TValue) {
    if (isFormControlState(formState)) {
      (this as Writable<this>).value = this._pendingValue = formState.value as TValue;
      formState.disabled
        ? this.disable({onlySelf: true, emitEvent: false})
        : this.enable({onlySelf: true, emitEvent: false});
    } else {
      (this as Writable<this>).value = this._pendingValue = formState as TValue;
    }
  }
};

interface UntypedFormControlCtor {
  new (): UntypedFormControl;

  new (
    formState?: any,
    validatorOrOpts?: ValidatorFn | ValidatorFn[] | FormControlOptions | null,
    asyncValidator?: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ): UntypedFormControl;

  prototype: FormControl<any>;
}

/** UntypedFormControl is a non-strongly-typed version of `FormControl`. */
export type UntypedFormControl = FormControl<any>;

export const UntypedFormControl: UntypedFormControlCtor = FormControl;

/** Asserts that the given control is an instance of `FormControl`. */
export const isFormControl = (control: unknown): control is FormControl =>
  control instanceof FormControl;
