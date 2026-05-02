/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {Observable, Subject} from 'rxjs';

import {
  asyncValidatorsDroppedWithOptsWarning,
  missingControlError,
  missingControlValueError,
  noControlsError,
  RuntimeErrorCode,
} from '../errors';
import {EventEmitter} from '../event_emitter';
import {RuntimeError} from '../runtime_error';
import {computed, signal, untracked} from '../signals';
import {ngDevMode} from '../util';
import type {AsyncValidatorFn, ValidationErrors, ValidatorFn} from '../validator_types';
import {
  addValidators,
  composeAsyncValidators,
  composeValidators,
  hasValidator,
  removeValidators,
  toObservable,
  Validators,
} from '../validators';
import type {FormArray} from './form_array';
import type {FormGroup} from './form_group';

/** Internal write-helper type — strips `readonly` from all keys. */
type Writable<T> = {-readonly [P in keyof T]: T[P]};

export const VALID = 'VALID';
export const INVALID = 'INVALID';
export const PENDING = 'PENDING';
export const DISABLED = 'DISABLED';

/**
 * A form can have several different statuses. Each
 * possible status is returned as a string literal.
 *
 * * **VALID**: no errors exist in the input value.
 * * **INVALID**: an error exists in the input value.
 * * **PENDING**: async validation is occurring and errors are not yet available.
 * * **DISABLED**: the control is exempt from ancestor calculations of validity or value.
 */
export type FormControlStatus = 'VALID' | 'INVALID' | 'PENDING' | 'DISABLED';

/** Base class for every event sent by `AbstractControl.events()`. */
export abstract class ControlEvent<T = any> {
  public abstract readonly source: AbstractControl<unknown>;
}

/** Event fired when the value of a control changes. */
export class ValueChangeEvent<T> extends ControlEvent<T> {
  constructor(
    public readonly value: T,
    public readonly source: AbstractControl,
  ) {
    super();
  }
}

/** Event fired when the control's pristine state changes (pristine <=> dirty). */
export class PristineChangeEvent extends ControlEvent {
  constructor(
    public readonly pristine: boolean,
    public readonly source: AbstractControl,
  ) {
    super();
  }
}

/** Event fired when the control's touched status changes (touched <=> untouched). */
export class TouchedChangeEvent extends ControlEvent {
  constructor(
    public readonly touched: boolean,
    public readonly source: AbstractControl,
  ) {
    super();
  }
}

/** Event fired when the control's status changes. */
export class StatusChangeEvent extends ControlEvent {
  constructor(
    public readonly status: FormControlStatus,
    public readonly source: AbstractControl,
  ) {
    super();
  }
}

/** Event fired when a form is submitted. */
export class FormSubmittedEvent extends ControlEvent {
  constructor(public readonly source: AbstractControl) {
    super();
  }
}

/** Event fired when a form is reset. */
export class FormResetEvent extends ControlEvent {
  constructor(public readonly source: AbstractControl) {
    super();
  }
}

/** Gets validators from either an options object or given validators. */
export function pickValidators(
  validatorOrOpts?: ValidatorFn | ValidatorFn[] | AbstractControlOptions | null,
): ValidatorFn | ValidatorFn[] | null {
  return (isOptionsObj(validatorOrOpts) ? validatorOrOpts.validators : validatorOrOpts) || null;
}

function coerceToValidator(validator: ValidatorFn | ValidatorFn[] | null): ValidatorFn | null {
  return Array.isArray(validator) ? composeValidators(validator) : validator || null;
}

/** Gets async validators from either an options object or given validators. */
export function pickAsyncValidators(
  asyncValidator?: AsyncValidatorFn | AsyncValidatorFn[] | null,
  validatorOrOpts?: ValidatorFn | ValidatorFn[] | AbstractControlOptions | null,
): AsyncValidatorFn | AsyncValidatorFn[] | null {
  if (ngDevMode) {
    if (isOptionsObj(validatorOrOpts) && asyncValidator) {
      console.warn(asyncValidatorsDroppedWithOptsWarning);
    }
  }
  return (isOptionsObj(validatorOrOpts) ? validatorOrOpts.asyncValidators : asyncValidator) || null;
}

function coerceToAsyncValidator(
  asyncValidator?: AsyncValidatorFn | AsyncValidatorFn[] | null,
): AsyncValidatorFn | null {
  return Array.isArray(asyncValidator)
    ? composeAsyncValidators(asyncValidator)
    : asyncValidator || null;
}

export type FormHooks = 'change' | 'blur' | 'submit';

/** Interface for options provided to an `AbstractControl`. */
export interface AbstractControlOptions {
  validators?: ValidatorFn | ValidatorFn[] | null;
  asyncValidators?: AsyncValidatorFn | AsyncValidatorFn[] | null;
  updateOn?: 'change' | 'blur' | 'submit';
}

export function isOptionsObj(
  validatorOrOpts?: ValidatorFn | ValidatorFn[] | AbstractControlOptions | null,
): validatorOrOpts is AbstractControlOptions {
  return (
    validatorOrOpts != null &&
    !Array.isArray(validatorOrOpts) &&
    typeof validatorOrOpts === 'object'
  );
}

export function assertControlPresent(parent: any, isGroup: boolean, key: string | number): void {
  const controls = parent.controls as {[key: string | number]: unknown};
  const collection = isGroup ? Object.keys(controls) : controls;
  if (!collection.length) {
    throw new RuntimeError(
      RuntimeErrorCode.NO_CONTROLS,
      ngDevMode ? noControlsError(isGroup) : '',
    );
  }
  if (!controls[key]) {
    throw new RuntimeError(
      RuntimeErrorCode.MISSING_CONTROL,
      ngDevMode ? missingControlError(isGroup, key) : '',
    );
  }
}

export function assertAllValuesPresent(control: any, isGroup: boolean, value: any): void {
  control._forEachChild((_: unknown, key: string | number) => {
    if (value[key] === undefined) {
      throw new RuntimeError(
        RuntimeErrorCode.MISSING_CONTROL_VALUE,
        ngDevMode ? missingControlValueError(isGroup, key) : '',
      );
    }
  });
}

// IsAny checks if T is `any`, by checking a condition that couldn't possibly be true otherwise.
export type ɵIsAny<T, Y, N> = 0 extends 1 & T ? Y : N;

/**
 * `TypedOrUntyped` allows one of two different types to be selected, depending on whether the Forms
 * class it's applied to is typed or not.
 */
export type ɵTypedOrUntyped<T, Typed, Untyped> = ɵIsAny<T, Untyped, Typed>;

/** Value gives the value type corresponding to a control type. */
export type ɵValue<T extends AbstractControl | undefined> =
  T extends AbstractControl<any, any> ? T['value'] : never;

/** RawValue gives the raw value type corresponding to a control type. */
export type ɵRawValue<T extends AbstractControl | undefined> =
  T extends AbstractControl<any, any>
    ? T['setValue'] extends (v: infer R) => void
      ? R
      : never
    : never;

/** Tokenize splits a string literal S by a delimiter D. */
export type ɵTokenize<S extends string, D extends string> = string extends S
  ? string[]
  : S extends `${infer T}${D}${infer U}`
    ? [T, ...ɵTokenize<U, D>]
    : [S];

/** CoerceStrArrToNumArr accepts an array of strings, and converts any numeric string to a number. */
export type ɵCoerceStrArrToNumArr<S> = S extends [infer Head, ...infer Tail]
  ? Head extends `${number}`
    ? [number, ...ɵCoerceStrArrToNumArr<Tail>]
    : [Head, ...ɵCoerceStrArrToNumArr<Tail>]
  : [];

/** Navigate takes a type T and an array K, and returns the type of T[K[0]][K[1]][K[2]]... */
export type ɵNavigate<T, K extends Array<string | number>> = T extends object
  ? K extends [infer Head, ...infer Tail]
    ? Head extends keyof T
      ? Tail extends (string | number)[]
        ? [] extends Tail
          ? T[Head]
          : ɵNavigate<T[Head], Tail>
        : any
      : never
    : any
  : any;

/** ɵWriteable removes readonly from all keys. */
export type ɵWriteable<T> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * GetProperty takes a type T and some property names or indices K. If K is a dot-separated string,
 * it is tokenized into an array before proceeding. Then, the type of the nested property at K is
 * computed: T[K[0]][K[1]][K[2]]...
 */
export type ɵGetProperty<T, K> = K extends string
  ? ɵGetProperty<T, ɵCoerceStrArrToNumArr<ɵTokenize<K, '.'>>>
  : ɵWriteable<K> extends Array<string | number>
    ? ɵNavigate<T, ɵWriteable<K>>
    : any;

/**
 * Base class for `FormControl`, `FormGroup`, and `FormArray`.
 *
 * Provides shared behavior for running validators, calculating status, resetting state, and
 * exposes the common observable streams (`valueChanges`, `statusChanges`, `events`).
 */
export abstract class AbstractControl<
  TValue = any,
  TRawValue extends TValue = TValue,
  TValueWithOptionalControlStates = any,
> {
  /** @internal */
  _pendingDirty = false;

  /** @internal */
  _hasOwnPendingAsyncValidator: null | {emitEvent: boolean; shouldHaveEmitted: boolean} = null;

  /** @internal */
  _pendingTouched = false;

  /** @internal */
  _onCollectionChange = () => {};

  /** @internal */
  _updateOn?: FormHooks;

  /** @internal */
  _hasRequired = signal(false);

  private _parent: FormGroup | FormArray | null = null;
  private _asyncValidationSubscription: any;

  private _composedValidatorFn!: ValidatorFn | null;
  private _composedAsyncValidatorFn!: AsyncValidatorFn | null;
  private _rawValidators!: ValidatorFn | ValidatorFn[] | null;
  private _rawAsyncValidators!: AsyncValidatorFn | AsyncValidatorFn[] | null;

  /**
   * The current value of the control.
   *
   * * For a `FormControl`, the current value.
   * * For an enabled `FormGroup`, the values of enabled controls as an object.
   * * For a disabled `FormGroup`, the values of all controls as an object.
   * * For an enabled `FormArray`, the values of enabled controls as an array.
   * * For a disabled `FormArray`, the values of all controls as an array.
   */
  public readonly value!: TValue;

  constructor(
    validators: ValidatorFn | ValidatorFn[] | null,
    asyncValidators: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ) {
    this._assignValidators(validators);
    this._assignAsyncValidators(asyncValidators);
  }

  get validator(): ValidatorFn | null {
    return this._composedValidatorFn;
  }
  set validator(validatorFn: ValidatorFn | null) {
    this._rawValidators = this._composedValidatorFn = validatorFn;
    this._updateHasRequiredValidator();
  }

  get asyncValidator(): AsyncValidatorFn | null {
    return this._composedAsyncValidatorFn;
  }
  set asyncValidator(asyncValidatorFn: AsyncValidatorFn | null) {
    this._rawAsyncValidators = this._composedAsyncValidatorFn = asyncValidatorFn;
  }

  get parent(): FormGroup | FormArray | null {
    return this._parent;
  }

  /** The validation status of the control. */
  get status(): FormControlStatus {
    return untracked(this.statusReactive)!;
  }
  private set status(v: FormControlStatus) {
    untracked(() => this.statusReactive.set(v));
  }
  /** @internal */
  readonly _status = computed(() => this.statusReactive());
  private readonly statusReactive = signal<FormControlStatus | undefined>(undefined);

  get valid(): boolean {
    return this.status === VALID;
  }

  get invalid(): boolean {
    return this.status === INVALID;
  }

  get pending(): boolean {
    return this.status === PENDING;
  }

  get disabled(): boolean {
    return this.status === DISABLED;
  }

  get enabled(): boolean {
    return this.status !== DISABLED;
  }

  /** An object containing any errors generated by failing validation, or null. */
  public readonly errors!: ValidationErrors | null;

  get pristine(): boolean {
    return untracked(this.pristineReactive);
  }
  private set pristine(v: boolean) {
    untracked(() => this.pristineReactive.set(v));
  }
  /** @internal */
  readonly _pristine = computed(() => this.pristineReactive());
  private readonly pristineReactive = signal(true);

  get dirty(): boolean {
    return !this.pristine;
  }

  get touched(): boolean {
    return untracked(this.touchedReactive);
  }
  private set touched(v: boolean) {
    untracked(() => this.touchedReactive.set(v));
  }
  /** @internal */
  readonly _touched = computed(() => this.touchedReactive());
  private readonly touchedReactive = signal(false);

  get untouched(): boolean {
    return !this.touched;
  }

  /** @internal */
  readonly _events = new Subject<ControlEvent<TValue>>();

  /**
   * A multicasting observable that emits an event every time the state of the control changes.
   * It emits for value, status, pristine or touched changes.
   */
  public readonly events: Observable<ControlEvent<TValue>> = this._events.asObservable();

  /**
   * A multicasting observable that emits an event every time the value of the control changes.
   */
  public readonly valueChanges!: Observable<TValue>;

  /**
   * A multicasting observable that emits an event every time the validation `status` of the control
   * recalculates.
   */
  public readonly statusChanges!: Observable<FormControlStatus>;

  get updateOn(): FormHooks {
    return this._updateOn ? this._updateOn : this.parent ? this.parent.updateOn : 'change';
  }

  setValidators(validators: ValidatorFn | ValidatorFn[] | null): void {
    this._assignValidators(validators);
  }

  setAsyncValidators(validators: AsyncValidatorFn | AsyncValidatorFn[] | null): void {
    this._assignAsyncValidators(validators);
  }

  addValidators(validators: ValidatorFn | ValidatorFn[]): void {
    this.setValidators(addValidators(validators, this._rawValidators));
  }

  addAsyncValidators(validators: AsyncValidatorFn | AsyncValidatorFn[]): void {
    this.setAsyncValidators(addValidators(validators, this._rawAsyncValidators));
  }

  removeValidators(validators: ValidatorFn | ValidatorFn[]): void {
    this.setValidators(removeValidators(validators, this._rawValidators));
  }

  removeAsyncValidators(validators: AsyncValidatorFn | AsyncValidatorFn[]): void {
    this.setAsyncValidators(removeValidators(validators, this._rawAsyncValidators));
  }

  hasValidator(validator: ValidatorFn): boolean {
    return hasValidator(this._rawValidators, validator);
  }

  hasAsyncValidator(validator: AsyncValidatorFn): boolean {
    return hasValidator(this._rawAsyncValidators, validator);
  }

  clearValidators(): void {
    this.validator = null;
  }

  clearAsyncValidators(): void {
    this.asyncValidator = null;
  }

  markAsTouched(opts?: {onlySelf?: boolean; emitEvent?: boolean}): void;
  /** @internal */
  markAsTouched(opts?: {
    onlySelf?: boolean;
    emitEvent?: boolean;
    sourceControl?: AbstractControl;
  }): void;
  markAsTouched(
    opts: {onlySelf?: boolean; emitEvent?: boolean; sourceControl?: AbstractControl} = {},
  ): void {
    const changed = this.touched === false;
    this.touched = true;

    const sourceControl = opts.sourceControl ?? this;
    if (!opts.onlySelf) {
      this._parent?.markAsTouched({...opts, sourceControl});
    }

    if (changed && opts.emitEvent !== false) {
      this._events.next(new TouchedChangeEvent(true, sourceControl));
    }
  }

  markAllAsDirty(opts: {emitEvent?: boolean} = {}): void {
    this.markAsDirty({onlySelf: true, emitEvent: opts.emitEvent, sourceControl: this});

    this._forEachChild((control: AbstractControl) => control.markAllAsDirty(opts));
  }

  markAllAsTouched(opts: {emitEvent?: boolean} = {}): void {
    this.markAsTouched({onlySelf: true, emitEvent: opts.emitEvent, sourceControl: this});

    this._forEachChild((control: AbstractControl) => control.markAllAsTouched(opts));
  }

  markAsUntouched(opts?: {onlySelf?: boolean; emitEvent?: boolean}): void;
  /** @internal */
  markAsUntouched(opts: {
    onlySelf?: boolean;
    emitEvent?: boolean;
    sourceControl?: AbstractControl;
  }): void;
  markAsUntouched(
    opts: {onlySelf?: boolean; emitEvent?: boolean; sourceControl?: AbstractControl} = {},
  ): void {
    const changed = this.touched === true;
    this.touched = false;
    this._pendingTouched = false;

    const sourceControl = opts.sourceControl ?? this;
    this._forEachChild((control: AbstractControl) => {
      control.markAsUntouched({onlySelf: true, emitEvent: opts.emitEvent, sourceControl});
    });

    if (!opts.onlySelf) {
      this._parent?._updateTouched(opts, sourceControl);
    }

    if (changed && opts.emitEvent !== false) {
      this._events.next(new TouchedChangeEvent(false, sourceControl));
    }
  }

  markAsDirty(opts?: {onlySelf?: boolean; emitEvent?: boolean}): void;
  /** @internal */
  markAsDirty(opts: {
    onlySelf?: boolean;
    emitEvent?: boolean;
    sourceControl?: AbstractControl;
  }): void;
  markAsDirty(
    opts: {onlySelf?: boolean; emitEvent?: boolean; sourceControl?: AbstractControl} = {},
  ): void {
    const changed = this.pristine === true;
    this.pristine = false;

    const sourceControl = opts.sourceControl ?? this;
    if (!opts.onlySelf) {
      this._parent?.markAsDirty({...opts, sourceControl});
    }

    if (changed && opts.emitEvent !== false) {
      this._events.next(new PristineChangeEvent(false, sourceControl));
    }
  }

  markAsPristine(opts?: {onlySelf?: boolean; emitEvent?: boolean}): void;
  /** @internal */
  markAsPristine(opts: {
    onlySelf?: boolean;
    emitEvent?: boolean;
    sourceControl?: AbstractControl;
  }): void;
  markAsPristine(
    opts: {onlySelf?: boolean; emitEvent?: boolean; sourceControl?: AbstractControl} = {},
  ): void {
    const changed = this.pristine === false;
    this.pristine = true;
    this._pendingDirty = false;

    const sourceControl = opts.sourceControl ?? this;
    this._forEachChild((control: AbstractControl) => {
      control.markAsPristine({onlySelf: true, emitEvent: opts.emitEvent});
    });

    if (!opts.onlySelf) {
      this._parent?._updatePristine(opts, sourceControl);
    }

    if (changed && opts.emitEvent !== false) {
      this._events.next(new PristineChangeEvent(true, sourceControl));
    }
  }

  markAsPending(opts?: {onlySelf?: boolean; emitEvent?: boolean}): void;
  /** @internal */
  markAsPending(opts: {
    onlySelf?: boolean;
    emitEvent?: boolean;
    sourceControl?: AbstractControl;
  }): void;
  markAsPending(
    opts: {onlySelf?: boolean; emitEvent?: boolean; sourceControl?: AbstractControl} = {},
  ): void {
    this.status = PENDING;

    const sourceControl = opts.sourceControl ?? this;
    if (opts.emitEvent !== false) {
      this._events.next(new StatusChangeEvent(this.status, sourceControl));
      (this.statusChanges as EventEmitter<FormControlStatus>).emit(this.status);
    }

    if (!opts.onlySelf) {
      this._parent?.markAsPending({...opts, sourceControl});
    }
  }

  disable(opts?: {onlySelf?: boolean; emitEvent?: boolean}): void;
  /** @internal */
  disable(opts: {onlySelf?: boolean; emitEvent?: boolean; sourceControl?: AbstractControl}): void;
  disable(
    opts: {onlySelf?: boolean; emitEvent?: boolean; sourceControl?: AbstractControl} = {},
  ): void {
    const skipPristineCheck = this._parentMarkedDirty(opts.onlySelf);

    this.status = DISABLED;
    (this as Writable<this>).errors = null;
    this._forEachChild((control: AbstractControl) => {
      control.disable({...opts, onlySelf: true});
    });
    this._updateValue();

    const sourceControl = opts.sourceControl ?? this;
    if (opts.emitEvent !== false) {
      this._events.next(new ValueChangeEvent(this.value, sourceControl));
      this._events.next(new StatusChangeEvent(this.status, sourceControl));
      (this.valueChanges as EventEmitter<TValue>).emit(this.value);
      (this.statusChanges as EventEmitter<FormControlStatus>).emit(this.status);
    }

    this._updateAncestors({...opts, skipPristineCheck}, this);
    this._onDisabledChange.forEach((changeFn) => changeFn(true));
  }

  enable(opts: {onlySelf?: boolean; emitEvent?: boolean} = {}): void {
    const skipPristineCheck = this._parentMarkedDirty(opts.onlySelf);

    this.status = VALID;
    this._forEachChild((control: AbstractControl) => {
      control.enable({...opts, onlySelf: true});
    });
    this.updateValueAndValidity({onlySelf: true, emitEvent: opts.emitEvent});

    this._updateAncestors({...opts, skipPristineCheck}, this);
    this._onDisabledChange.forEach((changeFn) => changeFn(false));
  }

  private _updateAncestors(
    opts: {onlySelf?: boolean; emitEvent?: boolean; skipPristineCheck?: boolean},
    sourceControl: AbstractControl,
  ): void {
    if (!opts.onlySelf) {
      this._parent?.updateValueAndValidity(opts);
      if (!opts.skipPristineCheck) {
        this._parent?._updatePristine({}, sourceControl);
      }
      this._parent?._updateTouched({}, sourceControl);
    }
  }

  setParent(parent: FormGroup | FormArray | null): void {
    this._parent = parent;
  }

  abstract setValue(value: TRawValue, options?: Object): void;
  abstract patchValue(value: TValue, options?: Object): void;
  abstract reset(value?: TValueWithOptionalControlStates, options?: Object): void;

  getRawValue(): any {
    return this.value;
  }

  updateValueAndValidity(opts?: {onlySelf?: boolean; emitEvent?: boolean}): void;
  /** @internal */
  updateValueAndValidity(opts: {
    onlySelf?: boolean;
    emitEvent?: boolean;
    sourceControl?: AbstractControl;
  }): void;
  updateValueAndValidity(
    opts: {onlySelf?: boolean; emitEvent?: boolean; sourceControl?: AbstractControl} = {},
  ): void {
    this._setInitialStatus();
    this._updateValue();

    if (this.enabled) {
      const shouldHaveEmitted = this._cancelExistingSubscription();

      (this as Writable<this>).errors = this._runValidator();
      this.status = this._calculateStatus();

      if (this.status === VALID || this.status === PENDING) {
        this._runAsyncValidator(shouldHaveEmitted, opts.emitEvent);
      }
    }

    const sourceControl = opts.sourceControl ?? this;
    if (opts.emitEvent !== false) {
      this._events.next(new ValueChangeEvent<TValue>(this.value, sourceControl));
      this._events.next(new StatusChangeEvent(this.status, sourceControl));
      (this.valueChanges as EventEmitter<TValue>).emit(this.value);
      (this.statusChanges as EventEmitter<FormControlStatus>).emit(this.status);
    }

    if (!opts.onlySelf) {
      this._parent?.updateValueAndValidity({...opts, sourceControl});
    }
  }

  /** @internal */
  _updateTreeValidity(opts: {emitEvent?: boolean} = {emitEvent: true}): void {
    this._forEachChild((ctrl: AbstractControl) => ctrl._updateTreeValidity(opts));
    this.updateValueAndValidity({onlySelf: true, emitEvent: opts.emitEvent});
  }

  private _setInitialStatus() {
    this.status = this._allControlsDisabled() ? DISABLED : VALID;
  }

  private _runValidator(): ValidationErrors | null {
    return this.validator ? this.validator(this) : null;
  }

  private _runAsyncValidator(shouldHaveEmitted: boolean, emitEvent?: boolean): void {
    if (this.asyncValidator) {
      this.status = PENDING;
      this._hasOwnPendingAsyncValidator = {
        emitEvent: emitEvent !== false,
        shouldHaveEmitted: shouldHaveEmitted !== false,
      };
      const obs = toObservable(this.asyncValidator(this));
      this._asyncValidationSubscription = obs.subscribe((errors: ValidationErrors | null) => {
        this._hasOwnPendingAsyncValidator = null;
        this.setErrors(errors, {emitEvent, shouldHaveEmitted});
      });
    }
  }

  private _cancelExistingSubscription(): boolean {
    if (this._asyncValidationSubscription) {
      this._asyncValidationSubscription.unsubscribe();

      const shouldHaveEmitted =
        (this._hasOwnPendingAsyncValidator?.emitEvent ||
          this._hasOwnPendingAsyncValidator?.shouldHaveEmitted) ??
        false;
      this._hasOwnPendingAsyncValidator = null;
      return shouldHaveEmitted;
    }
    return false;
  }

  setErrors(errors: ValidationErrors | null, opts?: {emitEvent?: boolean}): void;
  /** @internal */
  setErrors(
    errors: ValidationErrors | null,
    opts?: {emitEvent?: boolean; shouldHaveEmitted?: boolean},
  ): void;
  setErrors(
    errors: ValidationErrors | null,
    opts: {emitEvent?: boolean; shouldHaveEmitted?: boolean} = {},
  ): void {
    (this as Writable<this>).errors = errors;
    this._updateControlsErrors(opts.emitEvent !== false, this, opts.shouldHaveEmitted);
  }

  get<P extends string | readonly (string | number)[]>(
    path: P,
  ): AbstractControl<ɵGetProperty<TRawValue, P>> | null;
  get<P extends string | Array<string | number>>(
    path: P,
  ): AbstractControl<ɵGetProperty<TRawValue, P>> | null;
  get<P extends string | (string | number)[]>(
    path: P,
  ): AbstractControl<ɵGetProperty<TRawValue, P>> | null {
    let currPath: Array<string | number> | string = path;
    if (currPath == null) return null;
    if (!Array.isArray(currPath)) currPath = currPath.split('.');
    if (currPath.length === 0) return null;
    return currPath.reduce(
      (control: AbstractControl | null, name) => control && control._find(name),
      this,
    ) as AbstractControl<ɵGetProperty<TRawValue, P>> | null;
  }

  getError(errorCode: string, path?: Array<string | number> | string): any {
    const control = path ? this.get(path) : this;
    return control?.errors ? control.errors[errorCode] : null;
  }

  hasError(errorCode: string, path?: Array<string | number> | string): boolean {
    return !!this.getError(errorCode, path);
  }

  get root(): AbstractControl {
    let x: AbstractControl = this;

    while (x._parent) {
      x = x._parent;
    }

    return x;
  }

  /** @internal */
  _updateControlsErrors(
    emitEvent: boolean,
    changedControl: AbstractControl,
    shouldHaveEmitted?: boolean,
  ): void {
    this.status = this._calculateStatus();

    if (emitEvent) {
      (this.statusChanges as EventEmitter<FormControlStatus>).emit(this.status);
    }

    if (emitEvent || shouldHaveEmitted) {
      this._events.next(new StatusChangeEvent(this.status, changedControl));
    }

    if (this._parent) {
      this._parent._updateControlsErrors(emitEvent, changedControl, shouldHaveEmitted);
    }
  }

  /** @internal */
  _initObservables() {
    (this as Writable<this>).valueChanges = new EventEmitter<TValue>();
    (this as Writable<this>).statusChanges = new EventEmitter<FormControlStatus>();
  }

  private _calculateStatus(): FormControlStatus {
    if (this._allControlsDisabled()) return DISABLED;
    if (this.errors) return INVALID;
    if (this._hasOwnPendingAsyncValidator || this._anyControlsHaveStatus(PENDING)) return PENDING;
    if (this._anyControlsHaveStatus(INVALID)) return INVALID;
    return VALID;
  }

  /** @internal */
  abstract _updateValue(): void;

  /** @internal */
  abstract _forEachChild(cb: (c: AbstractControl) => void): void;

  /** @internal */
  abstract _anyControls(condition: (c: AbstractControl) => boolean): boolean;

  /** @internal */
  abstract _allControlsDisabled(): boolean;

  /** @internal */
  abstract _syncPendingControls(): boolean;

  /** @internal */
  _anyControlsHaveStatus(status: FormControlStatus): boolean {
    return this._anyControls((control: AbstractControl) => control.status === status);
  }

  /** @internal */
  _anyControlsDirty(): boolean {
    return this._anyControls((control: AbstractControl) => control.dirty);
  }

  /** @internal */
  _anyControlsTouched(): boolean {
    return this._anyControls((control: AbstractControl) => control.touched);
  }

  /** @internal */
  _updatePristine(opts: {onlySelf?: boolean}, changedControl: AbstractControl): void {
    const newPristine = !this._anyControlsDirty();
    const changed = this.pristine !== newPristine;
    this.pristine = newPristine;

    if (!opts.onlySelf) {
      this._parent?._updatePristine(opts, changedControl);
    }

    if (changed) {
      this._events.next(new PristineChangeEvent(this.pristine, changedControl));
    }
  }

  /** @internal */
  _updateTouched(opts: {onlySelf?: boolean} = {}, changedControl: AbstractControl): void {
    this.touched = this._anyControlsTouched();
    this._events.next(new TouchedChangeEvent(this.touched, changedControl));

    if (!opts.onlySelf) {
      this._parent?._updateTouched(opts, changedControl);
    }
  }

  /** @internal */
  _onDisabledChange: Array<(isDisabled: boolean) => void> = [];

  /** @internal */
  _registerOnCollectionChange(fn: () => void): void {
    this._onCollectionChange = fn;
  }

  /** @internal */
  _setUpdateStrategy(opts?: ValidatorFn | ValidatorFn[] | AbstractControlOptions | null): void {
    if (isOptionsObj(opts) && opts.updateOn != null) {
      this._updateOn = opts.updateOn!;
    }
  }

  private _parentMarkedDirty(onlySelf?: boolean): boolean {
    return !onlySelf && !!this._parent?.dirty && !this._parent!._anyControlsDirty();
  }

  /** @internal */
  _find(name: string | number): AbstractControl | null {
    return null;
  }

  private _assignValidators(validators: ValidatorFn | ValidatorFn[] | null): void {
    this._rawValidators = Array.isArray(validators) ? validators.slice() : validators;
    this._composedValidatorFn = coerceToValidator(this._rawValidators);
    this._updateHasRequiredValidator();
  }

  private _assignAsyncValidators(validators: AsyncValidatorFn | AsyncValidatorFn[] | null): void {
    this._rawAsyncValidators = Array.isArray(validators) ? validators.slice() : validators;
    this._composedAsyncValidatorFn = coerceToAsyncValidator(this._rawAsyncValidators);
  }

  private _updateHasRequiredValidator(): void {
    untracked(() => this._hasRequired.set(this.hasValidator(Validators.required)));
  }
}
