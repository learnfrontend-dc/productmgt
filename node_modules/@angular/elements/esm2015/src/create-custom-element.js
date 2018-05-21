/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ComponentNgElementStrategyFactory } from './component-factory-strategy';
import { createCustomEvent, getComponentInputs, getDefaultAttributeToPropertyInputs } from './utils';
/**
 * Prototype for a class constructor based on an Angular component
 * that can be used for custom element registration. Implemented and returned
 * by the {\@link createCustomElement createCustomElement() function}.
 *
 * \@experimental
 * @record
 * @template P
 */
export function NgElementConstructor() { }
function NgElementConstructor_tsickle_Closure_declarations() {
    /**
     * An array of observed attribute names for the custom element,
     * derived by transforming input property names from the source component.
     * @type {?}
     */
    NgElementConstructor.prototype.observedAttributes;
    /* TODO: handle strange member:
    new (injector: Injector): NgElement&WithProperties<P>;
    */
}
/**
 * Implements the functionality needed for a custom element.
 *
 * \@experimental
 * @abstract
 */
export class NgElement extends HTMLElement {
    constructor() {
        super(...arguments);
        /**
         * A subscription to change, connect, and disconnect events in the custom element.
         */
        this.ngElementEventsSubscription = null;
    }
}
function NgElement_tsickle_Closure_declarations() {
    /**
     * The strategy that controls how a component is transformed in a custom element.
     * @type {?}
     */
    NgElement.prototype.ngElementStrategy;
    /**
     * A subscription to change, connect, and disconnect events in the custom element.
     * @type {?}
     */
    NgElement.prototype.ngElementEventsSubscription;
    /**
     * Prototype for a handler that responds to a change in an observed attribute.
     * @abstract
     * @param {?} attrName The name of the attribute that has changed.
     * @param {?} oldValue The previous value of the attribute.
     * @param {?} newValue The new value of the attribute.
     * @param {?=} namespace The namespace in which the attribute is defined.
     * @return {?} Nothing.
     */
    NgElement.prototype.attributeChangedCallback = function (attrName, oldValue, newValue, namespace) { };
    /**
     * Prototype for a handler that responds to the insertion of the custom element in the DOM.
     * @abstract
     * @return {?} Nothing.
     */
    NgElement.prototype.connectedCallback = function () { };
    /**
     * Prototype for a handler that responds to the deletion of the custom element from the DOM.
     * @abstract
     * @return {?} Nothing.
     */
    NgElement.prototype.disconnectedCallback = function () { };
}
/**
 * A configuration that initializes an NgElementConstructor with the
 * dependencies and strategy it needs to transform a component into
 * a custom element class.
 *
 * \@experimental
 * @record
 */
export function NgElementConfig() { }
function NgElementConfig_tsickle_Closure_declarations() {
    /**
     * The injector to use for retrieving the component's factory.
     * @type {?}
     */
    NgElementConfig.prototype.injector;
    /**
     * An optional custom strategy factory to use instead of the default.
     * The strategy controls how the tranformation is performed.
     * @type {?|undefined}
     */
    NgElementConfig.prototype.strategyFactory;
}
/**
 *  \@description Creates a custom element class based on an Angular component.
 *
 * Builds a class that encapsulates the functionality of the provided component and
 * uses the configuration information to provide more context to the class.
 * Takes the component factory's inputs and outputs to convert them to the proper
 * custom element API and add hooks to input changes.
 *
 * The configuration's injector is the initial injector set on the class,
 * and used by default for each created instance.This behavior can be overridden with the
 * static property to affect all newly created instances, or as a constructor argument for
 * one-off creations.
 *
 * \@experimental
 * @template P
 * @param {?} component The component to transform.
 * @param {?} config A configuration that provides initialization information to the created class.
 * @return {?} The custom-element construction class, which can be registered with
 * a browser's `CustomElementRegistry`.
 *
 */
export function createCustomElement(component, config) {
    const /** @type {?} */ inputs = getComponentInputs(component, config.injector);
    const /** @type {?} */ strategyFactory = config.strategyFactory || new ComponentNgElementStrategyFactory(component, config.injector);
    const /** @type {?} */ attributeToPropertyInputs = getDefaultAttributeToPropertyInputs(inputs);
    class NgElementImpl extends NgElement {
        /**
         * @param {?=} injector
         */
        constructor(injector) {
            super();
            this.ngElementStrategy = strategyFactory.create(injector || config.injector);
        }
        /**
         * @param {?} attrName
         * @param {?} oldValue
         * @param {?} newValue
         * @param {?=} namespace
         * @return {?}
         */
        attributeChangedCallback(attrName, oldValue, newValue, namespace) {
            const /** @type {?} */ propName = /** @type {?} */ ((attributeToPropertyInputs[attrName]));
            this.ngElementStrategy.setInputValue(propName, newValue);
        }
        /**
         * @return {?}
         */
        connectedCallback() {
            this.ngElementStrategy.connect(this);
            // Listen for events from the strategy and dispatch them as custom events
            this.ngElementEventsSubscription = this.ngElementStrategy.events.subscribe(e => {
                const /** @type {?} */ customEvent = createCustomEvent(this.ownerDocument, e.name, e.value);
                this.dispatchEvent(customEvent);
            });
        }
        /**
         * @return {?}
         */
        disconnectedCallback() {
            this.ngElementStrategy.disconnect();
            if (this.ngElementEventsSubscription) {
                this.ngElementEventsSubscription.unsubscribe();
                this.ngElementEventsSubscription = null;
            }
        }
    }
    NgElementImpl.observedAttributes = Object.keys(attributeToPropertyInputs);
    function NgElementImpl_tsickle_Closure_declarations() {
        /** @type {?} */
        NgElementImpl.observedAttributes;
    }
    // Add getters and setters to the prototype for each property input. If the config does not
    // contain property inputs, use all inputs by default.
    inputs.map(({ propName }) => propName).forEach(property => {
        Object.defineProperty(NgElementImpl.prototype, property, {
            get: function () { return this.ngElementStrategy.getInputValue(property); },
            set: function (newValue) { this.ngElementStrategy.setInputValue(property, newValue); },
            configurable: true,
            enumerable: true,
        });
    });
    return /** @type {?} */ ((/** @type {?} */ (NgElementImpl)));
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLWN1c3RvbS1lbGVtZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvZWxlbWVudHMvc3JjL2NyZWF0ZS1jdXN0b20tZWxlbWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQVdBLE9BQU8sRUFBQyxpQ0FBaUMsRUFBQyxNQUFNLDhCQUE4QixDQUFDO0FBRS9FLE9BQU8sRUFBQyxpQkFBaUIsRUFBRSxrQkFBa0IsRUFBRSxtQ0FBbUMsRUFBQyxNQUFNLFNBQVMsQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQTRCbkcsTUFBTSxnQkFBMEIsU0FBUSxXQUFXOzs7Ozs7MkNBUVUsSUFBSTs7Q0FzQmhFOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFvREQsTUFBTSw4QkFDRixTQUFvQixFQUFFLE1BQXVCO0lBQy9DLHVCQUFNLE1BQU0sR0FBRyxrQkFBa0IsQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRTlELHVCQUFNLGVBQWUsR0FDakIsTUFBTSxDQUFDLGVBQWUsSUFBSSxJQUFJLGlDQUFpQyxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7SUFFaEcsdUJBQU0seUJBQXlCLEdBQUcsbUNBQW1DLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFOUUsbUJBQW9CLFNBQVEsU0FBUzs7OztRQUduQyxZQUFZLFFBQW1CO1lBQzdCLEtBQUssRUFBRSxDQUFDO1lBQ1IsSUFBSSxDQUFDLGlCQUFpQixHQUFHLGVBQWUsQ0FBQyxNQUFNLENBQUMsUUFBUSxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztTQUM5RTs7Ozs7Ozs7UUFFRCx3QkFBd0IsQ0FDcEIsUUFBZ0IsRUFBRSxRQUFxQixFQUFFLFFBQWdCLEVBQUUsU0FBa0I7WUFDL0UsdUJBQU0sUUFBUSxzQkFBRyx5QkFBeUIsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO1lBQ3ZELElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1NBQzFEOzs7O1FBRUQsaUJBQWlCO1lBQ2YsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQzs7WUFHckMsSUFBSSxDQUFDLDJCQUEyQixHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUM3RSx1QkFBTSxXQUFXLEdBQUcsaUJBQWlCLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDM0UsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQzthQUNqQyxDQUFDLENBQUM7U0FDSjs7OztRQUVELG9CQUFvQjtZQUNsQixJQUFJLENBQUMsaUJBQWlCLENBQUMsVUFBVSxFQUFFLENBQUM7WUFFcEMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLDJCQUEyQixDQUFDLENBQUMsQ0FBQztnQkFDckMsSUFBSSxDQUFDLDJCQUEyQixDQUFDLFdBQVcsRUFBRSxDQUFDO2dCQUMvQyxJQUFJLENBQUMsMkJBQTJCLEdBQUcsSUFBSSxDQUFDO2FBQ3pDO1NBQ0Y7O3VDQTlCb0MsTUFBTSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQzs7Ozs7OztJQW1DN0UsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUMsUUFBUSxFQUFDLEVBQUUsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRTtRQUN0RCxNQUFNLENBQUMsY0FBYyxDQUFDLGFBQWEsQ0FBQyxTQUFTLEVBQUUsUUFBUSxFQUFFO1lBQ3ZELEdBQUcsRUFBRSxjQUFhLE1BQU0sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUU7WUFDMUUsR0FBRyxFQUFFLFVBQVMsUUFBYSxJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDLEVBQUU7WUFDMUYsWUFBWSxFQUFFLElBQUk7WUFDbEIsVUFBVSxFQUFFLElBQUk7U0FDakIsQ0FBQyxDQUFDO0tBQ0osQ0FBQyxDQUFDO0lBRUgsTUFBTSxtQkFBQyxtQkFBQyxhQUFvQixFQUE0QixFQUFDO0NBQzFEIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0luamVjdG9yLCBUeXBlfSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7U3Vic2NyaXB0aW9ufSBmcm9tICdyeGpzJztcblxuaW1wb3J0IHtDb21wb25lbnROZ0VsZW1lbnRTdHJhdGVneUZhY3Rvcnl9IGZyb20gJy4vY29tcG9uZW50LWZhY3Rvcnktc3RyYXRlZ3knO1xuaW1wb3J0IHtOZ0VsZW1lbnRTdHJhdGVneSwgTmdFbGVtZW50U3RyYXRlZ3lGYWN0b3J5fSBmcm9tICcuL2VsZW1lbnQtc3RyYXRlZ3knO1xuaW1wb3J0IHtjcmVhdGVDdXN0b21FdmVudCwgZ2V0Q29tcG9uZW50SW5wdXRzLCBnZXREZWZhdWx0QXR0cmlidXRlVG9Qcm9wZXJ0eUlucHV0c30gZnJvbSAnLi91dGlscyc7XG5cbi8qKlxuICogUHJvdG90eXBlIGZvciBhIGNsYXNzIGNvbnN0cnVjdG9yIGJhc2VkIG9uIGFuIEFuZ3VsYXIgY29tcG9uZW50XG4gKiB0aGF0IGNhbiBiZSB1c2VkIGZvciBjdXN0b20gZWxlbWVudCByZWdpc3RyYXRpb24uIEltcGxlbWVudGVkIGFuZCByZXR1cm5lZFxuICogYnkgdGhlIHtAbGluayBjcmVhdGVDdXN0b21FbGVtZW50IGNyZWF0ZUN1c3RvbUVsZW1lbnQoKSBmdW5jdGlvbn0uXG4gKlxuICogQGV4cGVyaW1lbnRhbFxuICovXG5leHBvcnQgaW50ZXJmYWNlIE5nRWxlbWVudENvbnN0cnVjdG9yPFA+IHtcbiAgLyoqXG4gICAqIEFuIGFycmF5IG9mIG9ic2VydmVkIGF0dHJpYnV0ZSBuYW1lcyBmb3IgdGhlIGN1c3RvbSBlbGVtZW50LFxuICAgKiBkZXJpdmVkIGJ5IHRyYW5zZm9ybWluZyBpbnB1dCBwcm9wZXJ0eSBuYW1lcyBmcm9tIHRoZSBzb3VyY2UgY29tcG9uZW50LlxuICAgKi9cbiAgcmVhZG9ubHkgb2JzZXJ2ZWRBdHRyaWJ1dGVzOiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogSW5pdGlhbGl6ZXMgYSBjb25zdHJ1Y3RvciBpbnN0YW5jZS5cbiAgICogQHBhcmFtIGluamVjdG9yIFRoZSBzb3VyY2UgY29tcG9uZW50J3MgaW5qZWN0b3IuXG4gICAqL1xuICBuZXcgKGluamVjdG9yOiBJbmplY3Rvcik6IE5nRWxlbWVudCZXaXRoUHJvcGVydGllczxQPjtcbn1cblxuLyoqXG4gKiBJbXBsZW1lbnRzIHRoZSBmdW5jdGlvbmFsaXR5IG5lZWRlZCBmb3IgYSBjdXN0b20gZWxlbWVudC5cbiAqXG4gKiBAZXhwZXJpbWVudGFsXG4gKi9cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBOZ0VsZW1lbnQgZXh0ZW5kcyBIVE1MRWxlbWVudCB7XG4gIC8qKlxuICAgKiBUaGUgc3RyYXRlZ3kgdGhhdCBjb250cm9scyBob3cgYSBjb21wb25lbnQgaXMgdHJhbnNmb3JtZWQgaW4gYSBjdXN0b20gZWxlbWVudC5cbiAgICovXG4gIHByb3RlY3RlZCBuZ0VsZW1lbnRTdHJhdGVneTogTmdFbGVtZW50U3RyYXRlZ3k7XG4gIC8qKlxuICAgKiBBIHN1YnNjcmlwdGlvbiB0byBjaGFuZ2UsIGNvbm5lY3QsIGFuZCBkaXNjb25uZWN0IGV2ZW50cyBpbiB0aGUgY3VzdG9tIGVsZW1lbnQuXG4gICAqL1xuICBwcm90ZWN0ZWQgbmdFbGVtZW50RXZlbnRzU3Vic2NyaXB0aW9uOiBTdWJzY3JpcHRpb258bnVsbCA9IG51bGw7XG5cbiAgLyoqXG4gICAgKiBQcm90b3R5cGUgZm9yIGEgaGFuZGxlciB0aGF0IHJlc3BvbmRzIHRvIGEgY2hhbmdlIGluIGFuIG9ic2VydmVkIGF0dHJpYnV0ZS5cbiAgICAqIEBwYXJhbSBhdHRyTmFtZSBUaGUgbmFtZSBvZiB0aGUgYXR0cmlidXRlIHRoYXQgaGFzIGNoYW5nZWQuXG4gICAgKiBAcGFyYW0gb2xkVmFsdWUgVGhlIHByZXZpb3VzIHZhbHVlIG9mIHRoZSBhdHRyaWJ1dGUuXG4gICAgKiBAcGFyYW0gbmV3VmFsdWUgVGhlIG5ldyB2YWx1ZSBvZiB0aGUgYXR0cmlidXRlLlxuICAgICogQHBhcmFtIG5hbWVzcGFjZSBUaGUgbmFtZXNwYWNlIGluIHdoaWNoIHRoZSBhdHRyaWJ1dGUgaXMgZGVmaW5lZC5cbiAgICAqIEByZXR1cm5zIE5vdGhpbmcuXG4gICAgKi9cbiAgYWJzdHJhY3QgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKFxuICAgICAgYXR0ck5hbWU6IHN0cmluZywgb2xkVmFsdWU6IHN0cmluZ3xudWxsLCBuZXdWYWx1ZTogc3RyaW5nLCBuYW1lc3BhY2U/OiBzdHJpbmcpOiB2b2lkO1xuICAvKipcbiAgICogUHJvdG90eXBlIGZvciBhIGhhbmRsZXIgdGhhdCByZXNwb25kcyB0byB0aGUgaW5zZXJ0aW9uIG9mIHRoZSBjdXN0b20gZWxlbWVudCBpbiB0aGUgRE9NLlxuICAgKiBAcmV0dXJucyBOb3RoaW5nLlxuICAgKi9cbiAgYWJzdHJhY3QgY29ubmVjdGVkQ2FsbGJhY2soKTogdm9pZDtcbiAgLyoqXG4gICAqIFByb3RvdHlwZSBmb3IgYSBoYW5kbGVyIHRoYXQgcmVzcG9uZHMgdG8gdGhlIGRlbGV0aW9uIG9mIHRoZSBjdXN0b20gZWxlbWVudCBmcm9tIHRoZSBET00uXG4gICAqIEByZXR1cm5zIE5vdGhpbmcuXG4gICAqL1xuICBhYnN0cmFjdCBkaXNjb25uZWN0ZWRDYWxsYmFjaygpOiB2b2lkO1xufVxuXG4vKipcbiAqIEFkZGl0aW9uYWwgdHlwZSBpbmZvcm1hdGlvbiB0aGF0IGNhbiBiZSBhZGRlZCB0byB0aGUgTmdFbGVtZW50IGNsYXNzLFxuICogZm9yIHByb3BlcnRpZXMgdGhhdCBhcmUgYWRkZWQgYmFzZWRcbiAqIG9uIHRoZSBpbnB1dHMgYW5kIG1ldGhvZHMgb2YgdGhlIHVuZGVybHlpbmcgY29tcG9uZW50LlxuICpcbiAqIEBleHBlcmltZW50YWxcbiAqL1xuZXhwb3J0IHR5cGUgV2l0aFByb3BlcnRpZXM8UD4gPSB7XG4gIFtwcm9wZXJ0eSBpbiBrZXlvZiBQXTogUFtwcm9wZXJ0eV1cbn07XG5cbi8qKlxuICogQSBjb25maWd1cmF0aW9uIHRoYXQgaW5pdGlhbGl6ZXMgYW4gTmdFbGVtZW50Q29uc3RydWN0b3Igd2l0aCB0aGVcbiAqIGRlcGVuZGVuY2llcyBhbmQgc3RyYXRlZ3kgaXQgbmVlZHMgdG8gdHJhbnNmb3JtIGEgY29tcG9uZW50IGludG9cbiAqIGEgY3VzdG9tIGVsZW1lbnQgY2xhc3MuXG4gKlxuICogQGV4cGVyaW1lbnRhbFxuICovXG5leHBvcnQgaW50ZXJmYWNlIE5nRWxlbWVudENvbmZpZyB7XG4gIC8qKlxuICAgKiBUaGUgaW5qZWN0b3IgdG8gdXNlIGZvciByZXRyaWV2aW5nIHRoZSBjb21wb25lbnQncyBmYWN0b3J5LlxuICAgKi9cbiAgaW5qZWN0b3I6IEluamVjdG9yO1xuICAvKipcbiAgICogQW4gb3B0aW9uYWwgY3VzdG9tIHN0cmF0ZWd5IGZhY3RvcnkgdG8gdXNlIGluc3RlYWQgb2YgdGhlIGRlZmF1bHQuXG4gICAqIFRoZSBzdHJhdGVneSBjb250cm9scyBob3cgdGhlIHRyYW5mb3JtYXRpb24gaXMgcGVyZm9ybWVkLlxuICAgKi9cbiAgc3RyYXRlZ3lGYWN0b3J5PzogTmdFbGVtZW50U3RyYXRlZ3lGYWN0b3J5O1xufVxuXG4vKipcbiAqICBAZGVzY3JpcHRpb24gQ3JlYXRlcyBhIGN1c3RvbSBlbGVtZW50IGNsYXNzIGJhc2VkIG9uIGFuIEFuZ3VsYXIgY29tcG9uZW50LlxuICpcbiAqIEJ1aWxkcyBhIGNsYXNzIHRoYXQgZW5jYXBzdWxhdGVzIHRoZSBmdW5jdGlvbmFsaXR5IG9mIHRoZSBwcm92aWRlZCBjb21wb25lbnQgYW5kXG4gKiB1c2VzIHRoZSBjb25maWd1cmF0aW9uIGluZm9ybWF0aW9uIHRvIHByb3ZpZGUgbW9yZSBjb250ZXh0IHRvIHRoZSBjbGFzcy5cbiAqIFRha2VzIHRoZSBjb21wb25lbnQgZmFjdG9yeSdzIGlucHV0cyBhbmQgb3V0cHV0cyB0byBjb252ZXJ0IHRoZW0gdG8gdGhlIHByb3BlclxuICogY3VzdG9tIGVsZW1lbnQgQVBJIGFuZCBhZGQgaG9va3MgdG8gaW5wdXQgY2hhbmdlcy5cbiAqXG4gKiBUaGUgY29uZmlndXJhdGlvbidzIGluamVjdG9yIGlzIHRoZSBpbml0aWFsIGluamVjdG9yIHNldCBvbiB0aGUgY2xhc3MsXG4gKiBhbmQgdXNlZCBieSBkZWZhdWx0IGZvciBlYWNoIGNyZWF0ZWQgaW5zdGFuY2UuVGhpcyBiZWhhdmlvciBjYW4gYmUgb3ZlcnJpZGRlbiB3aXRoIHRoZVxuICogc3RhdGljIHByb3BlcnR5IHRvIGFmZmVjdCBhbGwgbmV3bHkgY3JlYXRlZCBpbnN0YW5jZXMsIG9yIGFzIGEgY29uc3RydWN0b3IgYXJndW1lbnQgZm9yXG4gKiBvbmUtb2ZmIGNyZWF0aW9ucy5cbiAqXG4gKiBAcGFyYW0gY29tcG9uZW50IFRoZSBjb21wb25lbnQgdG8gdHJhbnNmb3JtLlxuICogQHBhcmFtIGNvbmZpZyBBIGNvbmZpZ3VyYXRpb24gdGhhdCBwcm92aWRlcyBpbml0aWFsaXphdGlvbiBpbmZvcm1hdGlvbiB0byB0aGUgY3JlYXRlZCBjbGFzcy5cbiAqIEByZXR1cm5zIFRoZSBjdXN0b20tZWxlbWVudCBjb25zdHJ1Y3Rpb24gY2xhc3MsIHdoaWNoIGNhbiBiZSByZWdpc3RlcmVkIHdpdGhcbiAqIGEgYnJvd3NlcidzIGBDdXN0b21FbGVtZW50UmVnaXN0cnlgLlxuICpcbiAqIEBleHBlcmltZW50YWxcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUN1c3RvbUVsZW1lbnQ8UD4oXG4gICAgY29tcG9uZW50OiBUeXBlPGFueT4sIGNvbmZpZzogTmdFbGVtZW50Q29uZmlnKTogTmdFbGVtZW50Q29uc3RydWN0b3I8UD4ge1xuICBjb25zdCBpbnB1dHMgPSBnZXRDb21wb25lbnRJbnB1dHMoY29tcG9uZW50LCBjb25maWcuaW5qZWN0b3IpO1xuXG4gIGNvbnN0IHN0cmF0ZWd5RmFjdG9yeSA9XG4gICAgICBjb25maWcuc3RyYXRlZ3lGYWN0b3J5IHx8IG5ldyBDb21wb25lbnROZ0VsZW1lbnRTdHJhdGVneUZhY3RvcnkoY29tcG9uZW50LCBjb25maWcuaW5qZWN0b3IpO1xuXG4gIGNvbnN0IGF0dHJpYnV0ZVRvUHJvcGVydHlJbnB1dHMgPSBnZXREZWZhdWx0QXR0cmlidXRlVG9Qcm9wZXJ0eUlucHV0cyhpbnB1dHMpO1xuXG4gIGNsYXNzIE5nRWxlbWVudEltcGwgZXh0ZW5kcyBOZ0VsZW1lbnQge1xuICAgIHN0YXRpYyByZWFkb25seSBvYnNlcnZlZEF0dHJpYnV0ZXMgPSBPYmplY3Qua2V5cyhhdHRyaWJ1dGVUb1Byb3BlcnR5SW5wdXRzKTtcblxuICAgIGNvbnN0cnVjdG9yKGluamVjdG9yPzogSW5qZWN0b3IpIHtcbiAgICAgIHN1cGVyKCk7XG4gICAgICB0aGlzLm5nRWxlbWVudFN0cmF0ZWd5ID0gc3RyYXRlZ3lGYWN0b3J5LmNyZWF0ZShpbmplY3RvciB8fCBjb25maWcuaW5qZWN0b3IpO1xuICAgIH1cblxuICAgIGF0dHJpYnV0ZUNoYW5nZWRDYWxsYmFjayhcbiAgICAgICAgYXR0ck5hbWU6IHN0cmluZywgb2xkVmFsdWU6IHN0cmluZ3xudWxsLCBuZXdWYWx1ZTogc3RyaW5nLCBuYW1lc3BhY2U/OiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgIGNvbnN0IHByb3BOYW1lID0gYXR0cmlidXRlVG9Qcm9wZXJ0eUlucHV0c1thdHRyTmFtZV0gITtcbiAgICAgIHRoaXMubmdFbGVtZW50U3RyYXRlZ3kuc2V0SW5wdXRWYWx1ZShwcm9wTmFtZSwgbmV3VmFsdWUpO1xuICAgIH1cblxuICAgIGNvbm5lY3RlZENhbGxiYWNrKCk6IHZvaWQge1xuICAgICAgdGhpcy5uZ0VsZW1lbnRTdHJhdGVneS5jb25uZWN0KHRoaXMpO1xuXG4gICAgICAvLyBMaXN0ZW4gZm9yIGV2ZW50cyBmcm9tIHRoZSBzdHJhdGVneSBhbmQgZGlzcGF0Y2ggdGhlbSBhcyBjdXN0b20gZXZlbnRzXG4gICAgICB0aGlzLm5nRWxlbWVudEV2ZW50c1N1YnNjcmlwdGlvbiA9IHRoaXMubmdFbGVtZW50U3RyYXRlZ3kuZXZlbnRzLnN1YnNjcmliZShlID0+IHtcbiAgICAgICAgY29uc3QgY3VzdG9tRXZlbnQgPSBjcmVhdGVDdXN0b21FdmVudCh0aGlzLm93bmVyRG9jdW1lbnQsIGUubmFtZSwgZS52YWx1ZSk7XG4gICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChjdXN0b21FdmVudCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpOiB2b2lkIHtcbiAgICAgIHRoaXMubmdFbGVtZW50U3RyYXRlZ3kuZGlzY29ubmVjdCgpO1xuXG4gICAgICBpZiAodGhpcy5uZ0VsZW1lbnRFdmVudHNTdWJzY3JpcHRpb24pIHtcbiAgICAgICAgdGhpcy5uZ0VsZW1lbnRFdmVudHNTdWJzY3JpcHRpb24udW5zdWJzY3JpYmUoKTtcbiAgICAgICAgdGhpcy5uZ0VsZW1lbnRFdmVudHNTdWJzY3JpcHRpb24gPSBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIEFkZCBnZXR0ZXJzIGFuZCBzZXR0ZXJzIHRvIHRoZSBwcm90b3R5cGUgZm9yIGVhY2ggcHJvcGVydHkgaW5wdXQuIElmIHRoZSBjb25maWcgZG9lcyBub3RcbiAgLy8gY29udGFpbiBwcm9wZXJ0eSBpbnB1dHMsIHVzZSBhbGwgaW5wdXRzIGJ5IGRlZmF1bHQuXG4gIGlucHV0cy5tYXAoKHtwcm9wTmFtZX0pID0+IHByb3BOYW1lKS5mb3JFYWNoKHByb3BlcnR5ID0+IHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoTmdFbGVtZW50SW1wbC5wcm90b3R5cGUsIHByb3BlcnR5LCB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5uZ0VsZW1lbnRTdHJhdGVneS5nZXRJbnB1dFZhbHVlKHByb3BlcnR5KTsgfSxcbiAgICAgIHNldDogZnVuY3Rpb24obmV3VmFsdWU6IGFueSkgeyB0aGlzLm5nRWxlbWVudFN0cmF0ZWd5LnNldElucHV0VmFsdWUocHJvcGVydHksIG5ld1ZhbHVlKTsgfSxcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgfSk7XG4gIH0pO1xuXG4gIHJldHVybiAoTmdFbGVtZW50SW1wbCBhcyBhbnkpIGFzIE5nRWxlbWVudENvbnN0cnVjdG9yPFA+O1xufSJdfQ==