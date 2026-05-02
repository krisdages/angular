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

type Writable<T> = {-readonly [P in keyof T]: T[P]};

/**
 * FormArrayValue extracts the type of `.value` from a FormArray's element type, and wraps it in an
 * array.
 */
export type ɵFormArrayValue<T extends AbstractControl<any>> = ɵTypedOrUntyped<
  T,
  Array<ɵValue<T>>,
  any[]
>;

/**
 * FormArrayRawValue extracts the type of `.getRawValue()` from a FormArray's element type, and
 * wraps it in an array.
 */
export type ɵFormArrayRawValue<T extends AbstractControl<any>> = ɵTypedOrUntyped<
  T,
  Array<ɵRawValue<T>>,
  any[]
>;

/**
 * Tracks the value and validity state of an array of `FormControl`,
 * `FormGroup` or `FormArray` instances.
 */
export class FormArray<TControl extends AbstractControl<any> = any> extends AbstractControl<
  ɵTypedOrUntyped<TControl, ɵFormArrayValue<TControl>, any>,
  ɵTypedOrUntyped<TControl, ɵFormArrayRawValue<TControl>, any>
> {
  constructor(
    controls: Array<TControl>,
    validatorOrOpts?: ValidatorFn | ValidatorFn[] | AbstractControlOptions | null,
    asyncValidator?: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ) {
    super(pickValidators(validatorOrOpts), pickAsyncValidators(asyncValidator, validatorOrOpts));
    this.controls = controls;
    this._initObservables();
    this._setUpdateStrategy(validatorOrOpts);
    this._setUpControls();
    this.updateValueAndValidity({
      onlySelf: true,
      emitEvent: !!this.asyncValidator,
    });
  }

  public controls: ɵTypedOrUntyped<TControl, Array<TControl>, Array<AbstractControl<any>>>;

  at(index: number): ɵTypedOrUntyped<TControl, TControl, AbstractControl<any>> {
    return (this.controls as any)[this._adjustIndex(index)];
  }

  push(control: TControl | Array<TControl>, options: {emitEvent?: boolean} = {}): void {
    if (Array.isArray(control)) {
      control.forEach((ctrl) => {
        this.controls.push(ctrl);
        this._registerControl(ctrl);
      });
    } else {
      this.controls.push(control);
      this._registerControl(control);
    }
    this.updateValueAndValidity({emitEvent: options.emitEvent});
    this._onCollectionChange();
  }

  insert(index: number, control: TControl, options: {emitEvent?: boolean} = {}): void {
    this.controls.splice(index, 0, control);
    this._registerControl(control);
    this.updateValueAndValidity({emitEvent: options.emitEvent});
  }

  removeAt(index: number, options: {emitEvent?: boolean} = {}): void {
    let adjustedIndex = this._adjustIndex(index);
    if (adjustedIndex < 0) adjustedIndex = 0;

    if (this.controls[adjustedIndex])
      this.controls[adjustedIndex]._registerOnCollectionChange(() => {});
    this.controls.splice(adjustedIndex, 1);
    this.updateValueAndValidity({emitEvent: options.emitEvent});
  }

  setControl(index: number, control: TControl, options: {emitEvent?: boolean} = {}): void {
    let adjustedIndex = this._adjustIndex(index);
    if (adjustedIndex < 0) adjustedIndex = 0;

    if (this.controls[adjustedIndex])
      this.controls[adjustedIndex]._registerOnCollectionChange(() => {});
    this.controls.splice(adjustedIndex, 1);

    if (control) {
      this.controls.splice(adjustedIndex, 0, control);
      this._registerControl(control);
    }

    this.updateValueAndValidity({emitEvent: options.emitEvent});
    this._onCollectionChange();
  }

  get length(): number {
    return this.controls.length;
  }

  override setValue(
    value: ɵFormArrayRawValue<TControl>,
    options: {
      onlySelf?: boolean;
      emitEvent?: boolean;
    } = {},
  ): void {
    untracked(() => {
      assertAllValuesPresent(this, false, value);
      value.forEach((newValue: any, index: number) => {
        assertControlPresent(this, false, index);
        this.at(index).setValue(newValue, {onlySelf: true, emitEvent: options.emitEvent});
      });
      this.updateValueAndValidity(options);
    });
  }

  override patchValue(
    value: ɵFormArrayValue<TControl>,
    options: {
      onlySelf?: boolean;
      emitEvent?: boolean;
    } = {},
  ): void {
    if (value == null) return;

    value.forEach((newValue, index) => {
      if (this.at(index)) {
        this.at(index).patchValue(newValue, {onlySelf: true, emitEvent: options.emitEvent});
      }
    });
    this.updateValueAndValidity(options);
  }

  override reset(
    value: ɵTypedOrUntyped<TControl, ɵFormArrayValue<TControl>, any> = [],
    options: {
      onlySelf?: boolean;
      emitEvent?: boolean;
      overwriteDefaultValue?: boolean;
    } = {},
  ): void {
    this._forEachChild((control: AbstractControl, index: number) => {
      control.reset(value[index], {...options, onlySelf: true});
    });
    this._updatePristine(options, this);
    this._updateTouched(options, this);
    this.updateValueAndValidity(options);
    if (options?.emitEvent !== false) {
      this._events.next(new FormResetEvent(this));
    }
  }

  override getRawValue(): ɵFormArrayRawValue<TControl> {
    return this.controls.map((control: AbstractControl) => control.getRawValue());
  }

  clear(options: {emitEvent?: boolean} = {}): void {
    if (this.controls.length < 1) return;
    this._forEachChild((control) => control._registerOnCollectionChange(() => {}));
    this.controls.splice(0);
    this.updateValueAndValidity({emitEvent: options.emitEvent});
  }

  /** @internal */
  private _adjustIndex(index: number): number {
    return index < 0 ? index + this.length : index;
  }

  /** @internal */
  override _syncPendingControls(): boolean {
    let subtreeUpdated = (this.controls as any).reduce((updated: any, child: any) => {
      return child._syncPendingControls() ? true : updated;
    }, false);
    if (subtreeUpdated) this.updateValueAndValidity({onlySelf: true});
    return subtreeUpdated;
  }

  /** @internal */
  override _forEachChild(cb: (c: AbstractControl, index: number) => void): void {
    this.controls.forEach((control: AbstractControl, index: number) => {
      cb(control, index);
    });
  }

  /** @internal */
  override _updateValue(): void {
    (this as Writable<this>).value = this.controls
      .filter((control) => control.enabled || this.disabled)
      .map((control) => control.value) as any;
  }

  /** @internal */
  override _anyControls(condition: (c: AbstractControl) => boolean): boolean {
    return this.controls.some((control) => control.enabled && condition(control));
  }

  /** @internal */
  _setUpControls(): void {
    this._forEachChild((control) => this._registerControl(control));
  }

  /** @internal */
  override _allControlsDisabled(): boolean {
    for (const control of this.controls) {
      if (control.enabled) return false;
    }
    return this.controls.length > 0 || this.disabled;
  }

  private _registerControl(control: AbstractControl) {
    control.setParent(this);
    control._registerOnCollectionChange(this._onCollectionChange);
  }

  /** @internal */
  override _find(name: string | number): AbstractControl | null {
    return this.at(name as number) ?? null;
  }
}

interface UntypedFormArrayCtor {
  new (
    controls: AbstractControl[],
    validatorOrOpts?: ValidatorFn | ValidatorFn[] | AbstractControlOptions | null,
    asyncValidator?: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ): UntypedFormArray;

  prototype: FormArray<any>;
}

/** UntypedFormArray is a non-strongly-typed version of `FormArray`. */
export type UntypedFormArray = FormArray<any>;

export const UntypedFormArray: UntypedFormArrayCtor = FormArray;

/** Asserts that the given control is an instance of `FormArray`. */
export const isFormArray = (control: unknown): control is FormArray => control instanceof FormArray;
