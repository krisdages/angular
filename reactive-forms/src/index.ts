/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

/**
 * Standalone reactive forms library — extracted from `@angular/forms`. Framework-agnostic and
 * RxJS-compatible. Exposes the model classes (`FormControl`, `FormGroup`, `FormArray`,
 * `FormRecord`), validators, and the `FormBuilder`. Internal Angular utility types prefixed with
 * `ɵ` (omega) are exported here as part of the public surface.
 */

// Internal helpers (exposed for advanced consumers)
export {EventEmitter} from './event_emitter';
export {RuntimeError} from './runtime_error';
export {signal, computed, untracked} from './signals';
export type {Signal, WritableSignal} from './signals';

// Validator type interfaces
export type {
  AsyncValidator,
  AsyncValidatorFn,
  ValidationErrors,
  Validator,
  ValidatorFn,
} from './validator_types';

// Built-in validators
export {
  Validators,
  addValidators,
  composeAsyncValidators,
  composeValidators,
  emailValidator,
  getControlAsyncValidators,
  getControlValidators,
  hasValidator,
  makeValidatorsArray,
  maxLengthValidator,
  maxValidator,
  mergeValidators,
  minLengthValidator,
  minValidator,
  normalizeValidators,
  nullValidator,
  patternValidator,
  removeValidators,
  requiredTrueValidator,
  requiredValidator,
  toObservable,
} from './validators';

// AbstractControl base class & shared types
export {
  AbstractControl,
  ControlEvent,
  DISABLED,
  FormResetEvent,
  FormSubmittedEvent,
  INVALID,
  PENDING,
  PristineChangeEvent,
  StatusChangeEvent,
  TouchedChangeEvent,
  VALID,
  ValueChangeEvent,
  assertAllValuesPresent,
  assertControlPresent,
  isOptionsObj,
  pickAsyncValidators,
  pickValidators,
} from './model/abstract_model';
export type {
  AbstractControlOptions,
  FormControlStatus,
  FormHooks,
  // Omega utility types — exported as part of the public surface in this library:
  ɵCoerceStrArrToNumArr,
  ɵGetProperty,
  ɵIsAny,
  ɵNavigate,
  ɵRawValue,
  ɵTokenize,
  ɵTypedOrUntyped,
  ɵValue,
  ɵWriteable,
} from './model/abstract_model';

// FormControl
export {FormControl, UntypedFormControl, isFormControl} from './model/form_control';
export type {
  FormControlOptions,
  FormControlState,
  ɵFormControlCtor,
} from './model/form_control';

// FormGroup / FormRecord
export {
  FormGroup,
  FormRecord,
  UntypedFormGroup,
  isFormGroup,
  isFormRecord,
} from './model/form_group';
export type {
  ɵFormGroupArgumentValue,
  ɵFormGroupRawValue,
  ɵFormGroupValue,
  ɵOptionalKeys,
} from './model/form_group';

// FormArray
export {FormArray, UntypedFormArray, isFormArray} from './model/form_array';
export type {ɵFormArrayRawValue, ɵFormArrayValue} from './model/form_array';

// FormBuilder
export {FormBuilder, NonNullableFormBuilder, UntypedFormBuilder} from './form_builder';
export type {
  ControlConfig,
  ɵElement,
  ɵNonNullableFormControls,
  ɵNullableFormControls,
} from './form_builder';
