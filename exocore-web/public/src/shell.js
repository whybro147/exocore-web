var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// ../node_modules/solid-js/dist/solid.js
function getContextId(count) {
  const num = String(count), len = num.length - 1;
  return sharedConfig.context.id + (len ? String.fromCharCode(96 + len) : "") + num;
}
function setHydrateContext(context) {
  sharedConfig.context = context;
}
function nextHydrateContext() {
  return {
    ...sharedConfig.context,
    id: sharedConfig.getNextContextId(),
    count: 0
  };
}
function createRoot(fn, detachedOwner) {
  const listener = Listener, owner = Owner, unowned = fn.length === 0, current = detachedOwner === void 0 ? owner : detachedOwner, root = unowned ? UNOWNED : {
    owned: null,
    cleanups: null,
    context: current ? current.context : null,
    owner: current
  }, updateFn = unowned ? fn : () => fn(() => untrack(() => cleanNode(root)));
  Owner = root;
  Listener = null;
  try {
    return runUpdates(updateFn, true);
  } finally {
    Listener = listener;
    Owner = owner;
  }
}
function createSignal(value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const s = {
    value,
    observers: null,
    observerSlots: null,
    comparator: options.equals || void 0
  };
  const setter = (value2) => {
    if (typeof value2 === "function") {
      if (Transition && Transition.running && Transition.sources.has(s)) value2 = value2(s.tValue);
      else value2 = value2(s.value);
    }
    return writeSignal(s, value2);
  };
  return [readSignal.bind(s), setter];
}
function createRenderEffect(fn, value, options) {
  const c = createComputation(fn, value, false, STALE);
  if (Scheduler && Transition && Transition.running) Updates.push(c);
  else updateComputation(c);
}
function createEffect(fn, value, options) {
  runEffects = runUserEffects;
  const c = createComputation(fn, value, false, STALE), s = SuspenseContext && useContext(SuspenseContext);
  if (s) c.suspense = s;
  if (!options || !options.render) c.user = true;
  Effects ? Effects.push(c) : updateComputation(c);
}
function createMemo(fn, value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const c = createComputation(fn, value, true, 0);
  c.observers = null;
  c.observerSlots = null;
  c.comparator = options.equals || void 0;
  if (Scheduler && Transition && Transition.running) {
    c.tState = STALE;
    Updates.push(c);
  } else updateComputation(c);
  return readSignal.bind(c);
}
function untrack(fn) {
  if (!ExternalSourceConfig && Listener === null) return fn();
  const listener = Listener;
  Listener = null;
  try {
    if (ExternalSourceConfig) return ExternalSourceConfig.untrack(fn);
    return fn();
  } finally {
    Listener = listener;
  }
}
function onMount(fn) {
  createEffect(() => untrack(fn));
}
function onCleanup(fn) {
  if (Owner === null) ;
  else if (Owner.cleanups === null) Owner.cleanups = [fn];
  else Owner.cleanups.push(fn);
  return fn;
}
function startTransition(fn) {
  if (Transition && Transition.running) {
    fn();
    return Transition.done;
  }
  const l = Listener;
  const o = Owner;
  return Promise.resolve().then(() => {
    Listener = l;
    Owner = o;
    let t;
    if (Scheduler || SuspenseContext) {
      t = Transition || (Transition = {
        sources: /* @__PURE__ */ new Set(),
        effects: [],
        promises: /* @__PURE__ */ new Set(),
        disposed: /* @__PURE__ */ new Set(),
        queue: /* @__PURE__ */ new Set(),
        running: true
      });
      t.done || (t.done = new Promise((res) => t.resolve = res));
      t.running = true;
    }
    runUpdates(fn, false);
    Listener = Owner = null;
    return t ? t.done : void 0;
  });
}
function useContext(context) {
  let value;
  return Owner && Owner.context && (value = Owner.context[context.id]) !== void 0 ? value : context.defaultValue;
}
function readSignal() {
  const runningTransition = Transition && Transition.running;
  if (this.sources && (runningTransition ? this.tState : this.state)) {
    if ((runningTransition ? this.tState : this.state) === STALE) updateComputation(this);
    else {
      const updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(this), false);
      Updates = updates;
    }
  }
  if (Listener) {
    const sSlot = this.observers ? this.observers.length : 0;
    if (!Listener.sources) {
      Listener.sources = [this];
      Listener.sourceSlots = [sSlot];
    } else {
      Listener.sources.push(this);
      Listener.sourceSlots.push(sSlot);
    }
    if (!this.observers) {
      this.observers = [Listener];
      this.observerSlots = [Listener.sources.length - 1];
    } else {
      this.observers.push(Listener);
      this.observerSlots.push(Listener.sources.length - 1);
    }
  }
  if (runningTransition && Transition.sources.has(this)) return this.tValue;
  return this.value;
}
function writeSignal(node, value, isComp) {
  let current = Transition && Transition.running && Transition.sources.has(node) ? node.tValue : node.value;
  if (!node.comparator || !node.comparator(current, value)) {
    if (Transition) {
      const TransitionRunning = Transition.running;
      if (TransitionRunning || !isComp && Transition.sources.has(node)) {
        Transition.sources.add(node);
        node.tValue = value;
      }
      if (!TransitionRunning) node.value = value;
    } else node.value = value;
    if (node.observers && node.observers.length) {
      runUpdates(() => {
        for (let i = 0; i < node.observers.length; i += 1) {
          const o = node.observers[i];
          const TransitionRunning = Transition && Transition.running;
          if (TransitionRunning && Transition.disposed.has(o)) continue;
          if (TransitionRunning ? !o.tState : !o.state) {
            if (o.pure) Updates.push(o);
            else Effects.push(o);
            if (o.observers) markDownstream(o);
          }
          if (!TransitionRunning) o.state = STALE;
          else o.tState = STALE;
        }
        if (Updates.length > 1e6) {
          Updates = [];
          if (IS_DEV) ;
          throw new Error();
        }
      }, false);
    }
  }
  return value;
}
function updateComputation(node) {
  if (!node.fn) return;
  cleanNode(node);
  const time = ExecCount;
  runComputation(node, Transition && Transition.running && Transition.sources.has(node) ? node.tValue : node.value, time);
  if (Transition && !Transition.running && Transition.sources.has(node)) {
    queueMicrotask(() => {
      runUpdates(() => {
        Transition && (Transition.running = true);
        Listener = Owner = node;
        runComputation(node, node.tValue, time);
        Listener = Owner = null;
      }, false);
    });
  }
}
function runComputation(node, value, time) {
  let nextValue;
  const owner = Owner, listener = Listener;
  Listener = Owner = node;
  try {
    nextValue = node.fn(value);
  } catch (err) {
    if (node.pure) {
      if (Transition && Transition.running) {
        node.tState = STALE;
        node.tOwned && node.tOwned.forEach(cleanNode);
        node.tOwned = void 0;
      } else {
        node.state = STALE;
        node.owned && node.owned.forEach(cleanNode);
        node.owned = null;
      }
    }
    node.updatedAt = time + 1;
    return handleError(err);
  } finally {
    Listener = listener;
    Owner = owner;
  }
  if (!node.updatedAt || node.updatedAt <= time) {
    if (node.updatedAt != null && "observers" in node) {
      writeSignal(node, nextValue, true);
    } else if (Transition && Transition.running && node.pure) {
      Transition.sources.add(node);
      node.tValue = nextValue;
    } else node.value = nextValue;
    node.updatedAt = time;
  }
}
function createComputation(fn, init, pure, state = STALE, options) {
  const c = {
    fn,
    state,
    updatedAt: null,
    owned: null,
    sources: null,
    sourceSlots: null,
    cleanups: null,
    value: init,
    owner: Owner,
    context: Owner ? Owner.context : null,
    pure
  };
  if (Transition && Transition.running) {
    c.state = 0;
    c.tState = state;
  }
  if (Owner === null) ;
  else if (Owner !== UNOWNED) {
    if (Transition && Transition.running && Owner.pure) {
      if (!Owner.tOwned) Owner.tOwned = [c];
      else Owner.tOwned.push(c);
    } else {
      if (!Owner.owned) Owner.owned = [c];
      else Owner.owned.push(c);
    }
  }
  if (ExternalSourceConfig && c.fn) {
    const [track, trigger] = createSignal(void 0, {
      equals: false
    });
    const ordinary = ExternalSourceConfig.factory(c.fn, trigger);
    onCleanup(() => ordinary.dispose());
    const triggerInTransition = () => startTransition(trigger).then(() => inTransition.dispose());
    const inTransition = ExternalSourceConfig.factory(c.fn, triggerInTransition);
    c.fn = (x) => {
      track();
      return Transition && Transition.running ? inTransition.track(x) : ordinary.track(x);
    };
  }
  return c;
}
function runTop(node) {
  const runningTransition = Transition && Transition.running;
  if ((runningTransition ? node.tState : node.state) === 0) return;
  if ((runningTransition ? node.tState : node.state) === PENDING) return lookUpstream(node);
  if (node.suspense && untrack(node.suspense.inFallback)) return node.suspense.effects.push(node);
  const ancestors = [node];
  while ((node = node.owner) && (!node.updatedAt || node.updatedAt < ExecCount)) {
    if (runningTransition && Transition.disposed.has(node)) return;
    if (runningTransition ? node.tState : node.state) ancestors.push(node);
  }
  for (let i = ancestors.length - 1; i >= 0; i--) {
    node = ancestors[i];
    if (runningTransition) {
      let top = node, prev = ancestors[i + 1];
      while ((top = top.owner) && top !== prev) {
        if (Transition.disposed.has(top)) return;
      }
    }
    if ((runningTransition ? node.tState : node.state) === STALE) {
      updateComputation(node);
    } else if ((runningTransition ? node.tState : node.state) === PENDING) {
      const updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(node, ancestors[0]), false);
      Updates = updates;
    }
  }
}
function runUpdates(fn, init) {
  if (Updates) return fn();
  let wait = false;
  if (!init) Updates = [];
  if (Effects) wait = true;
  else Effects = [];
  ExecCount++;
  try {
    const res = fn();
    completeUpdates(wait);
    return res;
  } catch (err) {
    if (!wait) Effects = null;
    Updates = null;
    handleError(err);
  }
}
function completeUpdates(wait) {
  if (Updates) {
    if (Scheduler && Transition && Transition.running) scheduleQueue(Updates);
    else runQueue(Updates);
    Updates = null;
  }
  if (wait) return;
  let res;
  if (Transition) {
    if (!Transition.promises.size && !Transition.queue.size) {
      const sources = Transition.sources;
      const disposed = Transition.disposed;
      Effects.push.apply(Effects, Transition.effects);
      res = Transition.resolve;
      for (const e2 of Effects) {
        "tState" in e2 && (e2.state = e2.tState);
        delete e2.tState;
      }
      Transition = null;
      runUpdates(() => {
        for (const d of disposed) cleanNode(d);
        for (const v of sources) {
          v.value = v.tValue;
          if (v.owned) {
            for (let i = 0, len = v.owned.length; i < len; i++) cleanNode(v.owned[i]);
          }
          if (v.tOwned) v.owned = v.tOwned;
          delete v.tValue;
          delete v.tOwned;
          v.tState = 0;
        }
        setTransPending(false);
      }, false);
    } else if (Transition.running) {
      Transition.running = false;
      Transition.effects.push.apply(Transition.effects, Effects);
      Effects = null;
      setTransPending(true);
      return;
    }
  }
  const e = Effects;
  Effects = null;
  if (e.length) runUpdates(() => runEffects(e), false);
  if (res) res();
}
function runQueue(queue) {
  for (let i = 0; i < queue.length; i++) runTop(queue[i]);
}
function scheduleQueue(queue) {
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    const tasks = Transition.queue;
    if (!tasks.has(item)) {
      tasks.add(item);
      Scheduler(() => {
        tasks.delete(item);
        runUpdates(() => {
          Transition.running = true;
          runTop(item);
        }, false);
        Transition && (Transition.running = false);
      });
    }
  }
}
function runUserEffects(queue) {
  let i, userLength = 0;
  for (i = 0; i < queue.length; i++) {
    const e = queue[i];
    if (!e.user) runTop(e);
    else queue[userLength++] = e;
  }
  if (sharedConfig.context) {
    if (sharedConfig.count) {
      sharedConfig.effects || (sharedConfig.effects = []);
      sharedConfig.effects.push(...queue.slice(0, userLength));
      return;
    }
    setHydrateContext();
  }
  if (sharedConfig.effects && (sharedConfig.done || !sharedConfig.count)) {
    queue = [...sharedConfig.effects, ...queue];
    userLength += sharedConfig.effects.length;
    delete sharedConfig.effects;
  }
  for (i = 0; i < userLength; i++) runTop(queue[i]);
}
function lookUpstream(node, ignore) {
  const runningTransition = Transition && Transition.running;
  if (runningTransition) node.tState = 0;
  else node.state = 0;
  for (let i = 0; i < node.sources.length; i += 1) {
    const source = node.sources[i];
    if (source.sources) {
      const state = runningTransition ? source.tState : source.state;
      if (state === STALE) {
        if (source !== ignore && (!source.updatedAt || source.updatedAt < ExecCount)) runTop(source);
      } else if (state === PENDING) lookUpstream(source, ignore);
    }
  }
}
function markDownstream(node) {
  const runningTransition = Transition && Transition.running;
  for (let i = 0; i < node.observers.length; i += 1) {
    const o = node.observers[i];
    if (runningTransition ? !o.tState : !o.state) {
      if (runningTransition) o.tState = PENDING;
      else o.state = PENDING;
      if (o.pure) Updates.push(o);
      else Effects.push(o);
      o.observers && markDownstream(o);
    }
  }
}
function cleanNode(node) {
  let i;
  if (node.sources) {
    while (node.sources.length) {
      const source = node.sources.pop(), index = node.sourceSlots.pop(), obs = source.observers;
      if (obs && obs.length) {
        const n = obs.pop(), s = source.observerSlots.pop();
        if (index < obs.length) {
          n.sourceSlots[s] = index;
          obs[index] = n;
          source.observerSlots[index] = s;
        }
      }
    }
  }
  if (node.tOwned) {
    for (i = node.tOwned.length - 1; i >= 0; i--) cleanNode(node.tOwned[i]);
    delete node.tOwned;
  }
  if (Transition && Transition.running && node.pure) {
    reset(node, true);
  } else if (node.owned) {
    for (i = node.owned.length - 1; i >= 0; i--) cleanNode(node.owned[i]);
    node.owned = null;
  }
  if (node.cleanups) {
    for (i = node.cleanups.length - 1; i >= 0; i--) node.cleanups[i]();
    node.cleanups = null;
  }
  if (Transition && Transition.running) node.tState = 0;
  else node.state = 0;
}
function reset(node, top) {
  if (!top) {
    node.tState = 0;
    Transition.disposed.add(node);
  }
  if (node.owned) {
    for (let i = 0; i < node.owned.length; i++) reset(node.owned[i]);
  }
}
function castError(err) {
  if (err instanceof Error) return err;
  return new Error(typeof err === "string" ? err : "Unknown error", {
    cause: err
  });
}
function runErrors(err, fns, owner) {
  try {
    for (const f of fns) f(err);
  } catch (e) {
    handleError(e, owner && owner.owner || null);
  }
}
function handleError(err, owner = Owner) {
  const fns = ERROR && owner && owner.context && owner.context[ERROR];
  const error = castError(err);
  if (!fns) throw error;
  if (Effects) Effects.push({
    fn() {
      runErrors(error, fns, owner);
    },
    state: STALE
  });
  else runErrors(error, fns, owner);
}
function createComponent(Comp, props) {
  if (hydrationEnabled) {
    if (sharedConfig.context) {
      const c = sharedConfig.context;
      setHydrateContext(nextHydrateContext());
      const r = untrack(() => Comp(props || {}));
      setHydrateContext(c);
      return r;
    }
  }
  return untrack(() => Comp(props || {}));
}
function Show(props) {
  const keyed = props.keyed;
  const conditionValue = createMemo(() => props.when, void 0, void 0);
  const condition = keyed ? conditionValue : createMemo(conditionValue, void 0, {
    equals: (a, b) => !a === !b
  });
  return createMemo(() => {
    const c = condition();
    if (c) {
      const child = props.children;
      const fn = typeof child === "function" && child.length > 0;
      return fn ? untrack(() => child(keyed ? c : () => {
        if (!untrack(condition)) throw narrowedError("Show");
        return conditionValue();
      })) : child;
    }
    return props.fallback;
  }, void 0, void 0);
}
var sharedConfig, IS_DEV, equalFn, $PROXY, $TRACK, $DEVCOMP, signalOptions, ERROR, runEffects, STALE, PENDING, UNOWNED, Owner, Transition, Scheduler, ExternalSourceConfig, Listener, Updates, Effects, ExecCount, transPending, setTransPending, SuspenseContext, FALLBACK, hydrationEnabled, narrowedError;
var init_solid = __esm({
  "../node_modules/solid-js/dist/solid.js"() {
    sharedConfig = {
      context: void 0,
      registry: void 0,
      effects: void 0,
      done: false,
      getContextId() {
        return getContextId(this.context.count);
      },
      getNextContextId() {
        return getContextId(this.context.count++);
      }
    };
    IS_DEV = false;
    equalFn = (a, b) => a === b;
    $PROXY = Symbol("solid-proxy");
    $TRACK = Symbol("solid-track");
    $DEVCOMP = Symbol("solid-dev-component");
    signalOptions = {
      equals: equalFn
    };
    ERROR = null;
    runEffects = runQueue;
    STALE = 1;
    PENDING = 2;
    UNOWNED = {
      owned: null,
      cleanups: null,
      context: null,
      owner: null
    };
    Owner = null;
    Transition = null;
    Scheduler = null;
    ExternalSourceConfig = null;
    Listener = null;
    Updates = null;
    Effects = null;
    ExecCount = 0;
    [transPending, setTransPending] = /* @__PURE__ */ createSignal(false);
    FALLBACK = Symbol("fallback");
    hydrationEnabled = false;
    narrowedError = (name) => `Stale read from <${name}>.`;
  }
});

// ../node_modules/solid-js/web/dist/web.js
function reconcileArrays(parentNode, a, b) {
  let bLength = b.length, aEnd = a.length, bEnd = bLength, aStart = 0, bStart = 0, after = a[aEnd - 1].nextSibling, map = null;
  while (aStart < aEnd || bStart < bEnd) {
    if (a[aStart] === b[bStart]) {
      aStart++;
      bStart++;
      continue;
    }
    while (a[aEnd - 1] === b[bEnd - 1]) {
      aEnd--;
      bEnd--;
    }
    if (aEnd === aStart) {
      const node = bEnd < bLength ? bStart ? b[bStart - 1].nextSibling : b[bEnd - bStart] : after;
      while (bStart < bEnd) parentNode.insertBefore(b[bStart++], node);
    } else if (bEnd === bStart) {
      while (aStart < aEnd) {
        if (!map || !map.has(a[aStart])) a[aStart].remove();
        aStart++;
      }
    } else if (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]) {
      const node = a[--aEnd].nextSibling;
      parentNode.insertBefore(b[bStart++], a[aStart++].nextSibling);
      parentNode.insertBefore(b[--bEnd], node);
      a[aEnd] = b[bEnd];
    } else {
      if (!map) {
        map = /* @__PURE__ */ new Map();
        let i = bStart;
        while (i < bEnd) map.set(b[i], i++);
      }
      const index = map.get(a[aStart]);
      if (index != null) {
        if (bStart < index && index < bEnd) {
          let i = aStart, sequence = 1, t;
          while (++i < aEnd && i < bEnd) {
            if ((t = map.get(a[i])) == null || t !== index + sequence) break;
            sequence++;
          }
          if (sequence > index - bStart) {
            const node = a[aStart];
            while (bStart < index) parentNode.insertBefore(b[bStart++], node);
          } else parentNode.replaceChild(b[bStart++], a[aStart++]);
        } else aStart++;
      } else a[aStart++].remove();
    }
  }
}
function render(code, element, init, options = {}) {
  let disposer;
  createRoot((dispose) => {
    disposer = dispose;
    element === document ? code() : insert(element, code(), element.firstChild ? null : void 0, init);
  }, options.owner);
  return () => {
    disposer();
    element.textContent = "";
  };
}
function template(html, isImportNode, isSVG, isMathML) {
  let node;
  const create = () => {
    const t = isMathML ? document.createElementNS("http://www.w3.org/1998/Math/MathML", "template") : document.createElement("template");
    t.innerHTML = html;
    return isSVG ? t.content.firstChild.firstChild : isMathML ? t.firstChild : t.content.firstChild;
  };
  const fn = isImportNode ? () => untrack(() => document.importNode(node || (node = create()), true)) : () => (node || (node = create())).cloneNode(true);
  fn.cloneNode = fn;
  return fn;
}
function delegateEvents(eventNames, document2 = window.document) {
  const e = document2[$$EVENTS] || (document2[$$EVENTS] = /* @__PURE__ */ new Set());
  for (let i = 0, l = eventNames.length; i < l; i++) {
    const name = eventNames[i];
    if (!e.has(name)) {
      e.add(name);
      document2.addEventListener(name, eventHandler);
    }
  }
}
function setAttribute(node, name, value) {
  if (isHydrating(node)) return;
  if (value == null) node.removeAttribute(name);
  else node.setAttribute(name, value);
}
function use(fn, element, arg) {
  return untrack(() => fn(element, arg));
}
function insert(parent, accessor, marker, initial) {
  if (marker !== void 0 && !initial) initial = [];
  if (typeof accessor !== "function") return insertExpression(parent, accessor, initial, marker);
  createRenderEffect((current) => insertExpression(parent, accessor(), current, marker), initial);
}
function isHydrating(node) {
  return !!sharedConfig.context && !sharedConfig.done && (!node || node.isConnected);
}
function eventHandler(e) {
  if (sharedConfig.registry && sharedConfig.events) {
    if (sharedConfig.events.find(([el, ev]) => ev === e)) return;
  }
  let node = e.target;
  const key = `$$${e.type}`;
  const oriTarget = e.target;
  const oriCurrentTarget = e.currentTarget;
  const retarget = (value) => Object.defineProperty(e, "target", {
    configurable: true,
    value
  });
  const handleNode = () => {
    const handler = node[key];
    if (handler && !node.disabled) {
      const data = node[`${key}Data`];
      data !== void 0 ? handler.call(node, data, e) : handler.call(node, e);
      if (e.cancelBubble) return;
    }
    node.host && typeof node.host !== "string" && !node.host._$host && node.contains(e.target) && retarget(node.host);
    return true;
  };
  const walkUpTree = () => {
    while (handleNode() && (node = node._$host || node.parentNode || node.host)) ;
  };
  Object.defineProperty(e, "currentTarget", {
    configurable: true,
    get() {
      return node || document;
    }
  });
  if (sharedConfig.registry && !sharedConfig.done) sharedConfig.done = _$HY.done = true;
  if (e.composedPath) {
    const path = e.composedPath();
    retarget(path[0]);
    for (let i = 0; i < path.length - 2; i++) {
      node = path[i];
      if (!handleNode()) break;
      if (node._$host) {
        node = node._$host;
        walkUpTree();
        break;
      }
      if (node.parentNode === oriCurrentTarget) {
        break;
      }
    }
  } else walkUpTree();
  retarget(oriTarget);
}
function insertExpression(parent, value, current, marker, unwrapArray) {
  const hydrating = isHydrating(parent);
  if (hydrating) {
    !current && (current = [...parent.childNodes]);
    let cleaned = [];
    for (let i = 0; i < current.length; i++) {
      const node = current[i];
      if (node.nodeType === 8 && node.data.slice(0, 2) === "!$") node.remove();
      else cleaned.push(node);
    }
    current = cleaned;
  }
  while (typeof current === "function") current = current();
  if (value === current) return current;
  const t = typeof value, multi = marker !== void 0;
  parent = multi && current[0] && current[0].parentNode || parent;
  if (t === "string" || t === "number") {
    if (hydrating) return current;
    if (t === "number") {
      value = value.toString();
      if (value === current) return current;
    }
    if (multi) {
      let node = current[0];
      if (node && node.nodeType === 3) {
        node.data !== value && (node.data = value);
      } else node = document.createTextNode(value);
      current = cleanChildren(parent, current, marker, node);
    } else {
      if (current !== "" && typeof current === "string") {
        current = parent.firstChild.data = value;
      } else current = parent.textContent = value;
    }
  } else if (value == null || t === "boolean") {
    if (hydrating) return current;
    current = cleanChildren(parent, current, marker);
  } else if (t === "function") {
    createRenderEffect(() => {
      let v = value();
      while (typeof v === "function") v = v();
      current = insertExpression(parent, v, current, marker);
    });
    return () => current;
  } else if (Array.isArray(value)) {
    const array = [];
    const currentArray = current && Array.isArray(current);
    if (normalizeIncomingArray(array, value, current, unwrapArray)) {
      createRenderEffect(() => current = insertExpression(parent, array, current, marker, true));
      return () => current;
    }
    if (hydrating) {
      if (!array.length) return current;
      if (marker === void 0) return current = [...parent.childNodes];
      let node = array[0];
      if (node.parentNode !== parent) return current;
      const nodes = [node];
      while ((node = node.nextSibling) !== marker) nodes.push(node);
      return current = nodes;
    }
    if (array.length === 0) {
      current = cleanChildren(parent, current, marker);
      if (multi) return current;
    } else if (currentArray) {
      if (current.length === 0) {
        appendNodes(parent, array, marker);
      } else reconcileArrays(parent, current, array);
    } else {
      current && cleanChildren(parent);
      appendNodes(parent, array);
    }
    current = array;
  } else if (value.nodeType) {
    if (hydrating && value.parentNode) return current = multi ? [value] : value;
    if (Array.isArray(current)) {
      if (multi) return current = cleanChildren(parent, current, marker, value);
      cleanChildren(parent, current, null, value);
    } else if (current == null || current === "" || !parent.firstChild) {
      parent.appendChild(value);
    } else parent.replaceChild(value, parent.firstChild);
    current = value;
  } else ;
  return current;
}
function normalizeIncomingArray(normalized, array, current, unwrap) {
  let dynamic = false;
  for (let i = 0, len = array.length; i < len; i++) {
    let item = array[i], prev = current && current[normalized.length], t;
    if (item == null || item === true || item === false) ;
    else if ((t = typeof item) === "object" && item.nodeType) {
      normalized.push(item);
    } else if (Array.isArray(item)) {
      dynamic = normalizeIncomingArray(normalized, item, prev) || dynamic;
    } else if (t === "function") {
      if (unwrap) {
        while (typeof item === "function") item = item();
        dynamic = normalizeIncomingArray(normalized, Array.isArray(item) ? item : [item], Array.isArray(prev) ? prev : [prev]) || dynamic;
      } else {
        normalized.push(item);
        dynamic = true;
      }
    } else {
      const value = String(item);
      if (prev && prev.nodeType === 3 && prev.data === value) normalized.push(prev);
      else normalized.push(document.createTextNode(value));
    }
  }
  return dynamic;
}
function appendNodes(parent, array, marker = null) {
  for (let i = 0, len = array.length; i < len; i++) parent.insertBefore(array[i], marker);
}
function cleanChildren(parent, current, marker, replacement) {
  if (marker === void 0) return parent.textContent = "";
  const node = replacement || document.createTextNode("");
  if (current.length) {
    let inserted = false;
    for (let i = current.length - 1; i >= 0; i--) {
      const el = current[i];
      if (node !== el) {
        const isParent = el.parentNode === parent;
        if (!inserted && !i) isParent ? parent.replaceChild(node, el) : parent.insertBefore(node, marker);
        else isParent && el.remove();
      } else inserted = true;
    }
  } else parent.insertBefore(node, marker);
  return [node];
}
var booleans, Properties, $$EVENTS, RequestContext;
var init_web = __esm({
  "../node_modules/solid-js/web/dist/web.js"() {
    init_solid();
    init_solid();
    booleans = ["allowfullscreen", "async", "autofocus", "autoplay", "checked", "controls", "default", "disabled", "formnovalidate", "hidden", "indeterminate", "inert", "ismap", "loop", "multiple", "muted", "nomodule", "novalidate", "open", "playsinline", "readonly", "required", "reversed", "seamless", "selected"];
    Properties = /* @__PURE__ */ new Set(["className", "value", "readOnly", "noValidate", "formNoValidate", "isMap", "noModule", "playsInline", ...booleans]);
    $$EVENTS = "_$DX_DELEGATE";
    RequestContext = Symbol();
  }
});

// public/shell.jsx
var require_shell = __commonJS({
  "public/shell.jsx"() {
    init_web();
    init_web();
    init_web();
    init_web();
    init_web();
    init_web();
    init_web();
    init_web();
    init_solid();
    var _tmpl$ = /* @__PURE__ */ template(`<svg width=16 height=16 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2.5 stroke-linecap=round stroke-linejoin=round><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3">`);
    var _tmpl$2 = /* @__PURE__ */ template(`<svg width=16 height=16 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2.5 stroke-linecap=round stroke-linejoin=round><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3">`);
    var _tmpl$3 = /* @__PURE__ */ template(`<svg width=16 height=16 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2.5 stroke-linecap=round stroke-linejoin=round><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1=12 y1=2 x2=12 y2=12>`);
    var _tmpl$4 = /* @__PURE__ */ template(`<div class=app-container-shell><div class=greeting-header-shell><h2 class=greeting-shell>Interactive Shell</h2></div><div class=console-wrapper><div class=console-header><div class=console-header-dots><span class=red-dot></span><span class=yellow-dot></span><span class=green-dot></span></div><button class=fullscreen-btn></button></div><div class=console-container><div class=log-output></div><div class=input-area><span class=prompt-text-display></span><div class=input-line contenteditable=true spellcheck=false></div></div></div></div><div class=bottom-bar><div class=ws-box></div><div class=controls-area><button class="btn-shell danger"> Kill Session`);
    var _tmpl$5 = /* @__PURE__ */ template(`<div class=main-wrapper-shell><style>
                :root {
                    --bg-primary: #111217; --bg-secondary: #1a1b23; --bg-tertiary: #0D0E12;
                    --text-primary: #e0e0e0; --text-secondary: #8a8f98; --accent-primary: #00aaff;
                    --accent-secondary: #0088cc; --danger-primary: #e74c3c; --danger-secondary: #c0392b;
                    --border-color: rgba(255, 255, 255, 0.1); --shadow-color: rgba(0, 0, 0, 0.5);
                    --font-body: 'Roboto', sans-serif; --font-console: 'Fira Code', monospace;
                    --radius-main: 16px; --radius-inner: 10px;
                }
                body { background-color: var(--bg-primary); color: var(--text-primary); font-family: var(--font-body); margin: 0; }
                .main-wrapper-shell { display: flex; justify-content: center; align-items: center; padding: 4vh 2vw; min-height: 100vh; }
                .app-container-shell { background: var(--bg-secondary); padding: 2rem; width: 100%; max-width: 900px; border-radius: var(--radius-main); border: 1px solid var(--border-color); box-shadow: 0 15px 40px var(--shadow-color); display: flex; flex-direction: column; gap: 1.5rem; }
                .greeting-header-shell { display: flex; justify-content: space-between; align-items: center; }
                .greeting-shell { font-size: 1.75rem; font-weight: 700; color: #fff; }
                .user-welcome-shell { font-size: 0.9rem; color: var(--text-secondary); }
                .console-wrapper { border-radius: var(--radius-inner); background: var(--bg-tertiary); box-shadow: inset 0 4px 15px rgba(0,0,0,0.4); overflow: hidden; display: flex; flex-direction: column; height: 500px; border: 1px solid var(--border-color); }
                .console-wrapper:fullscreen { width: 100vw; height: 100vh; border-radius: 0; border: none; }
                .console-header { background: var(--bg-secondary); padding: 0.6rem 1rem; display: flex; align-items: center; border-bottom: 1px solid var(--border-color); position: relative; }
                .console-header-dots { display: flex; gap: 8px; }
                .console-header-dots span { width: 12px; height: 12px; border-radius: 50%; }
                .console-header-dots .red-dot { background-color: #ff5f57; }
                .console-header-dots .yellow-dot { background-color: #ffbd2e; }
                .console-header-dots .green-dot { background-color: #28c940; }
                .fullscreen-btn { position: absolute; top: 50%; right: 1rem; transform: translateY(-50%); background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: color 0.2s ease, background-color 0.2s ease; }
                .fullscreen-btn:hover { color: var(--text-primary); background-color: rgba(255,255,255,0.1); }
                .console-container { flex-grow: 1; padding: 1rem; font-family: var(--font-console); font-size: 14px; line-height: 1.6; overflow-y: auto; cursor: text; display: flex; flex-direction: column; }
                .log-output { flex-grow: 1; white-space: pre-wrap; word-break: break-word; }
                .input-area { display: flex; margin-top: 4px; }
                .prompt-text-display { color: var(--accent-primary); margin-right: 8px; user-select: none; }
                .input-line { flex-grow: 1; outline: none; color: var(--text-primary); caret-color: var(--text-primary); }
                .bottom-bar { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
                .ws-box { padding: 0.4rem 1rem; border-radius: 99px; font-weight: 500; font-size: 0.8rem; transition: all 0.3s ease; font-family: var(--font-console); }
                .ws-box.connected { background-color: rgba(46, 204, 113, 0.15); color: #2ecc71; }
                .ws-box.disconnected, .ws-box.error { background-color: rgba(231, 76, 60, 0.15); color: var(--danger-primary); }
                .controls-area { display: flex; gap: 0.75rem; }
                .btn-shell { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.2rem; font-size: 0.9rem; font-weight: 500; color: #fff; border: 1px solid var(--border-color); border-radius: var(--radius-inner); background-color: var(--bg-secondary); cursor: pointer; transition: all 0.2s ease; }
                .btn-shell:hover { background-color: var(--border-color); border-color: rgba(255,255,255,0.2); transform: translateY(-2px); }
                .btn-shell.danger { border-color: var(--danger-primary); color: var(--danger-primary); }
                .btn-shell.danger:hover { background-color: var(--danger-primary); color: #fff; }
            `);
    var _tmpl$6 = /* @__PURE__ */ template(`<div>Loading Shell...`);
    var FullscreenIcon = () => _tmpl$();
    var ExitFullscreenIcon = () => _tmpl$2();
    var KillIcon = () => _tmpl$3();
    function App() {
      const [loading, setLoading] = createSignal(true);
      const [status, setStatus] = createSignal("");
      const [userData, setUserData] = createSignal(null);
      const [wsStatus, setWsStatus] = createSignal("Disconnected");
      const [isFullScreen, setIsFullScreen] = createSignal(false);
      const [promptText, setPromptText] = createSignal("$ ");
      let consoleRef, logOutputRef, inputLineRef;
      let ansiUpInstance = null;
      async function fetchUserInfo() {
        setLoading(true);
        setLoading(false);
      }
      function appendToLog(line, isCommand = false) {
        if (!logOutputRef) return;
        const html = ansiUpInstance ? ansiUpInstance.ansi_to_html(line) : line;
        const logEntry = document.createElement("div");
        logEntry.innerHTML = isCommand ? `<span style="color: var(--accent-secondary);">${promptText()}</span>${html}` : html;
        logOutputRef.appendChild(logEntry);
        while (logOutputRef.children.length > 250) {
          logOutputRef.removeChild(logOutputRef.firstChild);
        }
        if (consoleRef) {
          requestAnimationFrame(() => consoleRef.scrollTop = consoleRef.scrollHeight);
        }
      }
      async function sendCommand() {
        if (!inputLineRef) return;
        const cmd = inputLineRef.innerText.trim();
        if (!cmd) return;
        appendToLog(cmd, true);
        inputLineRef.innerText = "";
        try {
          await fetch("/private/server/exocore/web/shell/sent", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              command: cmd
            })
          });
        } catch (err) {
          appendToLog(`\x1B[31mFailed to send command: ${err.message}\x1B[0m`);
        }
      }
      async function handleKillShellCommand() {
        appendToLog("\x1B[33mINFO: Sending kill command...\x1B[0m");
        try {
          await fetch("/private/server/exocore/web/shell/kill", {
            method: "POST"
          });
        } catch (err) {
          appendToLog(`\x1B[31mERROR: Could not send kill command: ${err.message}\x1B[0m`);
        }
      }
      function toggleFullScreen() {
        const el = document.querySelector(".console-wrapper");
        if (!el) return;
        if (!document.fullscreenElement) {
          el.requestFullscreen().catch((err) => appendToLog(`\x1B[31mFullscreen Error: ${err.message}\x1B[0m`));
        } else {
          document.exitFullscreen();
        }
      }
      onMount(() => {
        const fontLink = document.createElement("link");
        fontLink.href = "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Fira+Code:wght@400;500&display=swap";
        fontLink.rel = "stylesheet";
        document.head.appendChild(fontLink);
        const ansiScript = document.createElement("script");
        ansiScript.src = "https://cdn.jsdelivr.net/npm/ansi_up@5.1.0/ansi_up.min.js";
        ansiScript.onload = () => {
          if (typeof AnsiUp !== "undefined") {
            ansiUpInstance = new AnsiUp();
            ansiUpInstance.use_classes = false;
          }
        };
        document.head.appendChild(ansiScript);
        fetchUserInfo();
        const wsUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/private/server/exocore/web/ws/shell`;
        function connectWebSocket() {
          const ws = new WebSocket(wsUrl);
          ws.onopen = () => setWsStatus("Connected");
          ws.onclose = () => {
            setWsStatus("Disconnected");
            setTimeout(connectWebSocket, 2e3);
          };
          ws.onerror = () => setWsStatus("Error");
          ws.onmessage = (e) => {
            try {
              const message = JSON.parse(e.data);
              if (message.type === "prompt") {
                setPromptText(message.data);
              } else {
                appendToLog(message.data);
              }
            } catch (err) {
              appendToLog(e.data);
            }
          };
        }
        connectWebSocket();
        document.addEventListener("fullscreenchange", () => setIsFullScreen(!!document.fullscreenElement));
        consoleRef?.addEventListener("click", (e) => {
          if (inputLineRef && e.target !== inputLineRef) {
            inputLineRef.focus();
          }
        });
      });
      return (() => {
        var _el$4 = _tmpl$5(), _el$5 = _el$4.firstChild;
        insert(_el$4, createComponent(Show, {
          get when() {
            return !loading();
          },
          get fallback() {
            return _tmpl$6();
          },
          get children() {
            var _el$6 = _tmpl$4(), _el$7 = _el$6.firstChild, _el$8 = _el$7.nextSibling, _el$9 = _el$8.firstChild, _el$0 = _el$9.firstChild, _el$1 = _el$0.nextSibling, _el$10 = _el$9.nextSibling, _el$11 = _el$10.firstChild, _el$12 = _el$11.nextSibling, _el$13 = _el$12.firstChild, _el$14 = _el$13.nextSibling, _el$15 = _el$8.nextSibling, _el$16 = _el$15.firstChild, _el$17 = _el$16.nextSibling, _el$18 = _el$17.firstChild, _el$19 = _el$18.firstChild;
            _el$1.$$click = toggleFullScreen;
            insert(_el$1, createComponent(Show, {
              get when() {
                return isFullScreen();
              },
              get fallback() {
                return createComponent(FullscreenIcon, {});
              },
              get children() {
                return createComponent(ExitFullscreenIcon, {});
              }
            }));
            var _ref$ = consoleRef;
            typeof _ref$ === "function" ? use(_ref$, _el$10) : consoleRef = _el$10;
            var _ref$2 = logOutputRef;
            typeof _ref$2 === "function" ? use(_ref$2, _el$11) : logOutputRef = _el$11;
            insert(_el$13, promptText);
            _el$14.$$keydown = (e) => e.key === "Enter" && (e.preventDefault(), sendCommand());
            var _ref$3 = inputLineRef;
            typeof _ref$3 === "function" ? use(_ref$3, _el$14) : inputLineRef = _el$14;
            insert(_el$16, wsStatus);
            _el$18.$$click = handleKillShellCommand;
            insert(_el$18, createComponent(KillIcon, {}), _el$19);
            createRenderEffect((_p$) => {
              var _v$ = isFullScreen() ? "Exit Fullscreen" : "Enter Fullscreen", _v$2 = !!(wsStatus() === "Connected"), _v$3 = !!(wsStatus() !== "Connected");
              _v$ !== _p$.e && setAttribute(_el$1, "title", _p$.e = _v$);
              _v$2 !== _p$.t && _el$16.classList.toggle("connected", _p$.t = _v$2);
              _v$3 !== _p$.a && _el$16.classList.toggle("disconnected", _p$.a = _v$3);
              return _p$;
            }, {
              e: void 0,
              t: void 0,
              a: void 0
            });
            return _el$6;
          }
        }), null);
        return _el$4;
      })();
    }
    render(() => createComponent(App, {}), document.getElementById("app"));
    delegateEvents(["click", "keydown"]);
  }
});
export default require_shell();
