/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
import { ComponentFactoryResolver } from '@angular/core';
const /** @type {?} */ elProto = /** @type {?} */ (Element.prototype);
const /** @type {?} */ matches = elProto.matches || elProto.matchesSelector || elProto.mozMatchesSelector ||
    elProto.msMatchesSelector || elProto.oMatchesSelector || elProto.webkitMatchesSelector;
/**
 * Provide methods for scheduling the execution of a callback.
 */
export const /** @type {?} */ scheduler = {
    /**
     * Schedule a callback to be called after some delay.
     *
     * Returns a function that when executed will cancel the scheduled function.
     * @param {?} taskFn
     * @param {?} delay
     * @return {?}
     */
    schedule(taskFn, delay) { const /** @type {?} */ id = setTimeout(taskFn, delay); return () => clearTimeout(id); },
    /**
     * Schedule a callback to be called before the next render.
     * (If `window.requestAnimationFrame()` is not available, use `scheduler.schedule()` instead.)
     *
     * Returns a function that when executed will cancel the scheduled function.
     * @param {?} taskFn
     * @return {?}
     */
    scheduleBeforeRender(taskFn) {
        // TODO(gkalpak): Implement a better way of accessing `requestAnimationFrame()`
        //                (e.g. accounting for vendor prefix, SSR-compatibility, etc).
        if (typeof window === 'undefined') {
            // For SSR just schedule immediately.
            return scheduler.schedule(taskFn, 0);
        }
        if (typeof window.requestAnimationFrame === 'undefined') {
            const /** @type {?} */ frameMs = 16;
            return scheduler.schedule(taskFn, frameMs);
        }
        const /** @type {?} */ id = window.requestAnimationFrame(taskFn);
        return () => window.cancelAnimationFrame(id);
    },
};
/**
 * Convert a camelCased string to kebab-cased.
 * @param {?} input
 * @return {?}
 */
export function camelToDashCase(input) {
    return input.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`);
}
/**
 * Create a `CustomEvent` (even on browsers where `CustomEvent` is not a constructor).
 * @param {?} doc
 * @param {?} name
 * @param {?} detail
 * @return {?}
 */
export function createCustomEvent(doc, name, detail) {
    const /** @type {?} */ bubbles = false;
    const /** @type {?} */ cancelable = false;
    // On IE9-11, `CustomEvent` is not a constructor.
    if (typeof CustomEvent !== 'function') {
        const /** @type {?} */ event = doc.createEvent('CustomEvent');
        event.initCustomEvent(name, bubbles, cancelable, detail);
        return event;
    }
    return new CustomEvent(name, { bubbles, cancelable, detail });
}
/**
 * Check whether the input is an `Element`.
 * @param {?} node
 * @return {?}
 */
export function isElement(node) {
    return node.nodeType === Node.ELEMENT_NODE;
}
/**
 * Check whether the input is a function.
 * @param {?} value
 * @return {?}
 */
export function isFunction(value) {
    return typeof value === 'function';
}
/**
 * Convert a kebab-cased string to camelCased.
 * @param {?} input
 * @return {?}
 */
export function kebabToCamelCase(input) {
    return input.replace(/-([a-z\d])/g, (_, char) => char.toUpperCase());
}
/**
 * Check whether an `Element` matches a CSS selector.
 * @param {?} element
 * @param {?} selector
 * @return {?}
 */
export function matchesSelector(element, selector) {
    return matches.call(element, selector);
}
/**
 * Test two values for strict equality, accounting for the fact that `NaN !== NaN`.
 * @param {?} value1
 * @param {?} value2
 * @return {?}
 */
export function strictEquals(value1, value2) {
    return value1 === value2 || (value1 !== value1 && value2 !== value2);
}
/**
 * Gets a map of default set of attributes to observe and the properties they affect.
 * @param {?} inputs
 * @return {?}
 */
export function getDefaultAttributeToPropertyInputs(inputs) {
    const /** @type {?} */ attributeToPropertyInputs = {};
    inputs.forEach(({ propName, templateName }) => {
        attributeToPropertyInputs[camelToDashCase(templateName)] = propName;
    });
    return attributeToPropertyInputs;
}
/**
 * Gets a component's set of inputs. Uses the injector to get the component factory where the inputs
 * are defined.
 * @param {?} component
 * @param {?} injector
 * @return {?}
 */
export function getComponentInputs(component, injector) {
    const /** @type {?} */ componentFactoryResolver = injector.get(ComponentFactoryResolver);
    const /** @type {?} */ componentFactory = componentFactoryResolver.resolveComponentFactory(component);
    return componentFactory.inputs;
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9lbGVtZW50cy9zcmMvdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7OztBQU9BLE9BQU8sRUFBQyx3QkFBd0IsRUFBaUIsTUFBTSxlQUFlLENBQUM7QUFFdkUsdUJBQU0sT0FBTyxxQkFBRyxPQUFPLENBQUMsU0FBZ0IsQ0FBQSxDQUFDO0FBQ3pDLHVCQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxlQUFlLElBQUksT0FBTyxDQUFDLGtCQUFrQjtJQUNwRixPQUFPLENBQUMsaUJBQWlCLElBQUksT0FBTyxDQUFDLGdCQUFnQixJQUFJLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQzs7OztBQUszRixNQUFNLENBQUMsdUJBQU0sU0FBUyxHQUFHOzs7Ozs7Ozs7SUFNdkIsUUFBUSxDQUFDLE1BQWtCLEVBQUUsS0FBYSxJQUNqQyx1QkFBTSxFQUFFLEdBQUcsVUFBVSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBQzs7Ozs7Ozs7O0lBUTlFLG9CQUFvQixDQUFDLE1BQWtCOzs7UUFHckMsRUFBRSxDQUFDLENBQUMsT0FBTyxNQUFNLEtBQUssV0FBVyxDQUFDLENBQUMsQ0FBQzs7WUFFbEMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO1NBQ3RDO1FBRUQsRUFBRSxDQUFDLENBQUMsT0FBTyxNQUFNLENBQUMscUJBQXFCLEtBQUssV0FBVyxDQUFDLENBQUMsQ0FBQztZQUN4RCx1QkFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDO1lBQ25CLE1BQU0sQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQztTQUM1QztRQUVELHVCQUFNLEVBQUUsR0FBRyxNQUFNLENBQUMscUJBQXFCLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDaEQsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLENBQUMsQ0FBQztLQUM5QztDQUNGLENBQUM7Ozs7OztBQUtGLE1BQU0sMEJBQTBCLEtBQWE7SUFDM0MsTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0NBQ2xFOzs7Ozs7OztBQUtELE1BQU0sNEJBQTRCLEdBQWEsRUFBRSxJQUFZLEVBQUUsTUFBVztJQUN4RSx1QkFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDO0lBQ3RCLHVCQUFNLFVBQVUsR0FBRyxLQUFLLENBQUM7O0lBR3pCLEVBQUUsQ0FBQyxDQUFDLE9BQU8sV0FBVyxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDdEMsdUJBQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDN0MsS0FBSyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUN6RCxNQUFNLENBQUMsS0FBSyxDQUFDO0tBQ2Q7SUFFRCxNQUFNLENBQUMsSUFBSSxXQUFXLENBQUMsSUFBSSxFQUFFLEVBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUMsQ0FBQyxDQUFDO0NBQzdEOzs7Ozs7QUFLRCxNQUFNLG9CQUFvQixJQUFVO0lBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxLQUFLLElBQUksQ0FBQyxZQUFZLENBQUM7Q0FDNUM7Ozs7OztBQUtELE1BQU0scUJBQXFCLEtBQVU7SUFDbkMsTUFBTSxDQUFDLE9BQU8sS0FBSyxLQUFLLFVBQVUsQ0FBQztDQUNwQzs7Ozs7O0FBS0QsTUFBTSwyQkFBMkIsS0FBYTtJQUM1QyxNQUFNLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztDQUN0RTs7Ozs7OztBQUtELE1BQU0sMEJBQTBCLE9BQWdCLEVBQUUsUUFBZ0I7SUFDaEUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0NBQ3hDOzs7Ozs7O0FBS0QsTUFBTSx1QkFBdUIsTUFBVyxFQUFFLE1BQVc7SUFDbkQsTUFBTSxDQUFDLE1BQU0sS0FBSyxNQUFNLElBQUksQ0FBQyxNQUFNLEtBQUssTUFBTSxJQUFJLE1BQU0sS0FBSyxNQUFNLENBQUMsQ0FBQztDQUN0RTs7Ozs7O0FBR0QsTUFBTSw4Q0FDRixNQUFrRDtJQUNwRCx1QkFBTSx5QkFBeUIsR0FBNEIsRUFBRSxDQUFDO0lBQzlELE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFDLFFBQVEsRUFBRSxZQUFZLEVBQUMsRUFBRSxFQUFFO1FBQzFDLHlCQUF5QixDQUFDLGVBQWUsQ0FBQyxZQUFZLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQztLQUNyRSxDQUFDLENBQUM7SUFFSCxNQUFNLENBQUMseUJBQXlCLENBQUM7Q0FDbEM7Ozs7Ozs7O0FBTUQsTUFBTSw2QkFDRixTQUFvQixFQUFFLFFBQWtCO0lBQzFDLHVCQUFNLHdCQUF3QixHQUE2QixRQUFRLENBQUMsR0FBRyxDQUFDLHdCQUF3QixDQUFDLENBQUM7SUFDbEcsdUJBQU0sZ0JBQWdCLEdBQUcsd0JBQXdCLENBQUMsdUJBQXVCLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDckYsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQztDQUNoQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7Q29tcG9uZW50RmFjdG9yeVJlc29sdmVyLCBJbmplY3RvciwgVHlwZX0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5cbmNvbnN0IGVsUHJvdG8gPSBFbGVtZW50LnByb3RvdHlwZSBhcyBhbnk7XG5jb25zdCBtYXRjaGVzID0gZWxQcm90by5tYXRjaGVzIHx8IGVsUHJvdG8ubWF0Y2hlc1NlbGVjdG9yIHx8IGVsUHJvdG8ubW96TWF0Y2hlc1NlbGVjdG9yIHx8XG4gICAgZWxQcm90by5tc01hdGNoZXNTZWxlY3RvciB8fCBlbFByb3RvLm9NYXRjaGVzU2VsZWN0b3IgfHwgZWxQcm90by53ZWJraXRNYXRjaGVzU2VsZWN0b3I7XG5cbi8qKlxuICogUHJvdmlkZSBtZXRob2RzIGZvciBzY2hlZHVsaW5nIHRoZSBleGVjdXRpb24gb2YgYSBjYWxsYmFjay5cbiAqL1xuZXhwb3J0IGNvbnN0IHNjaGVkdWxlciA9IHtcbiAgLyoqXG4gICAqIFNjaGVkdWxlIGEgY2FsbGJhY2sgdG8gYmUgY2FsbGVkIGFmdGVyIHNvbWUgZGVsYXkuXG4gICAqXG4gICAqIFJldHVybnMgYSBmdW5jdGlvbiB0aGF0IHdoZW4gZXhlY3V0ZWQgd2lsbCBjYW5jZWwgdGhlIHNjaGVkdWxlZCBmdW5jdGlvbi5cbiAgICovXG4gIHNjaGVkdWxlKHRhc2tGbjogKCkgPT4gdm9pZCwgZGVsYXk6IG51bWJlcik6ICgpID0+XG4gICAgICB2b2lke2NvbnN0IGlkID0gc2V0VGltZW91dCh0YXNrRm4sIGRlbGF5KTsgcmV0dXJuICgpID0+IGNsZWFyVGltZW91dChpZCk7fSxcblxuICAvKipcbiAgICogU2NoZWR1bGUgYSBjYWxsYmFjayB0byBiZSBjYWxsZWQgYmVmb3JlIHRoZSBuZXh0IHJlbmRlci5cbiAgICogKElmIGB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKClgIGlzIG5vdCBhdmFpbGFibGUsIHVzZSBgc2NoZWR1bGVyLnNjaGVkdWxlKClgIGluc3RlYWQuKVxuICAgKlxuICAgKiBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCB3aGVuIGV4ZWN1dGVkIHdpbGwgY2FuY2VsIHRoZSBzY2hlZHVsZWQgZnVuY3Rpb24uXG4gICAqL1xuICBzY2hlZHVsZUJlZm9yZVJlbmRlcih0YXNrRm46ICgpID0+IHZvaWQpOiAoKSA9PiB2b2lke1xuICAgIC8vIFRPRE8oZ2thbHBhayk6IEltcGxlbWVudCBhIGJldHRlciB3YXkgb2YgYWNjZXNzaW5nIGByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKWBcbiAgICAvLyAgICAgICAgICAgICAgICAoZS5nLiBhY2NvdW50aW5nIGZvciB2ZW5kb3IgcHJlZml4LCBTU1ItY29tcGF0aWJpbGl0eSwgZXRjKS5cbiAgICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIC8vIEZvciBTU1IganVzdCBzY2hlZHVsZSBpbW1lZGlhdGVseS5cbiAgICAgIHJldHVybiBzY2hlZHVsZXIuc2NoZWR1bGUodGFza0ZuLCAwKTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBjb25zdCBmcmFtZU1zID0gMTY7XG4gICAgICByZXR1cm4gc2NoZWR1bGVyLnNjaGVkdWxlKHRhc2tGbiwgZnJhbWVNcyk7XG4gICAgfVxuXG4gICAgY29uc3QgaWQgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRhc2tGbik7XG4gICAgcmV0dXJuICgpID0+IHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZShpZCk7XG4gIH0sXG59O1xuXG4vKipcbiAqIENvbnZlcnQgYSBjYW1lbENhc2VkIHN0cmluZyB0byBrZWJhYi1jYXNlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNhbWVsVG9EYXNoQ2FzZShpbnB1dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGlucHV0LnJlcGxhY2UoL1tBLVpdL2csIGNoYXIgPT4gYC0ke2NoYXIudG9Mb3dlckNhc2UoKX1gKTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBgQ3VzdG9tRXZlbnRgIChldmVuIG9uIGJyb3dzZXJzIHdoZXJlIGBDdXN0b21FdmVudGAgaXMgbm90IGEgY29uc3RydWN0b3IpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ3VzdG9tRXZlbnQoZG9jOiBEb2N1bWVudCwgbmFtZTogc3RyaW5nLCBkZXRhaWw6IGFueSk6IEN1c3RvbUV2ZW50IHtcbiAgY29uc3QgYnViYmxlcyA9IGZhbHNlO1xuICBjb25zdCBjYW5jZWxhYmxlID0gZmFsc2U7XG5cbiAgLy8gT24gSUU5LTExLCBgQ3VzdG9tRXZlbnRgIGlzIG5vdCBhIGNvbnN0cnVjdG9yLlxuICBpZiAodHlwZW9mIEN1c3RvbUV2ZW50ICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgY29uc3QgZXZlbnQgPSBkb2MuY3JlYXRlRXZlbnQoJ0N1c3RvbUV2ZW50Jyk7XG4gICAgZXZlbnQuaW5pdEN1c3RvbUV2ZW50KG5hbWUsIGJ1YmJsZXMsIGNhbmNlbGFibGUsIGRldGFpbCk7XG4gICAgcmV0dXJuIGV2ZW50O1xuICB9XG5cbiAgcmV0dXJuIG5ldyBDdXN0b21FdmVudChuYW1lLCB7YnViYmxlcywgY2FuY2VsYWJsZSwgZGV0YWlsfSk7XG59XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgaW5wdXQgaXMgYW4gYEVsZW1lbnRgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNFbGVtZW50KG5vZGU6IE5vZGUpOiBub2RlIGlzIEVsZW1lbnQge1xuICByZXR1cm4gbm9kZS5ub2RlVHlwZSA9PT0gTm9kZS5FTEVNRU5UX05PREU7XG59XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgaW5wdXQgaXMgYSBmdW5jdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRnVuY3Rpb24odmFsdWU6IGFueSk6IHZhbHVlIGlzIEZ1bmN0aW9uIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGEga2ViYWItY2FzZWQgc3RyaW5nIHRvIGNhbWVsQ2FzZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBrZWJhYlRvQ2FtZWxDYXNlKGlucHV0OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gaW5wdXQucmVwbGFjZSgvLShbYS16XFxkXSkvZywgKF8sIGNoYXIpID0+IGNoYXIudG9VcHBlckNhc2UoKSk7XG59XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciBhbiBgRWxlbWVudGAgbWF0Y2hlcyBhIENTUyBzZWxlY3Rvci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoZXNTZWxlY3RvcihlbGVtZW50OiBFbGVtZW50LCBzZWxlY3Rvcjogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBtYXRjaGVzLmNhbGwoZWxlbWVudCwgc2VsZWN0b3IpO1xufVxuXG4vKipcbiAqIFRlc3QgdHdvIHZhbHVlcyBmb3Igc3RyaWN0IGVxdWFsaXR5LCBhY2NvdW50aW5nIGZvciB0aGUgZmFjdCB0aGF0IGBOYU4gIT09IE5hTmAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdHJpY3RFcXVhbHModmFsdWUxOiBhbnksIHZhbHVlMjogYW55KTogYm9vbGVhbiB7XG4gIHJldHVybiB2YWx1ZTEgPT09IHZhbHVlMiB8fCAodmFsdWUxICE9PSB2YWx1ZTEgJiYgdmFsdWUyICE9PSB2YWx1ZTIpO1xufVxuXG4vKiogR2V0cyBhIG1hcCBvZiBkZWZhdWx0IHNldCBvZiBhdHRyaWJ1dGVzIHRvIG9ic2VydmUgYW5kIHRoZSBwcm9wZXJ0aWVzIHRoZXkgYWZmZWN0LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldERlZmF1bHRBdHRyaWJ1dGVUb1Byb3BlcnR5SW5wdXRzKFxuICAgIGlucHV0czoge3Byb3BOYW1lOiBzdHJpbmcsIHRlbXBsYXRlTmFtZTogc3RyaW5nfVtdKSB7XG4gIGNvbnN0IGF0dHJpYnV0ZVRvUHJvcGVydHlJbnB1dHM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gIGlucHV0cy5mb3JFYWNoKCh7cHJvcE5hbWUsIHRlbXBsYXRlTmFtZX0pID0+IHtcbiAgICBhdHRyaWJ1dGVUb1Byb3BlcnR5SW5wdXRzW2NhbWVsVG9EYXNoQ2FzZSh0ZW1wbGF0ZU5hbWUpXSA9IHByb3BOYW1lO1xuICB9KTtcblxuICByZXR1cm4gYXR0cmlidXRlVG9Qcm9wZXJ0eUlucHV0cztcbn1cblxuLyoqXG4gKiBHZXRzIGEgY29tcG9uZW50J3Mgc2V0IG9mIGlucHV0cy4gVXNlcyB0aGUgaW5qZWN0b3IgdG8gZ2V0IHRoZSBjb21wb25lbnQgZmFjdG9yeSB3aGVyZSB0aGUgaW5wdXRzXG4gKiBhcmUgZGVmaW5lZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldENvbXBvbmVudElucHV0cyhcbiAgICBjb21wb25lbnQ6IFR5cGU8YW55PiwgaW5qZWN0b3I6IEluamVjdG9yKToge3Byb3BOYW1lOiBzdHJpbmcsIHRlbXBsYXRlTmFtZTogc3RyaW5nfVtdIHtcbiAgY29uc3QgY29tcG9uZW50RmFjdG9yeVJlc29sdmVyOiBDb21wb25lbnRGYWN0b3J5UmVzb2x2ZXIgPSBpbmplY3Rvci5nZXQoQ29tcG9uZW50RmFjdG9yeVJlc29sdmVyKTtcbiAgY29uc3QgY29tcG9uZW50RmFjdG9yeSA9IGNvbXBvbmVudEZhY3RvcnlSZXNvbHZlci5yZXNvbHZlQ29tcG9uZW50RmFjdG9yeShjb21wb25lbnQpO1xuICByZXR1cm4gY29tcG9uZW50RmFjdG9yeS5pbnB1dHM7XG59XG4iXX0=