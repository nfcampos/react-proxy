import createPrototypeProxy from './createPrototypeProxy';
import { bindAutoBindMethods, deleteUnknownAutoBindMethods } from './bindAutoBindMethods';

export default function proxyClass(InitialClass) {
  // Prevent double wrapping.
  // Given a proxy class, return the existing proxy managing it.
  if (InitialClass.__reactPatchProxy) {
    return InitialClass.__reactPatchProxy;
  }

  const prototypeProxy = createPrototypeProxy();
  let CurrentClass;

  // Create a proxy constructor with matching name
  const ProxyClass = new Function('getCurrentClass',
    `return function ${InitialClass.name || 'ProxyClass'}() {
      return getCurrentClass().apply(this, arguments);
    }`
  )(() => CurrentClass);

  // Point proxy constructor to the proxy prototype
  ProxyClass.prototype = prototypeProxy.get();

  function update(NextClass) {
    if (typeof NextClass !== 'function') {
      throw new Error('Expected a constructor.');
    }

    // Save the next constructor so we call it
    CurrentClass = NextClass;

    // Update the prototype proxy with new methods
    const mountedInstances = prototypeProxy.update(NextClass.prototype);

    // Set up the constructor property so accessing the statics work
    ProxyClass.prototype.constructor = ProxyClass;

    // Naïvely proxy static methods and properties
    ProxyClass.prototype.constructor.__proto__ = NextClass;

    // Try to infer displayName
    ProxyClass.displayName = NextClass.name || NextClass.displayName;

    // We might have added new methods that need to be auto-bound
    mountedInstances.forEach(bindAutoBindMethods);
    mountedInstances.forEach(deleteUnknownAutoBindMethods);

    // Let the user take care of redrawing
    return mountedInstances;
  };

  function get() {
    return ProxyClass;
  }

  update(InitialClass);

  const proxy = {
    get,
    update
  };

  ProxyClass.__reactPatchProxy = proxy;
  return proxy;
}