/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {untracked} from '../signals';
import type {AsyncValidatorFn, ValidatorFn} from '../validator_types';

import {
  AbstractControl,
  AbstractControlOptions,
  assertAllValuesPresent,
  assertControlPresent,
  FormResetEvent,
  pickAsyncValidators,
  pickValidators,
  ɵRawValue,
  ɵTypedOrUntyped,
  ɵValue,
} from './abstract_model';
import type {FormControlState} from './form_control';

type Writable<T> = {-readonly [P in keyof T]: T[P]};

/**
 * FormGroupArgumentValue gives the input value type for FormGroup operations like `reset`. It
 * accepts a partial map of values where each value may be a `FormControlState`. The untyped case
 * falls back to `{[key: string]: any}`.
 */
export type ɵFormGroupArgumentValue<T extends {[K in keyof T]?: AbstractControl<any>}> =
  ɵTypedOrUntyped<
    T,
    Partial<{[K in keyof T]: ɵValue<T[K]> | FormControlState<ɵValue<T[K]>>}>,
    {[key: string]: any}
  >;

/** FormGroupValue extracts the type of `.value` from a FormGroup's inner object type. */
export type ɵFormGroupValue<T extends {[K in keyof T]?: AbstractControl<any>}> = ɵTypedOrUntyped<
  T,
  Partial<{[K in keyof T]: ɵValue<T[K]>}>,
  {[key: string]: any}
>;

/** FormGroupRawValue extracts the type of `.getRawValue()` from a FormGroup's inner object type. */
export type ɵFormGroupRawValue<T extends {[K in keyof T]?: AbstractControl<any>}> = ɵTypedOrUntyped<
  T,
  {[K in keyof T]: ɵRawValue<T[K]>},
  {[key: string]: any}
>;

/** OptionalKeys returns the union of all optional keys in the object. */
export type ɵOptionalKeys<T> = {
  [K in keyof T]-?: undefined extends T[K] ? K : never;
}[keyof T];

/**
 * Tracks the value and validity state of a group of `FormControl` instances.
 */
export class FormGroup<
  TControl extends {[K in keyof TControl]: AbstractControl<any>} = any,
> extends AbstractControl<
  ɵTypedOrUntyped<TControl, ɵFormGroupValue<TControl>, any>,
  ɵTypedOrUntyped<TControl, ɵFormGroupRawValue<TControl>, any>,
  ɵTypedOrUntyped<TControl, ɵFormGroupArgumentValue<TControl>, any>
> {
  constructor(
    controls: TControl,
    validatorOrOpts?: ValidatorFn | ValidatorFn[] | AbstractControlOptions | null,
    asyncValidator?: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ) {
    super(pickValidators(validatorOrOpts), pickAsyncValidators(asyncValidator, validatorOrOpts));
    validateFormGroupControls(controls);
    this.controls = controls;
    this._initObservables();
    this._setUpdateStrategy(validatorOrOpts);
    this._setUpControls();
    this.updateValueAndValidity({
      onlySelf: true,
      emitEvent: !!this.asyncValidator,
    });
  }

  public controls: ɵTypedOrUntyped<TControl, TControl, {[key: string]: AbstractControl<any>}>;

  registerControl<K extends string & keyof TControl>(name: K, control: TControl[K]): TControl[K];
  registerControl(
    this: FormGroup<{[key: string]: AbstractControl<any>}>,
    name: string,
    control: AbstractControl<any>,
  ): AbstractControl<any>;

  registerControl<K extends string & keyof TControl>(name: K, control: TControl[K]): TControl[K] {
    if (this.controls[name]) return (this.controls as any)[name];
    this.controls[name] = control;
    control.setParent(this as FormGroup);
    control._registerOnCollectionChange(this._onCollectionChange);
    return control;
  }

  addControl(
    this: FormGroup<{[key: string]: AbstractControl<any>}>,
    name: string,
    control: AbstractControl,
    options?: {emitEvent?: boolean},
  ): void;
  addControl<K extends string & keyof TControl>(
    name: K,
    control: Required<TControl>[K],
    options?: {emitEvent?: boolean},
  ): void;

  addControl<K extends string & keyof TControl>(
    name: K,
    control: Required<TControl>[K],
    options: {emitEvent?: boolean} = {},
  ): void {
    this.registerControl(name, control);
    this.updateValueAndValidity({emitEvent: options.emitEvent});
    this._onCollectionChange();
  }

  removeControl(
    this: FormGroup<{[key: string]: AbstractControl<any>}>,
    name: string,
    options?: {emitEvent?: boolean},
  ): void;
  removeControl<S extends string>(
    name: ɵOptionalKeys<TControl> & S,
    options?: {emitEvent?: boolean},
  ): void;

  removeControl(name: string, options: {emitEvent?: boolean} = {}): void {
    if ((this.controls as any)[name])
      (this.controls as any)[name]._registerOnCollectionChange(() => {});
    delete (this.controls as any)[name];
    this.updateValueAndValidity({emitEvent: options.emitEvent});
    this._onCollectionChange();
  }

  setControl<K extends string & keyof TControl>(
    name: K,
    control: TControl[K],
    options?: {emitEvent?: boolean},
  ): void;
  setControl(
    this: FormGroup<{[key: string]: AbstractControl<any>}>,
    name: string,
    control: AbstractControl,
    options?: {emitEvent?: boolean},
  ): void;

  setControl<K extends string & keyof TControl>(
    name: K,
    control: TControl[K],
    options: {emitEvent?: boolean} = {},
  ): void {
    if (this.controls[name]) this.controls[name]._registerOnCollectionChange(() => {});
    delete this.controls[name];
    if (control) this.registerControl(name, control);
    this.updateValueAndValidity({emitEvent: options.emitEvent});
    this._onCollectionChange();
  }

  contains<K extends string>(controlName: K): boolean;
  contains(this: FormGroup<{[key: string]: AbstractControl<any>}>, controlName: string): boolean;

  contains<K extends string & keyof TControl>(controlName: K): boolean {
    return this.controls.hasOwnProperty(controlName) && this.controls[controlName].enabled;
  }

  override setValue(
    value: ɵFormGroupRawValue<TControl>,
    options: {
      onlySelf?: boolean;
      emitEvent?: boolean;
    } = {},
  ): void {
    untracked(() => {
      assertAllValuesPresent(this, true, value);
      (Object.keys(value) as Array<keyof TControl>).forEach((name) => {
        assertControlPresent(this, true, name as any);
        (this.controls as any)[name].setValue((value as any)[name], {
          onlySelf: true,
          emitEvent: options.emitEvent,
        });
      });
      this.updateValueAndValidity(options);
    });
  }

  override patchValue(
    value: ɵFormGroupValue<TControl>,
    options: {
      onlySelf?: boolean;
      emitEvent?: boolean;
    } = {},
  ): void {
    if (value == null) return;
    (Object.keys(value) as Array<keyof TControl>).forEach((name) => {
      const control = (this.controls as any)[name];
      if (control) {
        control.patchValue(
          value[name as keyof ɵFormGroupValue<TControl>]!,
          {onlySelf: true, emitEvent: options.emitEvent},
        );
      }
    });
    this.updateValueAndValidity(options);
  }

  override reset(
    value: ɵTypedOrUntyped<TControl, ɵFormGroupArgumentValue<TControl>, any> = {},
    options: {onlySelf?: boolean; emitEvent?: boolean; overwriteDefaultValue?: boolean} = {},
  ): void {
    this._forEachChild((control: AbstractControl, name) => {
      control.reset(value ? (value as any)[name] : null, {...options, onlySelf: true});
    });
    this._updatePristine(options, this);
    this._updateTouched(options, this);
    this.updateValueAndValidity(options);
    if (options?.emitEvent !== false) {
      this._events.next(new FormResetEvent(this));
    }
  }

  override getRawValue(): ɵTypedOrUntyped<TControl, ɵFormGroupRawValue<TControl>, any> {
    return this._reduceChildren({}, (acc, control, name) => {
      (acc as any)[name] = (control as any).getRawValue();
      return acc;
    }) as any;
  }

  /** @internal */
  override _syncPendingControls(): boolean {
    let subtreeUpdated = this._reduceChildren(false, (updated: boolean, child) => {
      return child._syncPendingControls() ? true : updated;
    });
    if (subtreeUpdated) this.updateValueAndValidity({onlySelf: true});
    return subtreeUpdated;
  }

  /** @internal */
  override _forEachChild(cb: (v: any, k: any) => void): void {
    Object.keys(this.controls).forEach((key) => {
      const control = (this.controls as any)[key];
      control && cb(control, key);
    });
  }

  /** @internal */
  _setUpControls(): void {
    this._forEachChild((control) => {
      control.setParent(this);
      control._registerOnCollectionChange(this._onCollectionChange);
    });
  }

  /** @internal */
  override _updateValue(): void {
    (this as Writable<this>).value = this._reduceValue() as any;
  }

  /** @internal */
  override _anyControls(condition: (c: AbstractControl) => boolean): boolean {
    for (const [controlName, control] of Object.entries(this.controls)) {
      if (this.contains(controlName as any) && condition(control as any)) {
        return true;
      }
    }
    return false;
  }

  /** @internal */
  _reduceValue(): Partial<TControl> {
    let acc: Partial<TControl> = {};
    return this._reduceChildren(acc, (acc, control, name) => {
      if (control.enabled || this.disabled) {
        acc[name] = control.value;
      }
      return acc;
    });
  }

  /** @internal */
  _reduceChildren<T, K extends keyof TControl>(
    initValue: T,
    fn: (acc: T, control: TControl[K], name: K) => T,
  ): T {
    let res = initValue;
    this._forEachChild((control: TControl[K], name: K) => {
      res = fn(res, control, name);
    });
    return res;
  }

  /** @internal */
  override _allControlsDisabled(): boolean {
    for (const controlName of Object.keys(this.controls) as Array<keyof TControl>) {
      if ((this.controls as any)[controlName].enabled) {
        return false;
      }
    }
    return Object.keys(this.controls).length > 0 || this.disabled;
  }

  /** @internal */
  override _find(name: string | number): AbstractControl | null {
    return this.controls.hasOwnProperty(name as string)
      ? (this.controls as any)[name as keyof TControl]
      : null;
  }
}

/** Validates that none of the controls has a key with a dot. */
function validateFormGroupControls<TControl>(controls: {
  [K in keyof TControl]: AbstractControl<any, any>;
}) {
  const invalidKeys = Object.keys(controls).filter((key) => key.includes('.'));
  if (invalidKeys.length > 0) {
    console.warn(
      `FormGroup keys cannot include \`.\`, please replace the keys for: ${invalidKeys.join(',')}.`,
    );
  }
}

interface UntypedFormGroupCtor {
  new (
    controls: {[key: string]: AbstractControl},
    validatorOrOpts?: ValidatorFn | ValidatorFn[] | AbstractControlOptions | null,
    asyncValidator?: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ): UntypedFormGroup;

  prototype: FormGroup<any>;
}

/** UntypedFormGroup is a non-strongly-typed version of `FormGroup`. */
export type UntypedFormGroup = FormGroup<any>;

export const UntypedFormGroup: UntypedFormGroupCtor = FormGroup;

/** Asserts that the given control is an instance of `FormGroup`. */
export const isFormGroup = (control: unknown): control is FormGroup => control instanceof FormGroup;

/**
 * Tracks the value and validity state of a collection of `FormControl` instances, each of which has
 * the same value type. Like `FormGroup`, but with dynamic keys.
 */
export class FormRecord<TControl extends AbstractControl = AbstractControl> extends FormGroup<{
  [key: string]: TControl;
}> {}

export interface FormRecord<TControl> {
  registerControl(name: string, control: TControl): TControl;

  addControl(name: string, control: TControl, options?: {emitEvent?: boolean}): void;

  removeControl(name: string, options?: {emitEvent?: boolean}): void;

  setControl(name: string, control: TControl, options?: {emitEvent?: boolean}): void;

  contains(controlName: string): boolean;

  setValue(
    value: {[key: string]: ɵRawValue<TControl>},
    options?: {
      onlySelf?: boolean;
      emitEvent?: boolean;
    },
  ): void;

  patchValue(
    value: {[key: string]: ɵValue<TControl>},
    options?: {
      onlySelf?: boolean;
      emitEvent?: boolean;
    },
  ): void;

  reset(
    value?: {[key: string]: ɵValue<TControl> | FormControlState<ɵValue<TControl>>},
    options?: {
      onlySelf?: boolean;
      emitEvent?: boolean;
    },
  ): void;

  getRawValue(): {[key: string]: ɵRawValue<TControl>};
}

/** Asserts that the given control is an instance of `FormRecord`. */
export const isFormRecord = (control: unknown): control is FormRecord =>
  control instanceof FormRecord;
