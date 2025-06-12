var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn2, res) => function __init() {
  return fn2 && (res = (0, fn2[__getOwnPropNames(fn2)[0]])(fn2 = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// ../node_modules/solid-js/dist/solid.js
function getContextId(count) {
  const num = String(count), len = num.length - 1;
  return sharedConfig.context.id + (len ? String.fromCharCode(96 + len) : "") + num;
}
function setHydrateContext(context2) {
  sharedConfig.context = context2;
}
function nextHydrateContext() {
  return {
    ...sharedConfig.context,
    id: sharedConfig.getNextContextId(),
    count: 0
  };
}
function createRoot(fn2, detachedOwner) {
  const listener = Listener, owner = Owner, unowned = fn2.length === 0, current = detachedOwner === void 0 ? owner : detachedOwner, root = unowned ? UNOWNED : {
    owned: null,
    cleanups: null,
    context: current ? current.context : null,
    owner: current
  }, updateFn = unowned ? fn2 : () => fn2(() => untrack(() => cleanNode(root)));
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
function createComputed(fn2, value, options) {
  const c = createComputation(fn2, value, true, STALE);
  if (Scheduler && Transition && Transition.running) Updates.push(c);
  else updateComputation(c);
}
function createRenderEffect(fn2, value, options) {
  const c = createComputation(fn2, value, false, STALE);
  if (Scheduler && Transition && Transition.running) Updates.push(c);
  else updateComputation(c);
}
function createEffect(fn2, value, options) {
  runEffects = runUserEffects;
  const c = createComputation(fn2, value, false, STALE), s = SuspenseContext && useContext(SuspenseContext);
  if (s) c.suspense = s;
  if (!options || !options.render) c.user = true;
  Effects ? Effects.push(c) : updateComputation(c);
}
function createMemo(fn2, value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const c = createComputation(fn2, value, true, 0);
  c.observers = null;
  c.observerSlots = null;
  c.comparator = options.equals || void 0;
  if (Scheduler && Transition && Transition.running) {
    c.tState = STALE;
    Updates.push(c);
  } else updateComputation(c);
  return readSignal.bind(c);
}
function isPromise(v) {
  return v && typeof v === "object" && "then" in v;
}
function createResource(pSource, pFetcher, pOptions) {
  let source;
  let fetcher;
  let options;
  if (typeof pFetcher === "function") {
    source = pSource;
    fetcher = pFetcher;
    options = pOptions || {};
  } else {
    source = true;
    fetcher = pSource;
    options = pFetcher || {};
  }
  let pr = null, initP = NO_INIT, id = null, loadedUnderTransition = false, scheduled = false, resolved = "initialValue" in options, dynamic = typeof source === "function" && createMemo(source);
  const contexts = /* @__PURE__ */ new Set(), [value, setValue] = (options.storage || createSignal)(options.initialValue), [error, setError] = createSignal(void 0), [track, trigger] = createSignal(void 0, {
    equals: false
  }), [state, setState] = createSignal(resolved ? "ready" : "unresolved");
  if (sharedConfig.context) {
    id = sharedConfig.getNextContextId();
    if (options.ssrLoadFrom === "initial") initP = options.initialValue;
    else if (sharedConfig.load && sharedConfig.has(id)) initP = sharedConfig.load(id);
  }
  function loadEnd(p, v, error2, key) {
    if (pr === p) {
      pr = null;
      key !== void 0 && (resolved = true);
      if ((p === initP || v === initP) && options.onHydrated) queueMicrotask(() => options.onHydrated(key, {
        value: v
      }));
      initP = NO_INIT;
      if (Transition && p && loadedUnderTransition) {
        Transition.promises.delete(p);
        loadedUnderTransition = false;
        runUpdates(() => {
          Transition.running = true;
          completeLoad(v, error2);
        }, false);
      } else completeLoad(v, error2);
    }
    return v;
  }
  function completeLoad(v, err) {
    runUpdates(() => {
      if (err === void 0) setValue(() => v);
      setState(err !== void 0 ? "errored" : resolved ? "ready" : "unresolved");
      setError(err);
      for (const c of contexts.keys()) c.decrement();
      contexts.clear();
    }, false);
  }
  function read2() {
    const c = SuspenseContext && useContext(SuspenseContext), v = value(), err = error();
    if (err !== void 0 && !pr) throw err;
    if (Listener && !Listener.user && c) {
      createComputed(() => {
        track();
        if (pr) {
          if (c.resolved && Transition && loadedUnderTransition) Transition.promises.add(pr);
          else if (!contexts.has(c)) {
            c.increment();
            contexts.add(c);
          }
        }
      });
    }
    return v;
  }
  function load(refetching = true) {
    if (refetching !== false && scheduled) return;
    scheduled = false;
    const lookup = dynamic ? dynamic() : source;
    loadedUnderTransition = Transition && Transition.running;
    if (lookup == null || lookup === false) {
      loadEnd(pr, untrack(value));
      return;
    }
    if (Transition && pr) Transition.promises.delete(pr);
    let error2;
    const p = initP !== NO_INIT ? initP : untrack(() => {
      try {
        return fetcher(lookup, {
          value: value(),
          refetching
        });
      } catch (fetcherError) {
        error2 = fetcherError;
      }
    });
    if (error2 !== void 0) {
      loadEnd(pr, void 0, castError(error2), lookup);
      return;
    } else if (!isPromise(p)) {
      loadEnd(pr, p, void 0, lookup);
      return p;
    }
    pr = p;
    if ("v" in p) {
      if (p.s === 1) loadEnd(pr, p.v, void 0, lookup);
      else loadEnd(pr, void 0, castError(p.v), lookup);
      return p;
    }
    scheduled = true;
    queueMicrotask(() => scheduled = false);
    runUpdates(() => {
      setState(resolved ? "refreshing" : "pending");
      trigger();
    }, false);
    return p.then((v) => loadEnd(p, v, void 0, lookup), (e) => loadEnd(p, void 0, castError(e), lookup));
  }
  Object.defineProperties(read2, {
    state: {
      get: () => state()
    },
    error: {
      get: () => error()
    },
    loading: {
      get() {
        const s = state();
        return s === "pending" || s === "refreshing";
      }
    },
    latest: {
      get() {
        if (!resolved) return read2();
        const err = error();
        if (err && !pr) throw err;
        return value();
      }
    }
  });
  let owner = Owner;
  if (dynamic) createComputed(() => (owner = Owner, load(false)));
  else load(false);
  return [read2, {
    refetch: (info) => runWithOwner(owner, () => load(info)),
    mutate: setValue
  }];
}
function createSelector(source, fn2 = equalFn, options) {
  const subs = /* @__PURE__ */ new Map();
  const node = createComputation((p) => {
    const v = source();
    for (const [key, val] of subs.entries()) if (fn2(key, v) !== fn2(key, p)) {
      for (const c of val.values()) {
        c.state = STALE;
        if (c.pure) Updates.push(c);
        else Effects.push(c);
      }
    }
    return v;
  }, void 0, true, STALE);
  updateComputation(node);
  return (key) => {
    const listener = Listener;
    if (listener) {
      let l;
      if (l = subs.get(key)) l.add(listener);
      else subs.set(key, l = /* @__PURE__ */ new Set([listener]));
      onCleanup(() => {
        l.delete(listener);
        !l.size && subs.delete(key);
      });
    }
    return fn2(key, Transition && Transition.running && Transition.sources.has(node) ? node.tValue : node.value);
  };
}
function batch(fn2) {
  return runUpdates(fn2, false);
}
function untrack(fn2) {
  if (!ExternalSourceConfig && Listener === null) return fn2();
  const listener = Listener;
  Listener = null;
  try {
    if (ExternalSourceConfig) return ExternalSourceConfig.untrack(fn2);
    return fn2();
  } finally {
    Listener = listener;
  }
}
function on(deps, fn2, options) {
  const isArray = Array.isArray(deps);
  let prevInput;
  let defer = options && options.defer;
  return (prevValue) => {
    let input;
    if (isArray) {
      input = Array(deps.length);
      for (let i = 0; i < deps.length; i++) input[i] = deps[i]();
    } else input = deps();
    if (defer) {
      defer = false;
      return prevValue;
    }
    const result = untrack(() => fn2(input, prevInput, prevValue));
    prevInput = input;
    return result;
  };
}
function onMount(fn2) {
  createEffect(() => untrack(fn2));
}
function onCleanup(fn2) {
  if (Owner === null) ;
  else if (Owner.cleanups === null) Owner.cleanups = [fn2];
  else Owner.cleanups.push(fn2);
  return fn2;
}
function getListener() {
  return Listener;
}
function getOwner() {
  return Owner;
}
function runWithOwner(o, fn2) {
  const prev = Owner;
  const prevListener = Listener;
  Owner = o;
  Listener = null;
  try {
    return runUpdates(fn2, true);
  } catch (err) {
    handleError(err);
  } finally {
    Owner = prev;
    Listener = prevListener;
  }
}
function startTransition(fn2) {
  if (Transition && Transition.running) {
    fn2();
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
    runUpdates(fn2, false);
    Listener = Owner = null;
    return t ? t.done : void 0;
  });
}
function createContext(defaultValue, options) {
  const id = Symbol("context");
  return {
    id,
    Provider: createProvider(id),
    defaultValue
  };
}
function useContext(context2) {
  let value;
  return Owner && Owner.context && (value = Owner.context[context2.id]) !== void 0 ? value : context2.defaultValue;
}
function children(fn2) {
  const children2 = createMemo(fn2);
  const memo2 = createMemo(() => resolveChildren(children2()));
  memo2.toArray = () => {
    const c = memo2();
    return Array.isArray(c) ? c : c != null ? [c] : [];
  };
  return memo2;
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
function createComputation(fn2, init, pure, state = STALE, options) {
  const c = {
    fn: fn2,
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
      let top2 = node, prev = ancestors[i + 1];
      while ((top2 = top2.owner) && top2 !== prev) {
        if (Transition.disposed.has(top2)) return;
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
function runUpdates(fn2, init) {
  if (Updates) return fn2();
  let wait = false;
  if (!init) Updates = [];
  if (Effects) wait = true;
  else Effects = [];
  ExecCount++;
  try {
    const res = fn2();
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
function reset(node, top2) {
  if (!top2) {
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
function resolveChildren(children2) {
  if (typeof children2 === "function" && !children2.length) return resolveChildren(children2());
  if (Array.isArray(children2)) {
    const results = [];
    for (let i = 0; i < children2.length; i++) {
      const result = resolveChildren(children2[i]);
      Array.isArray(result) ? results.push.apply(results, result) : results.push(result);
    }
    return results;
  }
  return children2;
}
function createProvider(id, options) {
  return function provider(props) {
    let res;
    createRenderEffect(() => res = untrack(() => {
      Owner.context = {
        ...Owner.context,
        [id]: props.value
      };
      return children(() => props.children);
    }), void 0);
    return res;
  };
}
function dispose(d) {
  for (let i = 0; i < d.length; i++) d[i]();
}
function mapArray(list, mapFn, options = {}) {
  let items = [], mapped = [], disposers = [], len = 0, indexes = mapFn.length > 1 ? [] : null;
  onCleanup(() => dispose(disposers));
  return () => {
    let newItems = list() || [], newLen = newItems.length, i, j;
    newItems[$TRACK];
    return untrack(() => {
      let newIndices, newIndicesNext, temp, tempdisposers, tempIndexes, start2, end2, newEnd, item;
      if (newLen === 0) {
        if (len !== 0) {
          dispose(disposers);
          disposers = [];
          items = [];
          mapped = [];
          len = 0;
          indexes && (indexes = []);
        }
        if (options.fallback) {
          items = [FALLBACK];
          mapped[0] = createRoot((disposer) => {
            disposers[0] = disposer;
            return options.fallback();
          });
          len = 1;
        }
      } else if (len === 0) {
        mapped = new Array(newLen);
        for (j = 0; j < newLen; j++) {
          items[j] = newItems[j];
          mapped[j] = createRoot(mapper);
        }
        len = newLen;
      } else {
        temp = new Array(newLen);
        tempdisposers = new Array(newLen);
        indexes && (tempIndexes = new Array(newLen));
        for (start2 = 0, end2 = Math.min(len, newLen); start2 < end2 && items[start2] === newItems[start2]; start2++) ;
        for (end2 = len - 1, newEnd = newLen - 1; end2 >= start2 && newEnd >= start2 && items[end2] === newItems[newEnd]; end2--, newEnd--) {
          temp[newEnd] = mapped[end2];
          tempdisposers[newEnd] = disposers[end2];
          indexes && (tempIndexes[newEnd] = indexes[end2]);
        }
        newIndices = /* @__PURE__ */ new Map();
        newIndicesNext = new Array(newEnd + 1);
        for (j = newEnd; j >= start2; j--) {
          item = newItems[j];
          i = newIndices.get(item);
          newIndicesNext[j] = i === void 0 ? -1 : i;
          newIndices.set(item, j);
        }
        for (i = start2; i <= end2; i++) {
          item = items[i];
          j = newIndices.get(item);
          if (j !== void 0 && j !== -1) {
            temp[j] = mapped[i];
            tempdisposers[j] = disposers[i];
            indexes && (tempIndexes[j] = indexes[i]);
            j = newIndicesNext[j];
            newIndices.set(item, j);
          } else disposers[i]();
        }
        for (j = start2; j < newLen; j++) {
          if (j in temp) {
            mapped[j] = temp[j];
            disposers[j] = tempdisposers[j];
            if (indexes) {
              indexes[j] = tempIndexes[j];
              indexes[j](j);
            }
          } else mapped[j] = createRoot(mapper);
        }
        mapped = mapped.slice(0, len = newLen);
        items = newItems.slice(0);
      }
      return mapped;
    });
    function mapper(disposer) {
      disposers[j] = disposer;
      if (indexes) {
        const [s, set] = createSignal(j);
        indexes[j] = set;
        return mapFn(newItems[j], s);
      }
      return mapFn(newItems[j]);
    }
  };
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
function trueFn() {
  return true;
}
function resolveSource(s) {
  return !(s = typeof s === "function" ? s() : s) ? {} : s;
}
function resolveSources() {
  for (let i = 0, length = this.length; i < length; ++i) {
    const v = this[i]();
    if (v !== void 0) return v;
  }
}
function mergeProps(...sources) {
  let proxy = false;
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    proxy = proxy || !!s && $PROXY in s;
    sources[i] = typeof s === "function" ? (proxy = true, createMemo(s)) : s;
  }
  if (SUPPORTS_PROXY && proxy) {
    return new Proxy({
      get(property) {
        for (let i = sources.length - 1; i >= 0; i--) {
          const v = resolveSource(sources[i])[property];
          if (v !== void 0) return v;
        }
      },
      has(property) {
        for (let i = sources.length - 1; i >= 0; i--) {
          if (property in resolveSource(sources[i])) return true;
        }
        return false;
      },
      keys() {
        const keys = [];
        for (let i = 0; i < sources.length; i++) keys.push(...Object.keys(resolveSource(sources[i])));
        return [...new Set(keys)];
      }
    }, propTraps);
  }
  const sourcesMap = {};
  const defined = /* @__PURE__ */ Object.create(null);
  for (let i = sources.length - 1; i >= 0; i--) {
    const source = sources[i];
    if (!source) continue;
    const sourceKeys = Object.getOwnPropertyNames(source);
    for (let i2 = sourceKeys.length - 1; i2 >= 0; i2--) {
      const key = sourceKeys[i2];
      if (key === "__proto__" || key === "constructor") continue;
      const desc = Object.getOwnPropertyDescriptor(source, key);
      if (!defined[key]) {
        defined[key] = desc.get ? {
          enumerable: true,
          configurable: true,
          get: resolveSources.bind(sourcesMap[key] = [desc.get.bind(source)])
        } : desc.value !== void 0 ? desc : void 0;
      } else {
        const sources2 = sourcesMap[key];
        if (sources2) {
          if (desc.get) sources2.push(desc.get.bind(source));
          else if (desc.value !== void 0) sources2.push(() => desc.value);
        }
      }
    }
  }
  const target = {};
  const definedKeys = Object.keys(defined);
  for (let i = definedKeys.length - 1; i >= 0; i--) {
    const key = definedKeys[i], desc = defined[key];
    if (desc && desc.get) Object.defineProperty(target, key, desc);
    else target[key] = desc ? desc.value : void 0;
  }
  return target;
}
function splitProps(props, ...keys) {
  if (SUPPORTS_PROXY && $PROXY in props) {
    const blocked = new Set(keys.length > 1 ? keys.flat() : keys[0]);
    const res = keys.map((k) => {
      return new Proxy({
        get(property) {
          return k.includes(property) ? props[property] : void 0;
        },
        has(property) {
          return k.includes(property) && property in props;
        },
        keys() {
          return k.filter((property) => property in props);
        }
      }, propTraps);
    });
    res.push(new Proxy({
      get(property) {
        return blocked.has(property) ? void 0 : props[property];
      },
      has(property) {
        return blocked.has(property) ? false : property in props;
      },
      keys() {
        return Object.keys(props).filter((k) => !blocked.has(k));
      }
    }, propTraps));
    return res;
  }
  const otherObject = {};
  const objects = keys.map(() => ({}));
  for (const propName of Object.getOwnPropertyNames(props)) {
    const desc = Object.getOwnPropertyDescriptor(props, propName);
    const isDefaultDesc = !desc.get && !desc.set && desc.enumerable && desc.writable && desc.configurable;
    let blocked = false;
    let objectIndex = 0;
    for (const k of keys) {
      if (k.includes(propName)) {
        blocked = true;
        isDefaultDesc ? objects[objectIndex][propName] = desc.value : Object.defineProperty(objects[objectIndex], propName, desc);
      }
      ++objectIndex;
    }
    if (!blocked) {
      isDefaultDesc ? otherObject[propName] = desc.value : Object.defineProperty(otherObject, propName, desc);
    }
  }
  return [...objects, otherObject];
}
function For(props) {
  const fallback = "fallback" in props && {
    fallback: () => props.fallback
  };
  return createMemo(mapArray(() => props.each, props.children, fallback || void 0));
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
      const fn2 = typeof child === "function" && child.length > 0;
      return fn2 ? untrack(() => child(keyed ? c : () => {
        if (!untrack(condition)) throw narrowedError("Show");
        return conditionValue();
      })) : child;
    }
    return props.fallback;
  }, void 0, void 0);
}
var sharedConfig, IS_DEV, equalFn, $PROXY, SUPPORTS_PROXY, $TRACK, $DEVCOMP, signalOptions, ERROR, runEffects, STALE, PENDING, UNOWNED, NO_INIT, Owner, Transition, Scheduler, ExternalSourceConfig, Listener, Updates, Effects, ExecCount, transPending, setTransPending, SuspenseContext, FALLBACK, hydrationEnabled, propTraps, narrowedError;
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
    SUPPORTS_PROXY = typeof Proxy === "function";
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
    NO_INIT = {};
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
    propTraps = {
      get(_, property, receiver) {
        if (property === $PROXY) return receiver;
        return _.get(property);
      },
      has(_, property) {
        if (property === $PROXY) return true;
        return _.has(property);
      },
      set: trueFn,
      deleteProperty: trueFn,
      getOwnPropertyDescriptor(_, property) {
        return {
          configurable: true,
          enumerable: true,
          get() {
            return _.get(property);
          },
          set: trueFn,
          deleteProperty: trueFn
        };
      },
      ownKeys(_) {
        return _.keys();
      }
    };
    narrowedError = (name) => `Stale read from <${name}>.`;
  }
});

// ../node_modules/solid-js/web/dist/web.js
function getPropAlias(prop, tagName) {
  const a = PropAliases[prop];
  return typeof a === "object" ? a[tagName] ? a["$"] : void 0 : a;
}
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
  createRoot((dispose2) => {
    disposer = dispose2;
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
  const fn2 = isImportNode ? () => untrack(() => document.importNode(node || (node = create()), true)) : () => (node || (node = create())).cloneNode(true);
  fn2.cloneNode = fn2;
  return fn2;
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
function setAttributeNS(node, namespace, name, value) {
  if (isHydrating(node)) return;
  if (value == null) node.removeAttributeNS(namespace, name);
  else node.setAttributeNS(namespace, name, value);
}
function setBoolAttribute(node, name, value) {
  if (isHydrating(node)) return;
  value ? node.setAttribute(name, "") : node.removeAttribute(name);
}
function className(node, value) {
  if (isHydrating(node)) return;
  if (value == null) node.removeAttribute("class");
  else node.className = value;
}
function addEventListener(node, name, handler, delegate) {
  if (delegate) {
    if (Array.isArray(handler)) {
      node[`$$${name}`] = handler[0];
      node[`$$${name}Data`] = handler[1];
    } else node[`$$${name}`] = handler;
  } else if (Array.isArray(handler)) {
    const handlerFn = handler[0];
    node.addEventListener(name, handler[0] = (e) => handlerFn.call(node, handler[1], e));
  } else node.addEventListener(name, handler, typeof handler !== "function" && handler);
}
function classList(node, value, prev = {}) {
  const classKeys = Object.keys(value || {}), prevKeys = Object.keys(prev);
  let i, len;
  for (i = 0, len = prevKeys.length; i < len; i++) {
    const key = prevKeys[i];
    if (!key || key === "undefined" || value[key]) continue;
    toggleClassKey(node, key, false);
    delete prev[key];
  }
  for (i = 0, len = classKeys.length; i < len; i++) {
    const key = classKeys[i], classValue = !!value[key];
    if (!key || key === "undefined" || prev[key] === classValue || !classValue) continue;
    toggleClassKey(node, key, true);
    prev[key] = classValue;
  }
  return prev;
}
function style(node, value, prev) {
  if (!value) return prev ? setAttribute(node, "style") : value;
  const nodeStyle = node.style;
  if (typeof value === "string") return nodeStyle.cssText = value;
  typeof prev === "string" && (nodeStyle.cssText = prev = void 0);
  prev || (prev = {});
  value || (value = {});
  let v, s;
  for (s in prev) {
    value[s] == null && nodeStyle.removeProperty(s);
    delete prev[s];
  }
  for (s in value) {
    v = value[s];
    if (v !== prev[s]) {
      nodeStyle.setProperty(s, v);
      prev[s] = v;
    }
  }
  return prev;
}
function spread(node, props = {}, isSVG, skipChildren) {
  const prevProps = {};
  if (!skipChildren) {
    createRenderEffect(() => prevProps.children = insertExpression(node, props.children, prevProps.children));
  }
  createRenderEffect(() => typeof props.ref === "function" && use(props.ref, node));
  createRenderEffect(() => assign(node, props, isSVG, true, prevProps, true));
  return prevProps;
}
function use(fn2, element, arg) {
  return untrack(() => fn2(element, arg));
}
function insert(parent, accessor, marker, initial) {
  if (marker !== void 0 && !initial) initial = [];
  if (typeof accessor !== "function") return insertExpression(parent, accessor, initial, marker);
  createRenderEffect((current) => insertExpression(parent, accessor(), current, marker), initial);
}
function assign(node, props, isSVG, skipChildren, prevProps = {}, skipRef = false) {
  props || (props = {});
  for (const prop in prevProps) {
    if (!(prop in props)) {
      if (prop === "children") continue;
      prevProps[prop] = assignProp(node, prop, null, prevProps[prop], isSVG, skipRef, props);
    }
  }
  for (const prop in props) {
    if (prop === "children") {
      if (!skipChildren) insertExpression(node, props.children);
      continue;
    }
    const value = props[prop];
    prevProps[prop] = assignProp(node, prop, value, prevProps[prop], isSVG, skipRef, props);
  }
}
function getNextElement(template2) {
  let node, key, hydrating = isHydrating();
  if (!hydrating || !(node = sharedConfig.registry.get(key = getHydrationKey()))) {
    return template2();
  }
  if (sharedConfig.completed) sharedConfig.completed.add(node);
  sharedConfig.registry.delete(key);
  return node;
}
function isHydrating(node) {
  return !!sharedConfig.context && !sharedConfig.done && (!node || node.isConnected);
}
function toPropertyName(name) {
  return name.toLowerCase().replace(/-([a-z])/g, (_, w) => w.toUpperCase());
}
function toggleClassKey(node, key, value) {
  const classNames2 = key.trim().split(/\s+/);
  for (let i = 0, nameLen = classNames2.length; i < nameLen; i++) node.classList.toggle(classNames2[i], value);
}
function assignProp(node, prop, value, prev, isSVG, skipRef, props) {
  let isCE, isProp, isChildProp, propAlias, forceProp;
  if (prop === "style") return style(node, value, prev);
  if (prop === "classList") return classList(node, value, prev);
  if (value === prev) return prev;
  if (prop === "ref") {
    if (!skipRef) value(node);
  } else if (prop.slice(0, 3) === "on:") {
    const e = prop.slice(3);
    prev && node.removeEventListener(e, prev, typeof prev !== "function" && prev);
    value && node.addEventListener(e, value, typeof value !== "function" && value);
  } else if (prop.slice(0, 10) === "oncapture:") {
    const e = prop.slice(10);
    prev && node.removeEventListener(e, prev, true);
    value && node.addEventListener(e, value, true);
  } else if (prop.slice(0, 2) === "on") {
    const name = prop.slice(2).toLowerCase();
    const delegate = DelegatedEvents.has(name);
    if (!delegate && prev) {
      const h = Array.isArray(prev) ? prev[0] : prev;
      node.removeEventListener(name, h);
    }
    if (delegate || value) {
      addEventListener(node, name, value, delegate);
      delegate && delegateEvents([name]);
    }
  } else if (prop.slice(0, 5) === "attr:") {
    setAttribute(node, prop.slice(5), value);
  } else if (prop.slice(0, 5) === "bool:") {
    setBoolAttribute(node, prop.slice(5), value);
  } else if ((forceProp = prop.slice(0, 5) === "prop:") || (isChildProp = ChildProperties.has(prop)) || !isSVG && ((propAlias = getPropAlias(prop, node.tagName)) || (isProp = Properties.has(prop))) || (isCE = node.nodeName.includes("-") || "is" in props)) {
    if (forceProp) {
      prop = prop.slice(5);
      isProp = true;
    } else if (isHydrating(node)) return value;
    if (prop === "class" || prop === "className") className(node, value);
    else if (isCE && !isProp && !isChildProp) node[toPropertyName(prop)] = value;
    else node[propAlias || prop] = value;
  } else {
    const ns = isSVG && prop.indexOf(":") > -1 && SVGNamespace[prop.split(":")[0]];
    if (ns) setAttributeNS(node, ns, prop, value);
    else setAttribute(node, Aliases[prop] || prop, value);
  }
  return value;
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
function normalizeIncomingArray(normalized, array, current, unwrap2) {
  let dynamic = false;
  for (let i = 0, len = array.length; i < len; i++) {
    let item = array[i], prev = current && current[normalized.length], t;
    if (item == null || item === true || item === false) ;
    else if ((t = typeof item) === "object" && item.nodeType) {
      normalized.push(item);
    } else if (Array.isArray(item)) {
      dynamic = normalizeIncomingArray(normalized, item, prev) || dynamic;
    } else if (t === "function") {
      if (unwrap2) {
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
function getHydrationKey() {
  return sharedConfig.getNextContextId();
}
function createElement(tagName, isSVG = false) {
  return isSVG ? document.createElementNS(SVG_NAMESPACE, tagName) : document.createElement(tagName);
}
function Portal(props) {
  const {
    useShadow
  } = props, marker = document.createTextNode(""), mount = () => props.mount || document.body, owner = getOwner();
  let content;
  let hydrating = !!sharedConfig.context;
  createEffect(() => {
    if (hydrating) getOwner().user = hydrating = false;
    content || (content = runWithOwner(owner, () => createMemo(() => props.children)));
    const el = mount();
    if (el instanceof HTMLHeadElement) {
      const [clean, setClean] = createSignal(false);
      const cleanup = () => setClean(true);
      createRoot((dispose2) => insert(el, () => !clean() ? content() : dispose2(), null));
      onCleanup(cleanup);
    } else {
      const container = createElement(props.isSVG ? "g" : "div", props.isSVG), renderRoot = useShadow && container.attachShadow ? container.attachShadow({
        mode: "open"
      }) : container;
      Object.defineProperty(container, "_$host", {
        get() {
          return marker.parentNode;
        },
        configurable: true
      });
      insert(renderRoot, content);
      el.appendChild(container);
      props.ref && props.ref(container);
      onCleanup(() => el.removeChild(container));
    }
  }, void 0, {
    render: !hydrating
  });
  return marker;
}
function createDynamic(component, props) {
  const cached = createMemo(component);
  return createMemo(() => {
    const component2 = cached();
    switch (typeof component2) {
      case "function":
        return untrack(() => component2(props));
      case "string":
        const isSvg = SVGElements.has(component2);
        const el = sharedConfig.context ? getNextElement() : createElement(component2, isSvg);
        spread(el, props, isSvg);
        return el;
    }
  });
}
function Dynamic(props) {
  const [, others] = splitProps(props, ["component"]);
  return createDynamic(() => props.component, others);
}
var booleans, Properties, ChildProperties, Aliases, PropAliases, DelegatedEvents, SVGElements, SVGNamespace, memo, $$EVENTS, RequestContext, isServer, SVG_NAMESPACE;
var init_web = __esm({
  "../node_modules/solid-js/web/dist/web.js"() {
    init_solid();
    init_solid();
    booleans = ["allowfullscreen", "async", "autofocus", "autoplay", "checked", "controls", "default", "disabled", "formnovalidate", "hidden", "indeterminate", "inert", "ismap", "loop", "multiple", "muted", "nomodule", "novalidate", "open", "playsinline", "readonly", "required", "reversed", "seamless", "selected"];
    Properties = /* @__PURE__ */ new Set(["className", "value", "readOnly", "noValidate", "formNoValidate", "isMap", "noModule", "playsInline", ...booleans]);
    ChildProperties = /* @__PURE__ */ new Set(["innerHTML", "textContent", "innerText", "children"]);
    Aliases = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(null), {
      className: "class",
      htmlFor: "for"
    });
    PropAliases = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(null), {
      class: "className",
      novalidate: {
        $: "noValidate",
        FORM: 1
      },
      formnovalidate: {
        $: "formNoValidate",
        BUTTON: 1,
        INPUT: 1
      },
      ismap: {
        $: "isMap",
        IMG: 1
      },
      nomodule: {
        $: "noModule",
        SCRIPT: 1
      },
      playsinline: {
        $: "playsInline",
        VIDEO: 1
      },
      readonly: {
        $: "readOnly",
        INPUT: 1,
        TEXTAREA: 1
      }
    });
    DelegatedEvents = /* @__PURE__ */ new Set(["beforeinput", "click", "dblclick", "contextmenu", "focusin", "focusout", "input", "keydown", "keyup", "mousedown", "mousemove", "mouseout", "mouseover", "mouseup", "pointerdown", "pointermove", "pointerout", "pointerover", "pointerup", "touchend", "touchmove", "touchstart"]);
    SVGElements = /* @__PURE__ */ new Set([
      "altGlyph",
      "altGlyphDef",
      "altGlyphItem",
      "animate",
      "animateColor",
      "animateMotion",
      "animateTransform",
      "circle",
      "clipPath",
      "color-profile",
      "cursor",
      "defs",
      "desc",
      "ellipse",
      "feBlend",
      "feColorMatrix",
      "feComponentTransfer",
      "feComposite",
      "feConvolveMatrix",
      "feDiffuseLighting",
      "feDisplacementMap",
      "feDistantLight",
      "feDropShadow",
      "feFlood",
      "feFuncA",
      "feFuncB",
      "feFuncG",
      "feFuncR",
      "feGaussianBlur",
      "feImage",
      "feMerge",
      "feMergeNode",
      "feMorphology",
      "feOffset",
      "fePointLight",
      "feSpecularLighting",
      "feSpotLight",
      "feTile",
      "feTurbulence",
      "filter",
      "font",
      "font-face",
      "font-face-format",
      "font-face-name",
      "font-face-src",
      "font-face-uri",
      "foreignObject",
      "g",
      "glyph",
      "glyphRef",
      "hkern",
      "image",
      "line",
      "linearGradient",
      "marker",
      "mask",
      "metadata",
      "missing-glyph",
      "mpath",
      "path",
      "pattern",
      "polygon",
      "polyline",
      "radialGradient",
      "rect",
      "set",
      "stop",
      "svg",
      "switch",
      "symbol",
      "text",
      "textPath",
      "tref",
      "tspan",
      "use",
      "view",
      "vkern"
    ]);
    SVGNamespace = {
      xlink: "http://www.w3.org/1999/xlink",
      xml: "http://www.w3.org/XML/1998/namespace"
    };
    memo = (fn2) => createMemo(() => fn2());
    $$EVENTS = "_$DX_DELEGATE";
    RequestContext = Symbol();
    isServer = false;
    SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  }
});

// ../node_modules/@popperjs/core/lib/enums.js
var top, bottom, right, left, auto, basePlacements, start, end, clippingParents, viewport, popper, reference, variationPlacements, placements, beforeRead, read, afterRead, beforeMain, main, afterMain, beforeWrite, write, afterWrite, modifierPhases;
var init_enums = __esm({
  "../node_modules/@popperjs/core/lib/enums.js"() {
    top = "top";
    bottom = "bottom";
    right = "right";
    left = "left";
    auto = "auto";
    basePlacements = [top, bottom, right, left];
    start = "start";
    end = "end";
    clippingParents = "clippingParents";
    viewport = "viewport";
    popper = "popper";
    reference = "reference";
    variationPlacements = /* @__PURE__ */ basePlacements.reduce(function(acc, placement) {
      return acc.concat([placement + "-" + start, placement + "-" + end]);
    }, []);
    placements = /* @__PURE__ */ [].concat(basePlacements, [auto]).reduce(function(acc, placement) {
      return acc.concat([placement, placement + "-" + start, placement + "-" + end]);
    }, []);
    beforeRead = "beforeRead";
    read = "read";
    afterRead = "afterRead";
    beforeMain = "beforeMain";
    main = "main";
    afterMain = "afterMain";
    beforeWrite = "beforeWrite";
    write = "write";
    afterWrite = "afterWrite";
    modifierPhases = [beforeRead, read, afterRead, beforeMain, main, afterMain, beforeWrite, write, afterWrite];
  }
});

// ../node_modules/@popperjs/core/lib/dom-utils/getNodeName.js
function getNodeName(element) {
  return element ? (element.nodeName || "").toLowerCase() : null;
}
var init_getNodeName = __esm({
  "../node_modules/@popperjs/core/lib/dom-utils/getNodeName.js"() {
  }
});

// ../node_modules/@popperjs/core/lib/dom-utils/getWindow.js
function getWindow(node) {
  if (node == null) {
    return window;
  }
  if (node.toString() !== "[object Window]") {
    var ownerDocument3 = node.ownerDocument;
    return ownerDocument3 ? ownerDocument3.defaultView || window : window;
  }
  return node;
}
var init_getWindow = __esm({
  "../node_modules/@popperjs/core/lib/dom-utils/getWindow.js"() {
  }
});

// ../node_modules/@popperjs/core/lib/dom-utils/instanceOf.js
function isElement(node) {
  var OwnElement = getWindow(node).Element;
  return node instanceof OwnElement || node instanceof Element;
}
function isHTMLElement(node) {
  var OwnElement = getWindow(node).HTMLElement;
  return node instanceof OwnElement || node instanceof HTMLElement;
}
function isShadowRoot(node) {
  if (typeof ShadowRoot === "undefined") {
    return false;
  }
  var OwnElement = getWindow(node).ShadowRoot;
  return node instanceof OwnElement || node instanceof ShadowRoot;
}
var init_instanceOf = __esm({
  "../node_modules/@popperjs/core/lib/dom-utils/instanceOf.js"() {
    init_getWindow();
  }
});

// ../node_modules/@popperjs/core/lib/utils/getBasePlacement.js
function getBasePlacement(placement) {
  return placement.split("-")[0];
}
var init_getBasePlacement = __esm({
  "../node_modules/@popperjs/core/lib/utils/getBasePlacement.js"() {
  }
});

// ../node_modules/@popperjs/core/lib/utils/math.js
var max, min, round;
var init_math = __esm({
  "../node_modules/@popperjs/core/lib/utils/math.js"() {
    max = Math.max;
    min = Math.min;
    round = Math.round;
  }
});

// ../node_modules/@popperjs/core/lib/utils/userAgent.js
function getUAString() {
  var uaData = navigator.userAgentData;
  if (uaData != null && uaData.brands && Array.isArray(uaData.brands)) {
    return uaData.brands.map(function(item) {
      return item.brand + "/" + item.version;
    }).join(" ");
  }
  return navigator.userAgent;
}
var init_userAgent = __esm({
  "../node_modules/@popperjs/core/lib/utils/userAgent.js"() {
  }
});

// ../node_modules/@popperjs/core/lib/dom-utils/isLayoutViewport.js
function isLayoutViewport() {
  return !/^((?!chrome|android).)*safari/i.test(getUAString());
}
var init_isLayoutViewport = __esm({
  "../node_modules/@popperjs/core/lib/dom-utils/isLayoutViewport.js"() {
    init_userAgent();
  }
});

// ../node_modules/@popperjs/core/lib/dom-utils/getBoundingClientRect.js
function getBoundingClientRect(element, includeScale, isFixedStrategy) {
  if (includeScale === void 0) {
    includeScale = false;
  }
  if (isFixedStrategy === void 0) {
    isFixedStrategy = false;
  }
  var clientRect = element.getBoundingClientRect();
  var scaleX = 1;
  var scaleY = 1;
  if (includeScale && isHTMLElement(element)) {
    scaleX = element.offsetWidth > 0 ? round(clientRect.width) / element.offsetWidth || 1 : 1;
    scaleY = element.offsetHeight > 0 ? round(clientRect.height) / element.offsetHeight || 1 : 1;
  }
  var _ref = isElement(element) ? getWindow(element) : window, visualViewport = _ref.visualViewport;
  var addVisualOffsets = !isLayoutViewport() && isFixedStrategy;
  var x = (clientRect.left + (addVisualOffsets && visualViewport ? visualViewport.offsetLeft : 0)) / scaleX;
  var y = (clientRect.top + (addVisualOffsets && visualViewport ? visualViewport.offsetTop : 0)) / scaleY;
  var width = clientRect.width / scaleX;
  var height = clientRect.height / scaleY;
  return {
    width,
    height,
    top: y,
    right: x + width,
    bottom: y + height,
    left: x,
    x,
    y
  };
}
var init_getBoundingClientRect = __esm({
  "../node_modules/@popperjs/core/lib/dom-utils/getBoundingClientRect.js"() {
    init_instanceOf();
    init_math();
    init_getWindow();
    init_isLayoutViewport();
  }
});

// ../node_modules/@popperjs/core/lib/dom-utils/getLayoutRect.js
function getLayoutRect(element) {
  var clientRect = getBoundingClientRect(element);
  var width = element.offsetWidth;
  var height = element.offsetHeight;
  if (Math.abs(clientRect.width - width) <= 1) {
    width = clientRect.width;
  }
  if (Math.abs(clientRect.height - height) <= 1) {
    height = clientRect.height;
  }
  return {
    x: element.offsetLeft,
    y: element.offsetTop,
    width,
    height
  };
}
var init_getLayoutRect = __esm({
  "../node_modules/@popperjs/core/lib/dom-utils/getLayoutRect.js"() {
    init_getBoundingClientRect();
  }
});

// ../node_modules/@popperjs/core/lib/dom-utils/contains.js
function contains(parent, child) {
  var rootNode = child.getRootNode && child.getRootNode();
  if (parent.contains(child)) {
    return true;
  } else if (rootNode && isShadowRoot(rootNode)) {
    var next = child;
    do {
      if (next && parent.isSameNode(next)) {
        return true;
      }
      next = next.parentNode || next.host;
    } while (next);
  }
  return false;
}
var init_contains = __esm({
  "../node_modules/@popperjs/core/lib/dom-utils/contains.js"() {
    init_instanceOf();
  }
});

// ../node_modules/@popperjs/core/lib/dom-utils/getComputedStyle.js
function getComputedStyle2(element) {
  return getWindow(element).getComputedStyle(element);
}
var init_getComputedStyle = __esm({
  "../node_modules/@popperjs/core/lib/dom-utils/getComputedStyle.js"() {
    init_getWindow();
  }
});

// ../node_modules/@popperjs/core/lib/dom-utils/isTableElement.js
function isTableElement(element) {
  return ["table", "td", "th"].indexOf(getNodeName(element)) >= 0;
}
var init_isTableElement = __esm({
  "../node_modules/@popperjs/core/lib/dom-utils/isTableElement.js"() {
    init_getNodeName();
  }
});

// ../node_modules/@popperjs/core/lib/dom-utils/getDocumentElement.js
function getDocumentElement(element) {
  return ((isElement(element) ? element.ownerDocument : (
    // $FlowFixMe[prop-missing]
    element.document
  )) || window.document).documentElement;
}
var init_getDocumentElement = __esm({
  "../node_modules/@popperjs/core/lib/dom-utils/getDocumentElement.js"() {
    init_instanceOf();
  }
});

// ../node_modules/@popperjs/core/lib/dom-utils/getParentNode.js
function getParentNode(element) {
  if (getNodeName(element) === "html") {
    return element;
  }
  return (
    // this is a quicker (but less type safe) way to save quite some bytes from the bundle
    // $FlowFixMe[incompatible-return]
    // $FlowFixMe[prop-missing]
    element.assignedSlot || // step into the shadow DOM of the parent of a slotted node
    element.parentNode || // DOM Element detected
    (isShadowRoot(element) ? element.host : null) || // ShadowRoot detected
    // $FlowFixMe[incompatible-call]: HTMLElement is a Node
    getDocumentElement(element)
  );
}
var init_getParentNode = __esm({
  "../node_modules/@popperjs/core/lib/dom-utils/getParentNode.js"() {
    init_getNodeName();
    init_getDocumentElement();
    init_instanceOf();
  }
});

// ../node_modules/@popperjs/core/lib/dom-utils/getOffsetParent.js
function getTrueOffsetParent(element) {
  if (!isHTMLElement(element) || // https://github.com/popperjs/popper-core/issues/837
  getComputedStyle2(element).position === "fixed") {
    return null;
  }
  return element.offsetParent;
}
function getContainingBlock(element) {
  var isFirefox = /firefox/i.test(getUAString());
  var isIE = /Trident/i.test(getUAString());
  if (isIE && isHTMLElement(element)) {
    var elementCss = getComputedStyle2(element);
    if (elementCss.position === "fixed") {
      return null;
    }
  }
  var currentNode = getParentNode(element);
  if (isShadowRoot(currentNode)) {
    currentNode = currentNode.host;
  }
  while (isHTMLElement(currentNode) && ["html", "body"].indexOf(getNodeName(currentNode)) < 0) {
    var css = getComputedStyle2(currentNode);
    if (css.transform !== "none" || css.perspective !== "none" || css.contain === "paint" || ["transform", "perspective"].indexOf(css.willChange) !== -1 || isFirefox && css.willChange === "filter" || isFirefox && css.filter && css.filter !== "none") {
      return currentNode;
    } else {
      currentNode = currentNode.parentNode;
    }
  }
  return null;
}
function getOffsetParent(element) {
  var window2 = getWindow(element);
  var offsetParent = getTrueOffsetParent(element);
  while (offsetParent && isTableElement(offsetParent) && getComputedStyle2(offsetParent).position === "static") {
    offsetParent = getTrueOffsetParent(offsetParent);
  }
  if (offsetParent && (getNodeName(offsetParent) === "html" || getNodeName(offsetParent) === "body" && getComputedStyle2(offsetParent).position === "static")) {
    return window2;
  }
  return offsetParent || getContainingBlock(element) || window2;
}
var init_getOffsetParent = __esm({
  "../node_modules/@popperjs/core/lib/dom-utils/getOffsetParent.js"() {
    init_getWindow();
    init_getNodeName();
    init_getComputedStyle();
    init_instanceOf();
    init_isTableElement();
    init_getParentNode();
    init_userAgent();
  }
});

// ../node_modules/@popperjs/core/lib/utils/getMainAxisFromPlacement.js
function getMainAxisFromPlacement(placement) {
  return ["top", "bottom"].indexOf(placement) >= 0 ? "x" : "y";
}
var init_getMainAxisFromPlacement = __esm({
  "../node_modules/@popperjs/core/lib/utils/getMainAxisFromPlacement.js"() {
  }
});

// ../node_modules/@popperjs/core/lib/utils/within.js
function within(min2, value, max2) {
  return max(min2, min(value, max2));
}
function withinMaxClamp(min2, value, max2) {
  var v = within(min2, value, max2);
  return v > max2 ? max2 : v;
}
var init_within = __esm({
  "../node_modules/@popperjs/core/lib/utils/within.js"() {
    init_math();
  }
});

// ../node_modules/@popperjs/core/lib/utils/getFreshSideObject.js
function getFreshSideObject() {
  return {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  };
}
var init_getFreshSideObject = __esm({
  "../node_modules/@popperjs/core/lib/utils/getFreshSideObject.js"() {
  }
});

// ../node_modules/@popperjs/core/lib/utils/mergePaddingObject.js
function mergePaddingObject(paddingObject) {
  return Object.assign({}, getFreshSideObject(), paddingObject);
}
var init_mergePaddingObject = __esm({
  "../node_modules/@popperjs/core/lib/utils/mergePaddingObject.js"() {
    init_getFreshSideObject();
  }
});

// ../node_modules/@popperjs/core/lib/utils/expandToHashMap.js
function expandToHashMap(value, keys) {
  return keys.reduce(function(hashMap, key) {
    hashMap[key] = value;
    return hashMap;
  }, {});
}
var init_expandToHashMap = __esm({
  "../node_modules/@popperjs/core/lib/utils/expandToHashMap.js"() {
  }
});

// ../node_modules/@popperjs/core/lib/modifiers/arrow.js
function arrow(_ref) {
  var _state$modifiersData$;
  var state = _ref.state, name = _ref.name, options = _ref.options;
  var arrowElement = state.elements.arrow;
  var popperOffsets2 = state.modifiersData.popperOffsets;
  var basePlacement = getBasePlacement(state.placement);
  var axis = getMainAxisFromPlacement(basePlacement);
  var isVertical = [left, right].indexOf(basePlacement) >= 0;
  var len = isVertical ? "height" : "width";
  if (!arrowElement || !popperOffsets2) {
    return;
  }
  var paddingObject = toPaddingObject(options.padding, state);
  var arrowRect = getLayoutRect(arrowElement);
  var minProp = axis === "y" ? top : left;
  var maxProp = axis === "y" ? bottom : right;
  var endDiff = state.rects.reference[len] + state.rects.reference[axis] - popperOffsets2[axis] - state.rects.popper[len];
  var startDiff = popperOffsets2[axis] - state.rects.reference[axis];
  var arrowOffsetParent = getOffsetParent(arrowElement);
  var clientSize = arrowOffsetParent ? axis === "y" ? arrowOffsetParent.clientHeight || 0 : arrowOffsetParent.clientWidth || 0 : 0;
  var centerToReference = endDiff / 2 - startDiff / 2;
  var min2 = paddingObject[minProp];
  var max2 = clientSize - arrowRect[len] - paddingObject[maxProp];
  var center = clientSize / 2 - arrowRect[len] / 2 + centerToReference;
  var offset2 = within(min2, center, max2);
  var axisProp = axis;
  state.modifiersData[name] = (_state$modifiersData$ = {}, _state$modifiersData$[axisProp] = offset2, _state$modifiersData$.centerOffset = offset2 - center, _state$modifiersData$);
}
function effect(_ref2) {
  var state = _ref2.state, options = _ref2.options;
  var _options$element = options.element, arrowElement = _options$element === void 0 ? "[data-popper-arrow]" : _options$element;
  if (arrowElement == null) {
    return;
  }
  if (typeof arrowElement === "string") {
    arrowElement = state.elements.popper.querySelector(arrowElement);
    if (!arrowElement) {
      return;
    }
  }
  if (!contains(state.elements.popper, arrowElement)) {
    return;
  }
  state.elements.arrow = arrowElement;
}
var toPaddingObject, arrow_default;
var init_arrow = __esm({
  "../node_modules/@popperjs/core/lib/modifiers/arrow.js"() {
    init_getBasePlacement();
    init_getLayoutRect();
    init_contains();
    init_getOffsetParent();
    init_getMainAxisFromPlacement();
    init_within();
    init_mergePaddingObject();
    init_expandToHashMap();
    init_enums();
    toPaddingObject = function toPaddingObject2(padding, state) {
      padding = typeof padding === "function" ? padding(Object.assign({}, state.rects, {
        placement: state.placement
      })) : padding;
      return mergePaddingObject(typeof padding !== "number" ? padding : expandToHashMap(padding, basePlacements));
    };
    arrow_default = {
      name: "arrow",
      enabled: true,
      phase: "main",
      fn: arrow,
      effect,
      requires: ["popperOffsets"],
      requiresIfExists: ["preventOverflow"]
    };
  }
});

// ../node_modules/@popperjs/core/lib/utils/getVariation.js
function getVariation(placement) {
  return placement.split("-")[1];
}
var init_getVariation = __esm({
  "../node_modules/@popperjs/core/lib/utils/getVariation.js"() {
  }
});

// ../node_modules/@popperjs/core/lib/modifiers/computeStyles.js
function roundOffsetsByDPR(_ref, win) {
  var x = _ref.x, y = _ref.y;
  var dpr = win.devicePixelRatio || 1;
  return {
    x: round(x * dpr) / dpr || 0,
    y: round(y * dpr) / dpr || 0
  };
}
function mapToStyles(_ref2) {
  var _Object$assign2;
  var popper2 = _ref2.popper, popperRect = _ref2.popperRect, placement = _ref2.placement, variation = _ref2.variation, offsets = _ref2.offsets, position = _ref2.position, gpuAcceleration = _ref2.gpuAcceleration, adaptive = _ref2.adaptive, roundOffsets = _ref2.roundOffsets, isFixed = _ref2.isFixed;
  var _offsets$x = offsets.x, x = _offsets$x === void 0 ? 0 : _offsets$x, _offsets$y = offsets.y, y = _offsets$y === void 0 ? 0 : _offsets$y;
  var _ref3 = typeof roundOffsets === "function" ? roundOffsets({
    x,
    y
  }) : {
    x,
    y
  };
  x = _ref3.x;
  y = _ref3.y;
  var hasX = offsets.hasOwnProperty("x");
  var hasY = offsets.hasOwnProperty("y");
  var sideX = left;
  var sideY = top;
  var win = window;
  if (adaptive) {
    var offsetParent = getOffsetParent(popper2);
    var heightProp = "clientHeight";
    var widthProp = "clientWidth";
    if (offsetParent === getWindow(popper2)) {
      offsetParent = getDocumentElement(popper2);
      if (getComputedStyle2(offsetParent).position !== "static" && position === "absolute") {
        heightProp = "scrollHeight";
        widthProp = "scrollWidth";
      }
    }
    offsetParent = offsetParent;
    if (placement === top || (placement === left || placement === right) && variation === end) {
      sideY = bottom;
      var offsetY = isFixed && offsetParent === win && win.visualViewport ? win.visualViewport.height : (
        // $FlowFixMe[prop-missing]
        offsetParent[heightProp]
      );
      y -= offsetY - popperRect.height;
      y *= gpuAcceleration ? 1 : -1;
    }
    if (placement === left || (placement === top || placement === bottom) && variation === end) {
      sideX = right;
      var offsetX = isFixed && offsetParent === win && win.visualViewport ? win.visualViewport.width : (
        // $FlowFixMe[prop-missing]
        offsetParent[widthProp]
      );
      x -= offsetX - popperRect.width;
      x *= gpuAcceleration ? 1 : -1;
    }
  }
  var commonStyles = Object.assign({
    position
  }, adaptive && unsetSides);
  var _ref4 = roundOffsets === true ? roundOffsetsByDPR({
    x,
    y
  }, getWindow(popper2)) : {
    x,
    y
  };
  x = _ref4.x;
  y = _ref4.y;
  if (gpuAcceleration) {
    var _Object$assign;
    return Object.assign({}, commonStyles, (_Object$assign = {}, _Object$assign[sideY] = hasY ? "0" : "", _Object$assign[sideX] = hasX ? "0" : "", _Object$assign.transform = (win.devicePixelRatio || 1) <= 1 ? "translate(" + x + "px, " + y + "px)" : "translate3d(" + x + "px, " + y + "px, 0)", _Object$assign));
  }
  return Object.assign({}, commonStyles, (_Object$assign2 = {}, _Object$assign2[sideY] = hasY ? y + "px" : "", _Object$assign2[sideX] = hasX ? x + "px" : "", _Object$assign2.transform = "", _Object$assign2));
}
function computeStyles(_ref5) {
  var state = _ref5.state, options = _ref5.options;
  var _options$gpuAccelerat = options.gpuAcceleration, gpuAcceleration = _options$gpuAccelerat === void 0 ? true : _options$gpuAccelerat, _options$adaptive = options.adaptive, adaptive = _options$adaptive === void 0 ? true : _options$adaptive, _options$roundOffsets = options.roundOffsets, roundOffsets = _options$roundOffsets === void 0 ? true : _options$roundOffsets;
  var commonStyles = {
    placement: getBasePlacement(state.placement),
    variation: getVariation(state.placement),
    popper: state.elements.popper,
    popperRect: state.rects.popper,
    gpuAcceleration,
    isFixed: state.options.strategy === "fixed"
  };
  if (state.modifiersData.popperOffsets != null) {
    state.styles.popper = Object.assign({}, state.styles.popper, mapToStyles(Object.assign({}, commonStyles, {
      offsets: state.modifiersData.popperOffsets,
      position: state.options.strategy,
      adaptive,
      roundOffsets
    })));
  }
  if (state.modifiersData.arrow != null) {
    state.styles.arrow = Object.assign({}, state.styles.arrow, mapToStyles(Object.assign({}, commonStyles, {
      offsets: state.modifiersData.arrow,
      position: "absolute",
      adaptive: false,
      roundOffsets
    })));
  }
  state.attributes.popper = Object.assign({}, state.attributes.popper, {
    "data-popper-placement": state.placement
  });
}
var unsetSides, computeStyles_default;
var init_computeStyles = __esm({
  "../node_modules/@popperjs/core/lib/modifiers/computeStyles.js"() {
    init_enums();
    init_getOffsetParent();
    init_getWindow();
    init_getDocumentElement();
    init_getComputedStyle();
    init_getBasePlacement();
    init_getVariation();
    init_math();
    unsetSides = {
      top: "auto",
      right: "auto",
      bottom: "auto",
      left: "auto"
    };
    computeStyles_default = {
      name: "computeStyles",
      enabled: true,
      phase: "beforeWrite",
      fn: computeStyles,
      data: {}
    };
  }
});

// ../node_modules/@popperjs/core/lib/modifiers/eventListeners.js
function effect2(_ref) {
  var state = _ref.state, instance = _ref.instance, options = _ref.options;
  var _options$scroll = options.scroll, scroll2 = _options$scroll === void 0 ? true : _options$scroll, _options$resize = options.resize, resize = _options$resize === void 0 ? true : _options$resize;
  var window2 = getWindow(state.elements.popper);
  var scrollParents = [].concat(state.scrollParents.reference, state.scrollParents.popper);
  if (scroll2) {
    scrollParents.forEach(function(scrollParent) {
      scrollParent.addEventListener("scroll", instance.update, passive);
    });
  }
  if (resize) {
    window2.addEventListener("resize", instance.update, passive);
  }
  return function() {
    if (scroll2) {
      scrollParents.forEach(function(scrollParent) {
        scrollParent.removeEventListener("scroll", instance.update, passive);
      });
    }
    if (resize) {
      window2.removeEventListener("resize", instance.update, passive);
    }
  };
}
var passive, eventListeners_default;
var init_eventListeners = __esm({
  "../node_modules/@popperjs/core/lib/modifiers/eventListeners.js"() {
    init_getWindow();
    passive = {
      passive: true
    };
    eventListeners_default = {
      name: "eventListeners",
      enabled: true,
      phase: "write",
      fn: function fn() {
      },
      effect: effect2,
      data: {}
    };
  }
});

// ../node_modules/@popperjs/core/lib/utils/getOppositePlacement.js
function getOppositePlacement(placement) {
  return placement.replace(/left|right|bottom|top/g, function(matched) {
    return hash[matched];
  });
}
var hash;
var init_getOppositePlacement = __esm({
  "../node_modules/@popperjs/core/lib/utils/getOppositePlacement.js"() {
    hash = {
      left: "right",
      right: "left",
      bottom: "top",
      top: "bottom"
    };
  }
});

// ../node_modules/@popperjs/core/lib/utils/getOppositeVariationPlacement.js
function getOppositeVariationPlacement(placement) {
  return placement.replace(/start|end/g, function(matched) {
    return hash2[matched];
  });
}
var hash2;
var init_getOppositeVariationPlacement = __esm({
  "../node_modules/@popperjs/core/lib/utils/getOppositeVariationPlacement.js"() {
    hash2 = {
      start: "end",
      end: "start"
    };
  }
});

// ../node_modules/@popperjs/core/lib/dom-utils/getWindowScroll.js
function getWindowScroll(node) {
  var win = getWindow(node);
  var scrollLeft = win.pageXOffset;
  var scrollTop = win.pageYOffset;
  return {
    scrollLeft,
    scrollTop
  };
}
var init_getWindowScroll = __esm({
  "../node_modules/@popperjs/core/lib/dom-utils/getWindowScroll.js"() {
    init_getWindow();
  }
});

// ../node_modules/@popperjs/core/lib/dom-utils/getWindowScrollBarX.js
function getWindowScrollBarX(element) {
  return getBoundingClientRect(getDocumentElement(element)).left + getWindowScroll(element).scrollLeft;
}
var init_getWindowScrollBarX = __esm({
  "../node_modules/@popperjs/core/lib/dom-utils/getWindowScrollBarX.js"() {
    init_getBoundingClientRect();
    init_getDocumentElement();
    init_getWindowScroll();
  }
});

// ../node_modules/@popperjs/core/lib/dom-utils/getViewportRect.js
function getViewportRect(element, strategy) {
  var win = getWindow(element);
  var html = getDocumentElement(element);
  var visualViewport = win.visualViewport;
  var width = html.clientWidth;
  var height = html.clientHeight;
  var x = 0;
  var y = 0;
  if (visualViewport) {
    width = visualViewport.width;
    height = visualViewport.height;
    var layoutViewport = isLayoutViewport();
    if (layoutViewport || !layoutViewport && strategy === "fixed") {
      x = visualViewport.offsetLeft;
      y = visualViewport.offsetTop;
    }
  }
  return {
    width,
    height,
    x: x + getWindowScrollBarX(element),
    y
  };
}
var init_getViewportRect = __esm({
  "../node_modules/@popperjs/core/lib/dom-utils/getViewportRect.js"() {
    init_getWindow();
    init_getDocumentElement();
    init_getWindowScrollBarX();
    init_isLayoutViewport();
  }
});

// ../node_modules/@popperjs/core/lib/dom-utils/getDocumentRect.js
function getDocumentRect(element) {
  var _element$ownerDocumen;
  var html = getDocumentElement(element);
  var winScroll = getWindowScroll(element);
  var body = (_element$ownerDocumen = element.ownerDocument) == null ? void 0 : _element$ownerDocumen.body;
  var width = max(html.scrollWidth, html.clientWidth, body ? body.scrollWidth : 0, body ? body.clientWidth : 0);
  var height = max(html.scrollHeight, html.clientHeight, body ? body.scrollHeight : 0, body ? body.clientHeight : 0);
  var x = -winScroll.scrollLeft + getWindowScrollBarX(element);
  var y = -winScroll.scrollTop;
  if (getComputedStyle2(body || html).direction === "rtl") {
    x += max(html.clientWidth, body ? body.clientWidth : 0) - width;
  }
  return {
    width,
    height,
    x,
    y
  };
}
var init_getDocumentRect = __esm({
  "../node_modules/@popperjs/core/lib/dom-utils/getDocumentRect.js"() {
    init_getDocumentElement();
    init_getComputedStyle();
    init_getWindowScrollBarX();
    init_getWindowScroll();
    init_math();
  }
});

// ../node_modules/@popperjs/core/lib/dom-utils/isScrollParent.js
function isScrollParent(element) {
  var _getComputedStyle = getComputedStyle2(element), overflow = _getComputedStyle.overflow, overflowX = _getComputedStyle.overflowX, overflowY = _getComputedStyle.overflowY;
  return /auto|scroll|overlay|hidden/.test(overflow + overflowY + overflowX);
}
var init_isScrollParent = __esm({
  "../node_modules/@popperjs/core/lib/dom-utils/isScrollParent.js"() {
    init_getComputedStyle();
  }
});

// ../node_modules/@popperjs/core/lib/dom-utils/getScrollParent.js
function getScrollParent(node) {
  if (["html", "body", "#document"].indexOf(getNodeName(node)) >= 0) {
    return node.ownerDocument.body;
  }
  if (isHTMLElement(node) && isScrollParent(node)) {
    return node;
  }
  return getScrollParent(getParentNode(node));
}
var init_getScrollParent = __esm({
  "../node_modules/@popperjs/core/lib/dom-utils/getScrollParent.js"() {
    init_getParentNode();
    init_isScrollParent();
    init_getNodeName();
    init_instanceOf();
  }
});

// ../node_modules/@popperjs/core/lib/dom-utils/listScrollParents.js
function listScrollParents(element, list) {
  var _element$ownerDocumen;
  if (list === void 0) {
    list = [];
  }
  var scrollParent = getScrollParent(element);
  var isBody = scrollParent === ((_element$ownerDocumen = element.ownerDocument) == null ? void 0 : _element$ownerDocumen.body);
  var win = getWindow(scrollParent);
  var target = isBody ? [win].concat(win.visualViewport || [], isScrollParent(scrollParent) ? scrollParent : []) : scrollParent;
  var updatedList = list.concat(target);
  return isBody ? updatedList : (
    // $FlowFixMe[incompatible-call]: isBody tells us target will be an HTMLElement here
    updatedList.concat(listScrollParents(getParentNode(target)))
  );
}
var init_listScrollParents = __esm({
  "../node_modules/@popperjs/core/lib/dom-utils/listScrollParents.js"() {
    init_getScrollParent();
    init_getParentNode();
    init_getWindow();
    init_isScrollParent();
  }
});

// ../node_modules/@popperjs/core/lib/utils/rectToClientRect.js
function rectToClientRect(rect) {
  return Object.assign({}, rect, {
    left: rect.x,
    top: rect.y,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height
  });
}
var init_rectToClientRect = __esm({
  "../node_modules/@popperjs/core/lib/utils/rectToClientRect.js"() {
  }
});

// ../node_modules/@popperjs/core/lib/dom-utils/getClippingRect.js
function getInnerBoundingClientRect(element, strategy) {
  var rect = getBoundingClientRect(element, false, strategy === "fixed");
  rect.top = rect.top + element.clientTop;
  rect.left = rect.left + element.clientLeft;
  rect.bottom = rect.top + element.clientHeight;
  rect.right = rect.left + element.clientWidth;
  rect.width = element.clientWidth;
  rect.height = element.clientHeight;
  rect.x = rect.left;
  rect.y = rect.top;
  return rect;
}
function getClientRectFromMixedType(element, clippingParent, strategy) {
  return clippingParent === viewport ? rectToClientRect(getViewportRect(element, strategy)) : isElement(clippingParent) ? getInnerBoundingClientRect(clippingParent, strategy) : rectToClientRect(getDocumentRect(getDocumentElement(element)));
}
function getClippingParents(element) {
  var clippingParents2 = listScrollParents(getParentNode(element));
  var canEscapeClipping = ["absolute", "fixed"].indexOf(getComputedStyle2(element).position) >= 0;
  var clipperElement = canEscapeClipping && isHTMLElement(element) ? getOffsetParent(element) : element;
  if (!isElement(clipperElement)) {
    return [];
  }
  return clippingParents2.filter(function(clippingParent) {
    return isElement(clippingParent) && contains(clippingParent, clipperElement) && getNodeName(clippingParent) !== "body";
  });
}
function getClippingRect(element, boundary, rootBoundary, strategy) {
  var mainClippingParents = boundary === "clippingParents" ? getClippingParents(element) : [].concat(boundary);
  var clippingParents2 = [].concat(mainClippingParents, [rootBoundary]);
  var firstClippingParent = clippingParents2[0];
  var clippingRect = clippingParents2.reduce(function(accRect, clippingParent) {
    var rect = getClientRectFromMixedType(element, clippingParent, strategy);
    accRect.top = max(rect.top, accRect.top);
    accRect.right = min(rect.right, accRect.right);
    accRect.bottom = min(rect.bottom, accRect.bottom);
    accRect.left = max(rect.left, accRect.left);
    return accRect;
  }, getClientRectFromMixedType(element, firstClippingParent, strategy));
  clippingRect.width = clippingRect.right - clippingRect.left;
  clippingRect.height = clippingRect.bottom - clippingRect.top;
  clippingRect.x = clippingRect.left;
  clippingRect.y = clippingRect.top;
  return clippingRect;
}
var init_getClippingRect = __esm({
  "../node_modules/@popperjs/core/lib/dom-utils/getClippingRect.js"() {
    init_enums();
    init_getViewportRect();
    init_getDocumentRect();
    init_listScrollParents();
    init_getOffsetParent();
    init_getDocumentElement();
    init_getComputedStyle();
    init_instanceOf();
    init_getBoundingClientRect();
    init_getParentNode();
    init_contains();
    init_getNodeName();
    init_rectToClientRect();
    init_math();
  }
});

// ../node_modules/@popperjs/core/lib/utils/computeOffsets.js
function computeOffsets(_ref) {
  var reference2 = _ref.reference, element = _ref.element, placement = _ref.placement;
  var basePlacement = placement ? getBasePlacement(placement) : null;
  var variation = placement ? getVariation(placement) : null;
  var commonX = reference2.x + reference2.width / 2 - element.width / 2;
  var commonY = reference2.y + reference2.height / 2 - element.height / 2;
  var offsets;
  switch (basePlacement) {
    case top:
      offsets = {
        x: commonX,
        y: reference2.y - element.height
      };
      break;
    case bottom:
      offsets = {
        x: commonX,
        y: reference2.y + reference2.height
      };
      break;
    case right:
      offsets = {
        x: reference2.x + reference2.width,
        y: commonY
      };
      break;
    case left:
      offsets = {
        x: reference2.x - element.width,
        y: commonY
      };
      break;
    default:
      offsets = {
        x: reference2.x,
        y: reference2.y
      };
  }
  var mainAxis = basePlacement ? getMainAxisFromPlacement(basePlacement) : null;
  if (mainAxis != null) {
    var len = mainAxis === "y" ? "height" : "width";
    switch (variation) {
      case start:
        offsets[mainAxis] = offsets[mainAxis] - (reference2[len] / 2 - element[len] / 2);
        break;
      case end:
        offsets[mainAxis] = offsets[mainAxis] + (reference2[len] / 2 - element[len] / 2);
        break;
      default:
    }
  }
  return offsets;
}
var init_computeOffsets = __esm({
  "../node_modules/@popperjs/core/lib/utils/computeOffsets.js"() {
    init_getBasePlacement();
    init_getVariation();
    init_getMainAxisFromPlacement();
    init_enums();
  }
});

// ../node_modules/@popperjs/core/lib/utils/detectOverflow.js
function detectOverflow(state, options) {
  if (options === void 0) {
    options = {};
  }
  var _options = options, _options$placement = _options.placement, placement = _options$placement === void 0 ? state.placement : _options$placement, _options$strategy = _options.strategy, strategy = _options$strategy === void 0 ? state.strategy : _options$strategy, _options$boundary = _options.boundary, boundary = _options$boundary === void 0 ? clippingParents : _options$boundary, _options$rootBoundary = _options.rootBoundary, rootBoundary = _options$rootBoundary === void 0 ? viewport : _options$rootBoundary, _options$elementConte = _options.elementContext, elementContext = _options$elementConte === void 0 ? popper : _options$elementConte, _options$altBoundary = _options.altBoundary, altBoundary = _options$altBoundary === void 0 ? false : _options$altBoundary, _options$padding = _options.padding, padding = _options$padding === void 0 ? 0 : _options$padding;
  var paddingObject = mergePaddingObject(typeof padding !== "number" ? padding : expandToHashMap(padding, basePlacements));
  var altContext = elementContext === popper ? reference : popper;
  var popperRect = state.rects.popper;
  var element = state.elements[altBoundary ? altContext : elementContext];
  var clippingClientRect = getClippingRect(isElement(element) ? element : element.contextElement || getDocumentElement(state.elements.popper), boundary, rootBoundary, strategy);
  var referenceClientRect = getBoundingClientRect(state.elements.reference);
  var popperOffsets2 = computeOffsets({
    reference: referenceClientRect,
    element: popperRect,
    strategy: "absolute",
    placement
  });
  var popperClientRect = rectToClientRect(Object.assign({}, popperRect, popperOffsets2));
  var elementClientRect = elementContext === popper ? popperClientRect : referenceClientRect;
  var overflowOffsets = {
    top: clippingClientRect.top - elementClientRect.top + paddingObject.top,
    bottom: elementClientRect.bottom - clippingClientRect.bottom + paddingObject.bottom,
    left: clippingClientRect.left - elementClientRect.left + paddingObject.left,
    right: elementClientRect.right - clippingClientRect.right + paddingObject.right
  };
  var offsetData = state.modifiersData.offset;
  if (elementContext === popper && offsetData) {
    var offset2 = offsetData[placement];
    Object.keys(overflowOffsets).forEach(function(key) {
      var multiply = [right, bottom].indexOf(key) >= 0 ? 1 : -1;
      var axis = [top, bottom].indexOf(key) >= 0 ? "y" : "x";
      overflowOffsets[key] += offset2[axis] * multiply;
    });
  }
  return overflowOffsets;
}
var init_detectOverflow = __esm({
  "../node_modules/@popperjs/core/lib/utils/detectOverflow.js"() {
    init_getClippingRect();
    init_getDocumentElement();
    init_getBoundingClientRect();
    init_computeOffsets();
    init_rectToClientRect();
    init_enums();
    init_instanceOf();
    init_mergePaddingObject();
    init_expandToHashMap();
  }
});

// ../node_modules/@popperjs/core/lib/utils/computeAutoPlacement.js
function computeAutoPlacement(state, options) {
  if (options === void 0) {
    options = {};
  }
  var _options = options, placement = _options.placement, boundary = _options.boundary, rootBoundary = _options.rootBoundary, padding = _options.padding, flipVariations = _options.flipVariations, _options$allowedAutoP = _options.allowedAutoPlacements, allowedAutoPlacements = _options$allowedAutoP === void 0 ? placements : _options$allowedAutoP;
  var variation = getVariation(placement);
  var placements2 = variation ? flipVariations ? variationPlacements : variationPlacements.filter(function(placement2) {
    return getVariation(placement2) === variation;
  }) : basePlacements;
  var allowedPlacements = placements2.filter(function(placement2) {
    return allowedAutoPlacements.indexOf(placement2) >= 0;
  });
  if (allowedPlacements.length === 0) {
    allowedPlacements = placements2;
  }
  var overflows = allowedPlacements.reduce(function(acc, placement2) {
    acc[placement2] = detectOverflow(state, {
      placement: placement2,
      boundary,
      rootBoundary,
      padding
    })[getBasePlacement(placement2)];
    return acc;
  }, {});
  return Object.keys(overflows).sort(function(a, b) {
    return overflows[a] - overflows[b];
  });
}
var init_computeAutoPlacement = __esm({
  "../node_modules/@popperjs/core/lib/utils/computeAutoPlacement.js"() {
    init_getVariation();
    init_enums();
    init_detectOverflow();
    init_getBasePlacement();
  }
});

// ../node_modules/@popperjs/core/lib/modifiers/flip.js
function getExpandedFallbackPlacements(placement) {
  if (getBasePlacement(placement) === auto) {
    return [];
  }
  var oppositePlacement = getOppositePlacement(placement);
  return [getOppositeVariationPlacement(placement), oppositePlacement, getOppositeVariationPlacement(oppositePlacement)];
}
function flip(_ref) {
  var state = _ref.state, options = _ref.options, name = _ref.name;
  if (state.modifiersData[name]._skip) {
    return;
  }
  var _options$mainAxis = options.mainAxis, checkMainAxis = _options$mainAxis === void 0 ? true : _options$mainAxis, _options$altAxis = options.altAxis, checkAltAxis = _options$altAxis === void 0 ? true : _options$altAxis, specifiedFallbackPlacements = options.fallbackPlacements, padding = options.padding, boundary = options.boundary, rootBoundary = options.rootBoundary, altBoundary = options.altBoundary, _options$flipVariatio = options.flipVariations, flipVariations = _options$flipVariatio === void 0 ? true : _options$flipVariatio, allowedAutoPlacements = options.allowedAutoPlacements;
  var preferredPlacement = state.options.placement;
  var basePlacement = getBasePlacement(preferredPlacement);
  var isBasePlacement = basePlacement === preferredPlacement;
  var fallbackPlacements = specifiedFallbackPlacements || (isBasePlacement || !flipVariations ? [getOppositePlacement(preferredPlacement)] : getExpandedFallbackPlacements(preferredPlacement));
  var placements2 = [preferredPlacement].concat(fallbackPlacements).reduce(function(acc, placement2) {
    return acc.concat(getBasePlacement(placement2) === auto ? computeAutoPlacement(state, {
      placement: placement2,
      boundary,
      rootBoundary,
      padding,
      flipVariations,
      allowedAutoPlacements
    }) : placement2);
  }, []);
  var referenceRect = state.rects.reference;
  var popperRect = state.rects.popper;
  var checksMap = /* @__PURE__ */ new Map();
  var makeFallbackChecks = true;
  var firstFittingPlacement = placements2[0];
  for (var i = 0; i < placements2.length; i++) {
    var placement = placements2[i];
    var _basePlacement = getBasePlacement(placement);
    var isStartVariation = getVariation(placement) === start;
    var isVertical = [top, bottom].indexOf(_basePlacement) >= 0;
    var len = isVertical ? "width" : "height";
    var overflow = detectOverflow(state, {
      placement,
      boundary,
      rootBoundary,
      altBoundary,
      padding
    });
    var mainVariationSide = isVertical ? isStartVariation ? right : left : isStartVariation ? bottom : top;
    if (referenceRect[len] > popperRect[len]) {
      mainVariationSide = getOppositePlacement(mainVariationSide);
    }
    var altVariationSide = getOppositePlacement(mainVariationSide);
    var checks = [];
    if (checkMainAxis) {
      checks.push(overflow[_basePlacement] <= 0);
    }
    if (checkAltAxis) {
      checks.push(overflow[mainVariationSide] <= 0, overflow[altVariationSide] <= 0);
    }
    if (checks.every(function(check) {
      return check;
    })) {
      firstFittingPlacement = placement;
      makeFallbackChecks = false;
      break;
    }
    checksMap.set(placement, checks);
  }
  if (makeFallbackChecks) {
    var numberOfChecks = flipVariations ? 3 : 1;
    var _loop = function _loop2(_i2) {
      var fittingPlacement = placements2.find(function(placement2) {
        var checks2 = checksMap.get(placement2);
        if (checks2) {
          return checks2.slice(0, _i2).every(function(check) {
            return check;
          });
        }
      });
      if (fittingPlacement) {
        firstFittingPlacement = fittingPlacement;
        return "break";
      }
    };
    for (var _i = numberOfChecks; _i > 0; _i--) {
      var _ret = _loop(_i);
      if (_ret === "break") break;
    }
  }
  if (state.placement !== firstFittingPlacement) {
    state.modifiersData[name]._skip = true;
    state.placement = firstFittingPlacement;
    state.reset = true;
  }
}
var flip_default;
var init_flip = __esm({
  "../node_modules/@popperjs/core/lib/modifiers/flip.js"() {
    init_getOppositePlacement();
    init_getBasePlacement();
    init_getOppositeVariationPlacement();
    init_detectOverflow();
    init_computeAutoPlacement();
    init_enums();
    init_getVariation();
    flip_default = {
      name: "flip",
      enabled: true,
      phase: "main",
      fn: flip,
      requiresIfExists: ["offset"],
      data: {
        _skip: false
      }
    };
  }
});

// ../node_modules/@popperjs/core/lib/modifiers/hide.js
function getSideOffsets(overflow, rect, preventedOffsets) {
  if (preventedOffsets === void 0) {
    preventedOffsets = {
      x: 0,
      y: 0
    };
  }
  return {
    top: overflow.top - rect.height - preventedOffsets.y,
    right: overflow.right - rect.width + preventedOffsets.x,
    bottom: overflow.bottom - rect.height + preventedOffsets.y,
    left: overflow.left - rect.width - preventedOffsets.x
  };
}
function isAnySideFullyClipped(overflow) {
  return [top, right, bottom, left].some(function(side) {
    return overflow[side] >= 0;
  });
}
function hide(_ref) {
  var state = _ref.state, name = _ref.name;
  var referenceRect = state.rects.reference;
  var popperRect = state.rects.popper;
  var preventedOffsets = state.modifiersData.preventOverflow;
  var referenceOverflow = detectOverflow(state, {
    elementContext: "reference"
  });
  var popperAltOverflow = detectOverflow(state, {
    altBoundary: true
  });
  var referenceClippingOffsets = getSideOffsets(referenceOverflow, referenceRect);
  var popperEscapeOffsets = getSideOffsets(popperAltOverflow, popperRect, preventedOffsets);
  var isReferenceHidden = isAnySideFullyClipped(referenceClippingOffsets);
  var hasPopperEscaped = isAnySideFullyClipped(popperEscapeOffsets);
  state.modifiersData[name] = {
    referenceClippingOffsets,
    popperEscapeOffsets,
    isReferenceHidden,
    hasPopperEscaped
  };
  state.attributes.popper = Object.assign({}, state.attributes.popper, {
    "data-popper-reference-hidden": isReferenceHidden,
    "data-popper-escaped": hasPopperEscaped
  });
}
var hide_default;
var init_hide = __esm({
  "../node_modules/@popperjs/core/lib/modifiers/hide.js"() {
    init_enums();
    init_detectOverflow();
    hide_default = {
      name: "hide",
      enabled: true,
      phase: "main",
      requiresIfExists: ["preventOverflow"],
      fn: hide
    };
  }
});

// ../node_modules/@popperjs/core/lib/modifiers/offset.js
function distanceAndSkiddingToXY(placement, rects, offset2) {
  var basePlacement = getBasePlacement(placement);
  var invertDistance = [left, top].indexOf(basePlacement) >= 0 ? -1 : 1;
  var _ref = typeof offset2 === "function" ? offset2(Object.assign({}, rects, {
    placement
  })) : offset2, skidding = _ref[0], distance = _ref[1];
  skidding = skidding || 0;
  distance = (distance || 0) * invertDistance;
  return [left, right].indexOf(basePlacement) >= 0 ? {
    x: distance,
    y: skidding
  } : {
    x: skidding,
    y: distance
  };
}
function offset(_ref2) {
  var state = _ref2.state, options = _ref2.options, name = _ref2.name;
  var _options$offset = options.offset, offset2 = _options$offset === void 0 ? [0, 0] : _options$offset;
  var data = placements.reduce(function(acc, placement) {
    acc[placement] = distanceAndSkiddingToXY(placement, state.rects, offset2);
    return acc;
  }, {});
  var _data$state$placement = data[state.placement], x = _data$state$placement.x, y = _data$state$placement.y;
  if (state.modifiersData.popperOffsets != null) {
    state.modifiersData.popperOffsets.x += x;
    state.modifiersData.popperOffsets.y += y;
  }
  state.modifiersData[name] = data;
}
var offset_default;
var init_offset = __esm({
  "../node_modules/@popperjs/core/lib/modifiers/offset.js"() {
    init_getBasePlacement();
    init_enums();
    offset_default = {
      name: "offset",
      enabled: true,
      phase: "main",
      requires: ["popperOffsets"],
      fn: offset
    };
  }
});

// ../node_modules/@popperjs/core/lib/modifiers/popperOffsets.js
function popperOffsets(_ref) {
  var state = _ref.state, name = _ref.name;
  state.modifiersData[name] = computeOffsets({
    reference: state.rects.reference,
    element: state.rects.popper,
    strategy: "absolute",
    placement: state.placement
  });
}
var popperOffsets_default;
var init_popperOffsets = __esm({
  "../node_modules/@popperjs/core/lib/modifiers/popperOffsets.js"() {
    init_computeOffsets();
    popperOffsets_default = {
      name: "popperOffsets",
      enabled: true,
      phase: "read",
      fn: popperOffsets,
      data: {}
    };
  }
});

// ../node_modules/@popperjs/core/lib/utils/getAltAxis.js
function getAltAxis(axis) {
  return axis === "x" ? "y" : "x";
}
var init_getAltAxis = __esm({
  "../node_modules/@popperjs/core/lib/utils/getAltAxis.js"() {
  }
});

// ../node_modules/@popperjs/core/lib/modifiers/preventOverflow.js
function preventOverflow(_ref) {
  var state = _ref.state, options = _ref.options, name = _ref.name;
  var _options$mainAxis = options.mainAxis, checkMainAxis = _options$mainAxis === void 0 ? true : _options$mainAxis, _options$altAxis = options.altAxis, checkAltAxis = _options$altAxis === void 0 ? false : _options$altAxis, boundary = options.boundary, rootBoundary = options.rootBoundary, altBoundary = options.altBoundary, padding = options.padding, _options$tether = options.tether, tether = _options$tether === void 0 ? true : _options$tether, _options$tetherOffset = options.tetherOffset, tetherOffset = _options$tetherOffset === void 0 ? 0 : _options$tetherOffset;
  var overflow = detectOverflow(state, {
    boundary,
    rootBoundary,
    padding,
    altBoundary
  });
  var basePlacement = getBasePlacement(state.placement);
  var variation = getVariation(state.placement);
  var isBasePlacement = !variation;
  var mainAxis = getMainAxisFromPlacement(basePlacement);
  var altAxis = getAltAxis(mainAxis);
  var popperOffsets2 = state.modifiersData.popperOffsets;
  var referenceRect = state.rects.reference;
  var popperRect = state.rects.popper;
  var tetherOffsetValue = typeof tetherOffset === "function" ? tetherOffset(Object.assign({}, state.rects, {
    placement: state.placement
  })) : tetherOffset;
  var normalizedTetherOffsetValue = typeof tetherOffsetValue === "number" ? {
    mainAxis: tetherOffsetValue,
    altAxis: tetherOffsetValue
  } : Object.assign({
    mainAxis: 0,
    altAxis: 0
  }, tetherOffsetValue);
  var offsetModifierState = state.modifiersData.offset ? state.modifiersData.offset[state.placement] : null;
  var data = {
    x: 0,
    y: 0
  };
  if (!popperOffsets2) {
    return;
  }
  if (checkMainAxis) {
    var _offsetModifierState$;
    var mainSide = mainAxis === "y" ? top : left;
    var altSide = mainAxis === "y" ? bottom : right;
    var len = mainAxis === "y" ? "height" : "width";
    var offset2 = popperOffsets2[mainAxis];
    var min2 = offset2 + overflow[mainSide];
    var max2 = offset2 - overflow[altSide];
    var additive = tether ? -popperRect[len] / 2 : 0;
    var minLen = variation === start ? referenceRect[len] : popperRect[len];
    var maxLen = variation === start ? -popperRect[len] : -referenceRect[len];
    var arrowElement = state.elements.arrow;
    var arrowRect = tether && arrowElement ? getLayoutRect(arrowElement) : {
      width: 0,
      height: 0
    };
    var arrowPaddingObject = state.modifiersData["arrow#persistent"] ? state.modifiersData["arrow#persistent"].padding : getFreshSideObject();
    var arrowPaddingMin = arrowPaddingObject[mainSide];
    var arrowPaddingMax = arrowPaddingObject[altSide];
    var arrowLen = within(0, referenceRect[len], arrowRect[len]);
    var minOffset = isBasePlacement ? referenceRect[len] / 2 - additive - arrowLen - arrowPaddingMin - normalizedTetherOffsetValue.mainAxis : minLen - arrowLen - arrowPaddingMin - normalizedTetherOffsetValue.mainAxis;
    var maxOffset = isBasePlacement ? -referenceRect[len] / 2 + additive + arrowLen + arrowPaddingMax + normalizedTetherOffsetValue.mainAxis : maxLen + arrowLen + arrowPaddingMax + normalizedTetherOffsetValue.mainAxis;
    var arrowOffsetParent = state.elements.arrow && getOffsetParent(state.elements.arrow);
    var clientOffset = arrowOffsetParent ? mainAxis === "y" ? arrowOffsetParent.clientTop || 0 : arrowOffsetParent.clientLeft || 0 : 0;
    var offsetModifierValue = (_offsetModifierState$ = offsetModifierState == null ? void 0 : offsetModifierState[mainAxis]) != null ? _offsetModifierState$ : 0;
    var tetherMin = offset2 + minOffset - offsetModifierValue - clientOffset;
    var tetherMax = offset2 + maxOffset - offsetModifierValue;
    var preventedOffset = within(tether ? min(min2, tetherMin) : min2, offset2, tether ? max(max2, tetherMax) : max2);
    popperOffsets2[mainAxis] = preventedOffset;
    data[mainAxis] = preventedOffset - offset2;
  }
  if (checkAltAxis) {
    var _offsetModifierState$2;
    var _mainSide = mainAxis === "x" ? top : left;
    var _altSide = mainAxis === "x" ? bottom : right;
    var _offset = popperOffsets2[altAxis];
    var _len = altAxis === "y" ? "height" : "width";
    var _min = _offset + overflow[_mainSide];
    var _max = _offset - overflow[_altSide];
    var isOriginSide = [top, left].indexOf(basePlacement) !== -1;
    var _offsetModifierValue = (_offsetModifierState$2 = offsetModifierState == null ? void 0 : offsetModifierState[altAxis]) != null ? _offsetModifierState$2 : 0;
    var _tetherMin = isOriginSide ? _min : _offset - referenceRect[_len] - popperRect[_len] - _offsetModifierValue + normalizedTetherOffsetValue.altAxis;
    var _tetherMax = isOriginSide ? _offset + referenceRect[_len] + popperRect[_len] - _offsetModifierValue - normalizedTetherOffsetValue.altAxis : _max;
    var _preventedOffset = tether && isOriginSide ? withinMaxClamp(_tetherMin, _offset, _tetherMax) : within(tether ? _tetherMin : _min, _offset, tether ? _tetherMax : _max);
    popperOffsets2[altAxis] = _preventedOffset;
    data[altAxis] = _preventedOffset - _offset;
  }
  state.modifiersData[name] = data;
}
var preventOverflow_default;
var init_preventOverflow = __esm({
  "../node_modules/@popperjs/core/lib/modifiers/preventOverflow.js"() {
    init_enums();
    init_getBasePlacement();
    init_getMainAxisFromPlacement();
    init_getAltAxis();
    init_within();
    init_getLayoutRect();
    init_getOffsetParent();
    init_detectOverflow();
    init_getVariation();
    init_getFreshSideObject();
    init_math();
    preventOverflow_default = {
      name: "preventOverflow",
      enabled: true,
      phase: "main",
      fn: preventOverflow,
      requiresIfExists: ["offset"]
    };
  }
});

// ../node_modules/@popperjs/core/lib/modifiers/index.js
var init_modifiers = __esm({
  "../node_modules/@popperjs/core/lib/modifiers/index.js"() {
    init_arrow();
    init_computeStyles();
    init_eventListeners();
    init_flip();
    init_hide();
    init_offset();
    init_popperOffsets();
    init_preventOverflow();
  }
});

// ../node_modules/@popperjs/core/lib/dom-utils/getHTMLElementScroll.js
function getHTMLElementScroll(element) {
  return {
    scrollLeft: element.scrollLeft,
    scrollTop: element.scrollTop
  };
}
var init_getHTMLElementScroll = __esm({
  "../node_modules/@popperjs/core/lib/dom-utils/getHTMLElementScroll.js"() {
  }
});

// ../node_modules/@popperjs/core/lib/dom-utils/getNodeScroll.js
function getNodeScroll(node) {
  if (node === getWindow(node) || !isHTMLElement(node)) {
    return getWindowScroll(node);
  } else {
    return getHTMLElementScroll(node);
  }
}
var init_getNodeScroll = __esm({
  "../node_modules/@popperjs/core/lib/dom-utils/getNodeScroll.js"() {
    init_getWindowScroll();
    init_getWindow();
    init_instanceOf();
    init_getHTMLElementScroll();
  }
});

// ../node_modules/@popperjs/core/lib/dom-utils/getCompositeRect.js
function isElementScaled(element) {
  var rect = element.getBoundingClientRect();
  var scaleX = round(rect.width) / element.offsetWidth || 1;
  var scaleY = round(rect.height) / element.offsetHeight || 1;
  return scaleX !== 1 || scaleY !== 1;
}
function getCompositeRect(elementOrVirtualElement, offsetParent, isFixed) {
  if (isFixed === void 0) {
    isFixed = false;
  }
  var isOffsetParentAnElement = isHTMLElement(offsetParent);
  var offsetParentIsScaled = isHTMLElement(offsetParent) && isElementScaled(offsetParent);
  var documentElement = getDocumentElement(offsetParent);
  var rect = getBoundingClientRect(elementOrVirtualElement, offsetParentIsScaled, isFixed);
  var scroll2 = {
    scrollLeft: 0,
    scrollTop: 0
  };
  var offsets = {
    x: 0,
    y: 0
  };
  if (isOffsetParentAnElement || !isOffsetParentAnElement && !isFixed) {
    if (getNodeName(offsetParent) !== "body" || // https://github.com/popperjs/popper-core/issues/1078
    isScrollParent(documentElement)) {
      scroll2 = getNodeScroll(offsetParent);
    }
    if (isHTMLElement(offsetParent)) {
      offsets = getBoundingClientRect(offsetParent, true);
      offsets.x += offsetParent.clientLeft;
      offsets.y += offsetParent.clientTop;
    } else if (documentElement) {
      offsets.x = getWindowScrollBarX(documentElement);
    }
  }
  return {
    x: rect.left + scroll2.scrollLeft - offsets.x,
    y: rect.top + scroll2.scrollTop - offsets.y,
    width: rect.width,
    height: rect.height
  };
}
var init_getCompositeRect = __esm({
  "../node_modules/@popperjs/core/lib/dom-utils/getCompositeRect.js"() {
    init_getBoundingClientRect();
    init_getNodeScroll();
    init_getNodeName();
    init_instanceOf();
    init_getWindowScrollBarX();
    init_getDocumentElement();
    init_isScrollParent();
    init_math();
  }
});

// ../node_modules/@popperjs/core/lib/utils/orderModifiers.js
function order(modifiers) {
  var map = /* @__PURE__ */ new Map();
  var visited = /* @__PURE__ */ new Set();
  var result = [];
  modifiers.forEach(function(modifier) {
    map.set(modifier.name, modifier);
  });
  function sort(modifier) {
    visited.add(modifier.name);
    var requires = [].concat(modifier.requires || [], modifier.requiresIfExists || []);
    requires.forEach(function(dep) {
      if (!visited.has(dep)) {
        var depModifier = map.get(dep);
        if (depModifier) {
          sort(depModifier);
        }
      }
    });
    result.push(modifier);
  }
  modifiers.forEach(function(modifier) {
    if (!visited.has(modifier.name)) {
      sort(modifier);
    }
  });
  return result;
}
function orderModifiers(modifiers) {
  var orderedModifiers = order(modifiers);
  return modifierPhases.reduce(function(acc, phase) {
    return acc.concat(orderedModifiers.filter(function(modifier) {
      return modifier.phase === phase;
    }));
  }, []);
}
var init_orderModifiers = __esm({
  "../node_modules/@popperjs/core/lib/utils/orderModifiers.js"() {
    init_enums();
  }
});

// ../node_modules/@popperjs/core/lib/utils/debounce.js
function debounce(fn2) {
  var pending;
  return function() {
    if (!pending) {
      pending = new Promise(function(resolve) {
        Promise.resolve().then(function() {
          pending = void 0;
          resolve(fn2());
        });
      });
    }
    return pending;
  };
}
var init_debounce = __esm({
  "../node_modules/@popperjs/core/lib/utils/debounce.js"() {
  }
});

// ../node_modules/@popperjs/core/lib/utils/mergeByName.js
function mergeByName(modifiers) {
  var merged = modifiers.reduce(function(merged2, current) {
    var existing = merged2[current.name];
    merged2[current.name] = existing ? Object.assign({}, existing, current, {
      options: Object.assign({}, existing.options, current.options),
      data: Object.assign({}, existing.data, current.data)
    }) : current;
    return merged2;
  }, {});
  return Object.keys(merged).map(function(key) {
    return merged[key];
  });
}
var init_mergeByName = __esm({
  "../node_modules/@popperjs/core/lib/utils/mergeByName.js"() {
  }
});

// ../node_modules/@popperjs/core/lib/createPopper.js
function areValidElements() {
  for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }
  return !args.some(function(element) {
    return !(element && typeof element.getBoundingClientRect === "function");
  });
}
function popperGenerator(generatorOptions) {
  if (generatorOptions === void 0) {
    generatorOptions = {};
  }
  var _generatorOptions = generatorOptions, _generatorOptions$def = _generatorOptions.defaultModifiers, defaultModifiers = _generatorOptions$def === void 0 ? [] : _generatorOptions$def, _generatorOptions$def2 = _generatorOptions.defaultOptions, defaultOptions2 = _generatorOptions$def2 === void 0 ? DEFAULT_OPTIONS : _generatorOptions$def2;
  return function createPopper3(reference2, popper2, options) {
    if (options === void 0) {
      options = defaultOptions2;
    }
    var state = {
      placement: "bottom",
      orderedModifiers: [],
      options: Object.assign({}, DEFAULT_OPTIONS, defaultOptions2),
      modifiersData: {},
      elements: {
        reference: reference2,
        popper: popper2
      },
      attributes: {},
      styles: {}
    };
    var effectCleanupFns = [];
    var isDestroyed = false;
    var instance = {
      state,
      setOptions: function setOptions(setOptionsAction) {
        var options2 = typeof setOptionsAction === "function" ? setOptionsAction(state.options) : setOptionsAction;
        cleanupModifierEffects();
        state.options = Object.assign({}, defaultOptions2, state.options, options2);
        state.scrollParents = {
          reference: isElement(reference2) ? listScrollParents(reference2) : reference2.contextElement ? listScrollParents(reference2.contextElement) : [],
          popper: listScrollParents(popper2)
        };
        var orderedModifiers = orderModifiers(mergeByName([].concat(defaultModifiers, state.options.modifiers)));
        state.orderedModifiers = orderedModifiers.filter(function(m) {
          return m.enabled;
        });
        runModifierEffects();
        return instance.update();
      },
      // Sync update – it will always be executed, even if not necessary. This
      // is useful for low frequency updates where sync behavior simplifies the
      // logic.
      // For high frequency updates (e.g. `resize` and `scroll` events), always
      // prefer the async Popper#update method
      forceUpdate: function forceUpdate() {
        if (isDestroyed) {
          return;
        }
        var _state$elements = state.elements, reference3 = _state$elements.reference, popper3 = _state$elements.popper;
        if (!areValidElements(reference3, popper3)) {
          return;
        }
        state.rects = {
          reference: getCompositeRect(reference3, getOffsetParent(popper3), state.options.strategy === "fixed"),
          popper: getLayoutRect(popper3)
        };
        state.reset = false;
        state.placement = state.options.placement;
        state.orderedModifiers.forEach(function(modifier) {
          return state.modifiersData[modifier.name] = Object.assign({}, modifier.data);
        });
        for (var index = 0; index < state.orderedModifiers.length; index++) {
          if (state.reset === true) {
            state.reset = false;
            index = -1;
            continue;
          }
          var _state$orderedModifie = state.orderedModifiers[index], fn2 = _state$orderedModifie.fn, _state$orderedModifie2 = _state$orderedModifie.options, _options = _state$orderedModifie2 === void 0 ? {} : _state$orderedModifie2, name = _state$orderedModifie.name;
          if (typeof fn2 === "function") {
            state = fn2({
              state,
              options: _options,
              name,
              instance
            }) || state;
          }
        }
      },
      // Async and optimistically optimized update – it will not be executed if
      // not necessary (debounced to run at most once-per-tick)
      update: debounce(function() {
        return new Promise(function(resolve) {
          instance.forceUpdate();
          resolve(state);
        });
      }),
      destroy: function destroy() {
        cleanupModifierEffects();
        isDestroyed = true;
      }
    };
    if (!areValidElements(reference2, popper2)) {
      return instance;
    }
    instance.setOptions(options).then(function(state2) {
      if (!isDestroyed && options.onFirstUpdate) {
        options.onFirstUpdate(state2);
      }
    });
    function runModifierEffects() {
      state.orderedModifiers.forEach(function(_ref) {
        var name = _ref.name, _ref$options = _ref.options, options2 = _ref$options === void 0 ? {} : _ref$options, effect3 = _ref.effect;
        if (typeof effect3 === "function") {
          var cleanupFn = effect3({
            state,
            name,
            instance,
            options: options2
          });
          var noopFn = function noopFn2() {
          };
          effectCleanupFns.push(cleanupFn || noopFn);
        }
      });
    }
    function cleanupModifierEffects() {
      effectCleanupFns.forEach(function(fn2) {
        return fn2();
      });
      effectCleanupFns = [];
    }
    return instance;
  };
}
var DEFAULT_OPTIONS;
var init_createPopper = __esm({
  "../node_modules/@popperjs/core/lib/createPopper.js"() {
    init_getCompositeRect();
    init_getLayoutRect();
    init_listScrollParents();
    init_getOffsetParent();
    init_orderModifiers();
    init_debounce();
    init_mergeByName();
    init_instanceOf();
    DEFAULT_OPTIONS = {
      placement: "bottom",
      modifiers: [],
      strategy: "absolute"
    };
  }
});

// ../node_modules/@popperjs/core/lib/index.js
var init_lib = __esm({
  "../node_modules/@popperjs/core/lib/index.js"() {
    init_enums();
    init_modifiers();
    init_createPopper();
  }
});

// ../node_modules/solid-react-transition/dist/esm/index.js
function nextFrame(fn2) {
  requestAnimationFrame(() => {
    requestAnimationFrame(fn2);
  });
}
function noop() {
}
var TransitionGroupContext, TransitionGroupContext$1, UNMOUNTED, EXITED, ENTERING, ENTERED, EXITING, defaultProps, Transition2;
var init_esm = __esm({
  "../node_modules/solid-react-transition/dist/esm/index.js"() {
    init_web();
    init_solid();
    TransitionGroupContext = createContext(null);
    TransitionGroupContext$1 = TransitionGroupContext;
    UNMOUNTED = "unmounted";
    EXITED = "exited";
    ENTERING = "entering";
    ENTERED = "entered";
    EXITING = "exiting";
    defaultProps = {
      in: false,
      mountOnEnter: false,
      unmountOnExit: false,
      appear: false,
      enter: true,
      exit: true,
      onEnter: noop,
      onEntering: noop,
      onEntered: noop,
      onExit: noop,
      onExiting: noop,
      onExited: noop
    };
    Transition2 = (p) => {
      const [local, childProps] = splitProps(mergeProps(defaultProps, p), ["in", "children", "mountOnEnter", "unmountOnExit", "appear", "enter", "exit", "timeout", "addEndListener", "onEnter", "onEntering", "onEntered", "onExit", "onExiting", "onExited", "nodeRef"]);
      let context2 = useContext(TransitionGroupContext$1);
      let childRef;
      let appear = context2 && !context2.isMounting ? local.enter : local.appear;
      let initialStatus;
      let appearStatus = null;
      if (local.in) {
        if (appear) {
          initialStatus = EXITED;
          appearStatus = ENTERING;
        } else {
          initialStatus = ENTERED;
        }
      } else {
        if (local.unmountOnExit || local.mountOnEnter) {
          initialStatus = UNMOUNTED;
        } else {
          initialStatus = EXITED;
        }
      }
      const [status, setStatus] = createSignal(initialStatus);
      let nextCallback = null;
      const [mounted, setMounted] = createSignal(false);
      const notUnmounted = createMemo(() => status() !== UNMOUNTED);
      onMount(() => {
        updateStatus(true, appearStatus);
        setMounted(true);
      });
      const inMemo = createMemo(() => local.in);
      createComputed(on(inMemo, () => {
        if (!mounted()) return;
        const prevStatus = status();
        if (inMemo() && prevStatus === UNMOUNTED) {
          setStatus(EXITED);
        }
        let nextStatus = null;
        if (inMemo()) {
          if (prevStatus !== ENTERING && prevStatus !== ENTERED) {
            nextStatus = ENTERING;
          }
        } else {
          if (prevStatus === ENTERING || prevStatus === ENTERED) {
            nextStatus = EXITING;
          }
        }
        updateStatus(false, nextStatus ?? EXITED);
      }));
      onCleanup(() => {
        cancelNextCallback();
      });
      function getTimeouts() {
        const {
          timeout
        } = local;
        let exit, enter, appear2;
        if (typeof timeout === "number") {
          exit = enter = appear2 = timeout;
        } else if (timeout != null) {
          exit = timeout.exit;
          enter = timeout.enter;
          appear2 = timeout.appear !== void 0 ? timeout.appear : enter;
        }
        return {
          exit,
          enter,
          appear: appear2
        };
      }
      function updateStatus(mounting = false, nextStatus) {
        if (nextStatus !== null) {
          cancelNextCallback();
          if (nextStatus === ENTERING) {
            performEnter(mounting);
          } else {
            performExit();
          }
        } else if (local.unmountOnExit && status() === EXITED) {
          setStatus(UNMOUNTED);
        }
      }
      function performEnter(mounting) {
        const {
          enter
        } = local;
        const appearing = context2 ? context2.isMounting : mounting;
        const [maybeNode, maybeAppearing] = local.nodeRef ? [appearing] : [childRef, appearing];
        const timeouts = getTimeouts();
        const enterTimeout = appearing ? timeouts.appear : timeouts.enter;
        if (!mounting && !enter) {
          safeSetState(ENTERED, () => {
            local.onEntered(maybeNode);
          });
          return;
        }
        local.onEnter(maybeNode, maybeAppearing);
        nextFrame(() => safeSetState(ENTERING, () => {
          local.onEntering(maybeNode, maybeAppearing);
          onTransitionEnd(enterTimeout, () => {
            safeSetState(ENTERED, () => {
              local.onEntered(maybeNode, maybeAppearing);
            });
          });
        }));
      }
      function performExit() {
        const {
          exit
        } = local;
        const timeouts = getTimeouts();
        const maybeNode = local.nodeRef ? void 0 : childRef;
        if (!exit) {
          safeSetState(EXITED, () => {
            local.onExited(maybeNode);
          });
          return;
        }
        local.onExit(maybeNode);
        nextFrame(() => safeSetState(EXITING, () => {
          local.onExiting(maybeNode);
          onTransitionEnd(timeouts.exit, () => {
            safeSetState(EXITED, () => {
              local.onExited(maybeNode);
            });
            if (local.unmountOnExit) {
              nextFrame(() => {
                setStatus(UNMOUNTED);
              });
            }
          });
        }));
      }
      function cancelNextCallback() {
        if (nextCallback !== null) {
          nextCallback?.cancel();
          nextCallback = null;
        }
      }
      function safeSetState(nextState, callback) {
        callback = setNextCallback(callback);
        setStatus(nextState);
        callback();
      }
      function setNextCallback(callback) {
        let active = true;
        nextCallback = (...args) => {
          if (active) {
            active = false;
            nextCallback = null;
            callback(...args);
          }
        };
        nextCallback.cancel = () => {
          active = false;
        };
        return nextCallback;
      }
      function onTransitionEnd(timeout, handler) {
        setNextCallback(handler);
        const node = local.nodeRef ? local.nodeRef : childRef;
        const doesNotHaveTimeoutOrListener = timeout == null && !local.addEndListener;
        if (!node || doesNotHaveTimeoutOrListener) {
          nextCallback && setTimeout(nextCallback, 0);
          return;
        }
        if (local.addEndListener) {
          const [maybeNode, maybeNextCallback] = local.nodeRef ? [nextCallback] : [node, nextCallback];
          local.addEndListener(maybeNode, maybeNextCallback);
        }
        if (timeout != null && nextCallback) {
          setTimeout(nextCallback, timeout);
        }
      }
      let resolvedChildren;
      function renderChild() {
        if (!resolvedChildren) resolvedChildren = children(() => local.children);
        const c = resolvedChildren();
        return typeof c === "function" ? c(status(), childProps) : c;
      }
      return createComponent(TransitionGroupContext$1.Provider, {
        value: null,
        get children() {
          return createComponent(Show, {
            get when() {
              return notUnmounted();
            },
            get children() {
              return renderChild();
            }
          });
        }
      });
    };
  }
});

// ../node_modules/solid-bootstrap-core/dist/esm/index.js
function callEventHandler(h, e) {
  let isPropagationStopped = false;
  const defaultFn = e.stopPropagation;
  e.stopPropagation = () => {
    isPropagationStopped = true;
    defaultFn();
  };
  if (typeof h === "function") {
    h(e);
  } else if (Array.isArray(h)) {
    h[0](h[1], e);
  }
  e.stopPropagation = defaultFn;
  return {
    isPropagationStopped
  };
}
function resolveClasses(el, prev, now) {
  const p = prev ? prev.split(" ") : [];
  const n = now ? now.split(" ") : [];
  el.classList?.remove(...p.filter((s) => n.indexOf(s) === -1));
  el.classList?.add(...n.filter((s) => p.indexOf(s) === -1));
}
function isTrivialHref$1(href) {
  return !href || href.trim() === "#";
}
function useButtonProps(o) {
  const options = mergeProps(defaultOptions, o);
  const tagName = createMemo(() => {
    if (!options.tagName) {
      if (options.href != null || options.target != null || options.rel != null) {
        return "a";
      } else {
        return "button";
      }
    }
    return options.tagName;
  });
  const meta = {
    get tagName() {
      return tagName();
    }
  };
  if (tagName() === "button") {
    return [{
      get type() {
        return options.type || "button";
      },
      get disabled() {
        return options.disabled;
      }
    }, meta];
  }
  const getClickHandler = createMemo(() => (event) => {
    if (options.disabled || tagName() === "a" && isTrivialHref$1(options.href)) {
      event.preventDefault();
    }
    if (options.disabled) {
      event.stopPropagation();
      return;
    }
    callEventHandler(options.onClick, event);
  });
  const getKeyDownHandler = createMemo(() => (event) => {
    if (event.key === " ") {
      event.preventDefault();
      getClickHandler()(
        event
        /*HACK calling click handler with keyboard event*/
      );
    }
  });
  const getHref = () => {
    if (tagName() === "a") {
      return options.disabled ? void 0 : options.href || "#";
    }
    return options.href;
  };
  return [{
    role: "button",
    // explicitly undefined so that it overrides the props disabled in a spread
    // e.g. <Tag {...props} {...hookProps} />
    disabled: void 0,
    get tabIndex() {
      return options.disabled ? void 0 : options.tabIndex;
    },
    get href() {
      return getHref();
    },
    get target() {
      return tagName() === "a" ? options.target : void 0;
    },
    get "aria-disabled"() {
      return !options.disabled ? void 0 : options.disabled;
    },
    get rel() {
      return tagName() === "a" ? options.rel : void 0;
    },
    get onClick() {
      return getClickHandler();
    },
    get onKeyDown() {
      return getKeyDownHandler();
    }
  }, meta];
}
function isTrivialHref(href) {
  return !href || href.trim() === "#";
}
function qsa(element, selector) {
  return toArray(element.querySelectorAll(selector));
}
function addEventListener2(node, eventName, handler, options) {
  if (options && typeof options !== "boolean" && !onceSupported) {
    var once = options.once, capture = options.capture;
    var wrappedHandler = handler;
    if (!onceSupported && once) {
      wrappedHandler = handler.__once || function onceHandler(event) {
        this.removeEventListener(eventName, onceHandler, capture);
        handler.call(this, event);
      };
      handler.__once = wrappedHandler;
    }
    node.addEventListener(eventName, wrappedHandler, optionsSupported ? options : capture);
  }
  node.addEventListener(eventName, handler, options);
}
function wrap$1(value, name) {
  let p = value[$PROXY];
  if (!p) {
    Object.defineProperty(value, $PROXY, {
      value: p = new Proxy(value, proxyTraps$1)
    });
    if (!Array.isArray(value)) {
      const keys = Object.keys(value), desc = Object.getOwnPropertyDescriptors(value);
      for (let i = 0, l = keys.length; i < l; i++) {
        const prop = keys[i];
        if (desc[prop].get) {
          const get = desc[prop].get.bind(p);
          Object.defineProperty(value, prop, {
            enumerable: desc[prop].enumerable,
            get
          });
        }
      }
    }
  }
  return p;
}
function isWrappable(obj) {
  let proto;
  return obj != null && typeof obj === "object" && (obj[$PROXY] || !(proto = Object.getPrototypeOf(obj)) || proto === Object.prototype || Array.isArray(obj));
}
function unwrap(item, set = /* @__PURE__ */ new Set()) {
  let result, unwrapped, v, prop;
  if (result = item != null && item[$RAW]) return result;
  if (!isWrappable(item) || set.has(item)) return item;
  if (Array.isArray(item)) {
    if (Object.isFrozen(item)) item = item.slice(0);
    else set.add(item);
    for (let i = 0, l = item.length; i < l; i++) {
      v = item[i];
      if ((unwrapped = unwrap(v, set)) !== v) item[i] = unwrapped;
    }
  } else {
    if (Object.isFrozen(item)) item = Object.assign({}, item);
    else set.add(item);
    const keys = Object.keys(item), desc = Object.getOwnPropertyDescriptors(item);
    for (let i = 0, l = keys.length; i < l; i++) {
      prop = keys[i];
      if (desc[prop].get) continue;
      v = item[prop];
      if ((unwrapped = unwrap(v, set)) !== v) item[prop] = unwrapped;
    }
  }
  return item;
}
function getDataNodes(target) {
  let nodes = target[$NODE];
  if (!nodes) Object.defineProperty(target, $NODE, {
    value: nodes = {}
  });
  return nodes;
}
function getDataNode(nodes, property, value) {
  return nodes[property] || (nodes[property] = createDataNode(value));
}
function proxyDescriptor$1(target, property) {
  const desc = Reflect.getOwnPropertyDescriptor(target, property);
  if (!desc || desc.get || !desc.configurable || property === $PROXY || property === $NODE || property === $NAME) return desc;
  delete desc.value;
  delete desc.writable;
  desc.get = () => target[$PROXY][property];
  return desc;
}
function trackSelf(target) {
  if (getListener()) {
    const nodes = getDataNodes(target);
    (nodes._ || (nodes._ = createDataNode()))();
  }
}
function ownKeys(target) {
  trackSelf(target);
  return Reflect.ownKeys(target);
}
function createDataNode(value) {
  const [s, set] = createSignal(value, {
    equals: false,
    internal: true
  });
  s.$ = set;
  return s;
}
function setProperty(state, property, value, deleting = false) {
  if (!deleting && state[property] === value) return;
  const prev = state[property], len = state.length;
  if (value === void 0) delete state[property];
  else state[property] = value;
  let nodes = getDataNodes(state), node;
  if (node = getDataNode(nodes, property, prev)) node.$(() => value);
  if (Array.isArray(state) && state.length !== len) (node = getDataNode(nodes, "length", len)) && node.$(state.length);
  (node = nodes._) && node.$();
}
function mergeStoreNode(state, value) {
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    setProperty(state, key, value[key]);
  }
}
function updateArray(current, next) {
  if (typeof next === "function") next = next(current);
  next = unwrap(next);
  if (Array.isArray(next)) {
    if (current === next) return;
    let i = 0, len = next.length;
    for (; i < len; i++) {
      const value = next[i];
      if (current[i] !== value) setProperty(current, i, value);
    }
    setProperty(current, "length", len);
  } else mergeStoreNode(current, next);
}
function updatePath(current, path, traversed = []) {
  let part, prev = current;
  if (path.length > 1) {
    part = path.shift();
    const partType = typeof part, isArray = Array.isArray(current);
    if (Array.isArray(part)) {
      for (let i = 0; i < part.length; i++) {
        updatePath(current, [part[i]].concat(path), traversed);
      }
      return;
    } else if (isArray && partType === "function") {
      for (let i = 0; i < current.length; i++) {
        if (part(current[i], i)) updatePath(current, [i].concat(path), traversed);
      }
      return;
    } else if (isArray && partType === "object") {
      const {
        from = 0,
        to = current.length - 1,
        by = 1
      } = part;
      for (let i = from; i <= to; i += by) {
        updatePath(current, [i].concat(path), traversed);
      }
      return;
    } else if (path.length > 1) {
      updatePath(current[part], path, [part].concat(traversed));
      return;
    }
    prev = current[part];
    traversed = [part].concat(traversed);
  }
  let value = path[0];
  if (typeof value === "function") {
    value = value(prev, traversed);
    if (value === prev) return;
  }
  if (part === void 0 && value == void 0) return;
  value = unwrap(value);
  if (part === void 0 || isWrappable(prev) && isWrappable(value) && !Array.isArray(value)) {
    mergeStoreNode(prev, value);
  } else setProperty(current, part, value);
}
function createStore(...[store, options]) {
  const unwrappedStore = unwrap(store || {});
  const isArray = Array.isArray(unwrappedStore);
  const wrappedStore = wrap$1(unwrappedStore);
  function setStore(...args) {
    batch(() => {
      isArray && args.length === 1 ? updateArray(unwrappedStore, args[0]) : updatePath(unwrappedStore, args);
    });
  }
  return [wrappedStore, setStore];
}
function applyState(target, parent, property, merge, key) {
  const previous = parent[property];
  if (target === previous) return;
  if (!isWrappable(target) || !isWrappable(previous) || key && target[key] !== previous[key]) {
    if (target !== previous) {
      if (property === $ROOT) return target;
      setProperty(parent, property, target);
    }
    return;
  }
  if (Array.isArray(target)) {
    if (target.length && previous.length && (!merge || key && target[0][key] != null)) {
      let i, j, start2, end2, newEnd, item, newIndicesNext, keyVal;
      for (start2 = 0, end2 = Math.min(previous.length, target.length); start2 < end2 && (previous[start2] === target[start2] || key && previous[start2][key] === target[start2][key]); start2++) {
        applyState(target[start2], previous, start2, merge, key);
      }
      const temp = new Array(target.length), newIndices = /* @__PURE__ */ new Map();
      for (end2 = previous.length - 1, newEnd = target.length - 1; end2 >= start2 && newEnd >= start2 && (previous[end2] === target[newEnd] || key && previous[end2][key] === target[newEnd][key]); end2--, newEnd--) {
        temp[newEnd] = previous[end2];
      }
      if (start2 > newEnd || start2 > end2) {
        for (j = start2; j <= newEnd; j++) setProperty(previous, j, target[j]);
        for (; j < target.length; j++) {
          setProperty(previous, j, temp[j]);
          applyState(target[j], previous, j, merge, key);
        }
        if (previous.length > target.length) setProperty(previous, "length", target.length);
        return;
      }
      newIndicesNext = new Array(newEnd + 1);
      for (j = newEnd; j >= start2; j--) {
        item = target[j];
        keyVal = key ? item[key] : item;
        i = newIndices.get(keyVal);
        newIndicesNext[j] = i === void 0 ? -1 : i;
        newIndices.set(keyVal, j);
      }
      for (i = start2; i <= end2; i++) {
        item = previous[i];
        keyVal = key ? item[key] : item;
        j = newIndices.get(keyVal);
        if (j !== void 0 && j !== -1) {
          temp[j] = previous[i];
          j = newIndicesNext[j];
          newIndices.set(keyVal, j);
        }
      }
      for (j = start2; j < target.length; j++) {
        if (j in temp) {
          setProperty(previous, j, temp[j]);
          applyState(target[j], previous, j, merge, key);
        } else setProperty(previous, j, target[j]);
      }
    } else {
      for (let i = 0, len = target.length; i < len; i++) {
        applyState(target[i], previous, i, merge, key);
      }
    }
    if (previous.length > target.length) setProperty(previous, "length", target.length);
    return;
  }
  const targetKeys = Object.keys(target);
  for (let i = 0, len = targetKeys.length; i < len; i++) {
    applyState(target[targetKeys[i]], previous, targetKeys[i], merge, key);
  }
  const previousKeys = Object.keys(previous);
  for (let i = 0, len = previousKeys.length; i < len; i++) {
    if (target[previousKeys[i]] === void 0) setProperty(previous, previousKeys[i], void 0);
  }
}
function reconcile(value, options = {}) {
  const {
    merge,
    key = "id"
  } = options, v = unwrap(value);
  return (state) => {
    if (!isWrappable(state) || !isWrappable(v)) return v;
    const res = applyState(v, {
      [$ROOT]: state
    }, $ROOT, merge, key);
    return res === void 0 ? state : res;
  };
}
function usePopper(referenceElement, popperElement, options) {
  const [popperInstance, setPopperInstance] = createSignal();
  const enabled = createMemo(() => options.enabled ?? true);
  const update = createMemo(on(popperInstance, (popper2) => () => {
    popper2?.update();
  }));
  const forceUpdate = createMemo(on(popperInstance, (popper2) => () => {
    popper2?.forceUpdate();
  }));
  const [popperState, setPopperState] = createStore({
    placement: options.placement ?? "bottom",
    get update() {
      return update();
    },
    get forceUpdate() {
      return forceUpdate();
    },
    attributes: {},
    styles: {
      popper: {},
      arrow: {}
    }
  });
  const updateModifier = {
    name: "updateStateModifier",
    enabled: true,
    phase: "write",
    requires: ["computeStyles"],
    fn: ({
      state
    }) => {
      const styles = {};
      const attributes = {};
      Object.keys(state.elements).forEach((element) => {
        styles[element] = state.styles[element];
        attributes[element] = state.attributes[element];
      });
      setPopperState(reconcile({
        ...popperState,
        state,
        styles,
        attributes,
        placement: state.placement
      }, {
        merge: true
      }));
    }
  };
  createEffect(() => {
    const instance = popperInstance();
    if (!instance || !enabled()) return;
    instance.setOptions({
      onFirstUpdate: options.onFirstUpdate,
      placement: options.placement ?? "bottom",
      modifiers: [...options.modifiers ?? EMPTY_MODIFIERS, ariaDescribedByModifier, updateModifier, disabledApplyStylesModifier],
      strategy: options.strategy ?? "absolute"
    });
    queueMicrotask(() => {
      update()();
    });
  });
  createEffect(() => {
    const target = referenceElement();
    const popper2 = popperElement();
    if (target && popper2 && enabled()) {
      let instance;
      instance = createPopper2(target, popper2, {});
      setPopperInstance(instance);
    } else {
      if (popperInstance()) {
        popperInstance().destroy();
        setPopperInstance(void 0);
        setPopperState(reconcile({
          ...popperState,
          attributes: {},
          styles: {
            popper: {}
          }
        }, {
          merge: true
        }));
      }
    }
  });
  return () => popperState;
}
function contains2(context2, node) {
  if (context2.contains) return context2.contains(node);
  if (context2.compareDocumentPosition) return context2 === node || !!(context2.compareDocumentPosition(node) & 16);
}
function removeEventListener(node, eventName, handler, options) {
  var capture = options && typeof options !== "boolean" ? options.capture : options;
  node.removeEventListener(eventName, handler, capture);
  if (handler.__once) {
    node.removeEventListener(eventName, handler.__once, capture);
  }
}
function listen(node, eventName, handler, options) {
  addEventListener2(node, eventName, handler, options);
  return function() {
    removeEventListener(node, eventName, handler, options);
  };
}
function ownerDocument(node) {
  return node && node.ownerDocument || document;
}
function isLeftClickEvent(event) {
  return event.button === 0;
}
function isModifiedEvent(event) {
  return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}
function useClickOutside(ref, onClickOutside = noop$4, {
  disabled,
  clickTrigger = "click"
} = {}) {
  const [preventMouseClickOutsideRef, setPreventMouseClickOutsideRef] = createSignal(false);
  const handleMouseCapture = (e) => {
    const currentTarget = getRefTarget(ref());
    setPreventMouseClickOutsideRef(!currentTarget || isModifiedEvent(e) || !isLeftClickEvent(e) || !!contains2(currentTarget, e.target));
  };
  const handleMouse = (e) => {
    if (!preventMouseClickOutsideRef()) {
      onClickOutside(e);
    }
  };
  createEffect(() => {
    if (disabled || ref() == null) return void 0;
    const doc = ownerDocument(getRefTarget(ref()));
    let currentEvent = (doc.defaultView || window).event;
    const removeMouseCaptureListener = listen(doc, clickTrigger, handleMouseCapture, true);
    const removeMouseListener = listen(doc, clickTrigger, (e) => {
      if (e === currentEvent) {
        currentEvent = void 0;
        return;
      }
      handleMouse(e);
    });
    let mobileSafariHackListeners = [];
    if ("ontouchstart" in doc.documentElement) {
      mobileSafariHackListeners = [].slice.call(doc.body.children).map((el) => listen(el, "mousemove", noop$4));
    }
    onCleanup(() => {
      removeMouseCaptureListener();
      removeMouseListener();
      mobileSafariHackListeners.forEach((remove) => remove());
    });
  });
}
function toModifierMap(modifiers) {
  const result = {};
  if (!Array.isArray(modifiers)) {
    return modifiers || result;
  }
  modifiers?.forEach((m) => {
    result[m.name] = m;
  });
  return result;
}
function toModifierArray(map = {}) {
  if (Array.isArray(map)) return map;
  return Object.keys(map).map((k) => {
    map[k].name = k;
    return map[k];
  });
}
function mergeOptionsWithPopperConfig({
  enabled,
  enableEvents,
  placement,
  flip: flip2,
  offset: offset2,
  fixed,
  containerPadding,
  arrowElement,
  popperConfig = {}
}) {
  const modifiers = toModifierMap(popperConfig.modifiers);
  return {
    ...popperConfig,
    placement,
    enabled,
    strategy: fixed ? "fixed" : popperConfig.strategy,
    modifiers: toModifierArray({
      ...modifiers,
      eventListeners: {
        enabled: enableEvents
      },
      preventOverflow: {
        ...modifiers.preventOverflow,
        options: containerPadding ? {
          padding: containerPadding,
          ...modifiers.preventOverflow?.options
        } : modifiers.preventOverflow?.options
      },
      offset: {
        options: {
          offset: offset2,
          ...modifiers.offset?.options
        }
      },
      arrow: {
        ...modifiers.arrow,
        enabled: !!arrowElement,
        options: {
          ...modifiers.arrow?.options,
          element: arrowElement
        }
      },
      flip: {
        enabled: !!flip2,
        ...modifiers.flip
      }
    })
  };
}
function useDropdownMenu(o = {}) {
  const context2 = useContext(DropdownContext$1);
  const [arrowElement, attachArrowRef] = createSignal();
  const [hasShownRef, setHasShownRef] = createSignal(false);
  const [popperOptions, setPopperOptions] = createStore({});
  const options = mergeProps({
    fixed: false,
    popperConfig: {},
    usePopper: !!context2
  }, o);
  const show = createMemo(() => {
    return context2?.show == null ? !!options.show : context2.show;
  });
  createEffect(() => {
    if (show() && !hasShownRef()) {
      setHasShownRef(true);
    }
  });
  createComputed(() => {
    setPopperOptions(reconcile(mergeOptionsWithPopperConfig({
      placement: options.placement || context2?.placement || "bottom-start",
      enabled: options.usePopper ?? !!context2,
      enableEvents: options.enableEventListeners == null ? show() : options.enableEventListeners,
      offset: options.offset,
      flip: options.flip,
      fixed: options.fixed,
      arrowElement: arrowElement(),
      popperConfig: options.popperConfig
    })));
  });
  const handleClose = (e) => {
    context2?.toggle(false, e);
  };
  const popper2 = usePopper(() => context2?.toggleElement, () => context2?.menuElement, popperOptions);
  createEffect(() => {
    if (context2?.menuElement) {
      useClickOutside(() => context2.menuElement, handleClose, {
        get clickTrigger() {
          return options.rootCloseEvent;
        },
        get disabled() {
          return !show();
        }
      });
    }
  });
  const menuProps = mergeProps({
    get ref() {
      return context2?.setMenu || noop$3;
    },
    get style() {
      return popper2()?.styles.popper;
    },
    get "aria-labelledby"() {
      return context2?.toggleElement?.id;
    }
  }, popper2()?.attributes.popper ?? {});
  const metadata = {
    get show() {
      return show();
    },
    get placement() {
      return context2?.placement;
    },
    get hasShown() {
      return hasShownRef();
    },
    get toggle() {
      return context2?.toggle;
    },
    get popper() {
      return options.usePopper ? popper2() : null;
    },
    get arrowProps() {
      return options.usePopper ? {
        ref: attachArrowRef,
        ...popper2()?.attributes.arrow,
        style: popper2()?.styles.arrow
      } : {};
    }
  };
  return [menuProps, metadata];
}
function DropdownMenu(p) {
  const [local, options] = splitProps(p, ["children"]);
  const [props, meta] = useDropdownMenu(options);
  return memo(() => local.children(props, meta));
}
function useSSRSafeId(defaultId) {
  return defaultId || `solid-aria-${++currentId}`;
}
function useDropdownToggle() {
  const id = useSSRSafeId();
  const context2 = useContext(DropdownContext$1);
  const handleClick = (e) => {
    context2.toggle(!context2.show, e);
  };
  return [{
    id,
    get ref() {
      return context2.setToggle || noop$2;
    },
    onClick: handleClick,
    get "aria-expanded"() {
      return !!context2.show;
    },
    get "aria-haspopup"() {
      return context2.menuElement && isRoleMenu(context2.menuElement) ? true : void 0;
    }
  }, {
    get show() {
      return context2.show;
    },
    get toggle() {
      return context2.toggle;
    }
  }];
}
function DropdownToggle({
  children: children2
}) {
  const [props, meta] = useDropdownToggle();
  return memo(() => children2(props, meta));
}
function dataAttr(property) {
  return `${ATTRIBUTE_PREFIX}${property}`;
}
function dataProp(property) {
  return `${PROPERTY_PREFIX}${property}`;
}
function useDropdownItem(options) {
  const onSelectCtx = useContext(SelectableContext$1);
  const navContext = useContext(NavContext$1);
  const {
    activeKey
  } = navContext || {};
  const eventKey = makeEventKey(options.key, options.href);
  const isActive = createMemo(() => options.active == null && options.key != null ? makeEventKey(activeKey) === eventKey : options.active);
  const handleClick = (event) => {
    if (options.disabled) return;
    let result = callEventHandler(options.onClick, event);
    if (onSelectCtx && !result.isPropagationStopped) {
      onSelectCtx(eventKey, event);
    }
  };
  return [{
    onClick: handleClick,
    get "aria-disabled"() {
      return options.disabled || void 0;
    },
    get "aria-selected"() {
      return isActive();
    },
    [dataAttr("dropdown-item")]: ""
  }, {
    get isActive() {
      return isActive();
    }
  }];
}
function useWindow() {
  return useContext(Context);
}
function createControlledProp(propValue, defaultValue, handler) {
  const [stateValue, setState] = createSignal(defaultValue());
  const isControlled = createMemo(() => propValue() !== void 0);
  createComputed(on(isControlled, (is, was) => {
    if (!is && was && stateValue() !== defaultValue()) {
      setState(() => defaultValue());
    }
  }));
  const getValue = () => isControlled() ? propValue() : stateValue();
  const setValue = (value, ...args) => {
    if (handler) handler(value, ...args);
    setState(() => value);
  };
  return [getValue, setValue];
}
function Dropdown(p) {
  const props = mergeProps({
    itemSelector: `* [${dataAttr("dropdown-item")}]`,
    placement: "bottom-start"
  }, p);
  const window2 = useWindow();
  const [show, onToggle] = createControlledProp(() => props.show, () => props.defaultShow, props.onToggle);
  const [menuRef, setMenu] = createSignal();
  const [toggleRef, setToggle] = createSignal();
  const [lastSourceEvent, setLastSourceEvent] = createSignal(null);
  const onSelectCtx = useContext(SelectableContext$1);
  const focusInDropdown = () => menuRef()?.contains(menuRef().ownerDocument.activeElement);
  const toggle = (nextShow, event, source = event?.type) => {
    onToggle(nextShow, {
      originalEvent: event,
      source
    });
  };
  const handleSelect = (key, event) => {
    let result = callEventHandler((event2) => {
      props.onSelect?.(key, event2);
      toggle(false, event2, "select");
    }, event);
    if (!result.isPropagationStopped) {
      onSelectCtx?.(key, event);
    }
  };
  const context2 = {
    toggle,
    setMenu,
    setToggle,
    get placement() {
      return props.placement;
    },
    get show() {
      return show();
    },
    get menuElement() {
      return menuRef();
    },
    get toggleElement() {
      return toggleRef();
    }
  };
  const focusToggle = () => {
    const ref = toggleRef();
    if (ref && ref.focus) {
      ref.focus();
    }
  };
  const maybeFocusFirst = () => {
    const type = lastSourceEvent();
    setLastSourceEvent(null);
    let focusType = props.focusFirstItemOnShow;
    if (focusType == null) {
      focusType = menuRef() && isRoleMenu(menuRef()) ? "keyboard" : false;
    }
    if (focusType === false || focusType === "keyboard" && !/^key.+$/.test(type)) {
      return;
    }
    const first = qsa(menuRef(), props.itemSelector)[0];
    if (first && first.focus) first.focus();
  };
  createEffect(() => {
    if (show()) {
      maybeFocusFirst();
    } else if (focusInDropdown()) {
      focusToggle();
    }
  });
  const getNextFocusedChild = (current, offset2) => {
    if (!menuRef()) return null;
    const items = qsa(menuRef(), props.itemSelector);
    let index = items.indexOf(current) + offset2;
    index = Math.max(0, Math.min(index, items.length));
    return items[index];
  };
  const keydownHandler = (event) => {
    const {
      key
    } = event;
    const target = event.target;
    const fromMenu = menuRef()?.contains(target);
    const fromToggle = toggleRef()?.contains(target);
    const isInput = /input|textarea/i.test(target.tagName);
    if (isInput && (key === " " || key !== "Escape" && fromMenu || key === "Escape" && target.type === "search")) {
      return;
    }
    if (!fromMenu && !fromToggle) {
      return;
    }
    if (key === "Tab" && (!menuRef() || !show)) {
      return;
    }
    setLastSourceEvent(event.type);
    const meta = {
      originalEvent: event,
      source: event.type
    };
    switch (key) {
      case "ArrowUp": {
        const next = getNextFocusedChild(target, -1);
        if (next && next.focus) next.focus();
        event.preventDefault();
        return;
      }
      case "ArrowDown":
        event.preventDefault();
        if (!show) {
          onToggle(true, meta);
        } else {
          const next = getNextFocusedChild(target, 1);
          if (next && next.focus) next.focus();
        }
        return;
      case "Tab":
        if (!isServer) {
          addEventListener2(target.ownerDocument, "keyup", (e) => {
            if (e.key === "Tab" && !e.target || !menuRef()?.contains(e.target)) {
              onToggle(false, meta);
            }
          }, {
            once: true
          });
        }
        break;
      case "Escape":
        if (key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
        }
        onToggle(false, meta);
        focusToggle();
        break;
    }
  };
  if (!isServer) {
    window2.document.addEventListener("keydown", keydownHandler);
    onCleanup(() => window2.document.removeEventListener("keydown", keydownHandler));
  }
  return createComponent(SelectableContext$1.Provider, {
    value: handleSelect,
    get children() {
      return createComponent(DropdownContext$1.Provider, {
        value: context2,
        get children() {
          return props.children;
        }
      });
    }
  });
}
function activeElement(doc) {
  if (doc === void 0) {
    doc = ownerDocument();
  }
  try {
    var active = doc.activeElement;
    if (!active || !active.nodeName) return null;
    return active;
  } catch (e) {
    return doc.body;
  }
}
function ownerWindow(node) {
  var doc = ownerDocument(node);
  return doc && doc.defaultView || window;
}
function getComputedStyle3(node, psuedoElement) {
  return ownerWindow(node).getComputedStyle(node, psuedoElement);
}
function hyphenate(string) {
  return string.replace(rUpper, "-$1").toLowerCase();
}
function hyphenateStyleName(string) {
  return hyphenate(string).replace(msPattern, "-ms-");
}
function isTransform(value) {
  return !!(value && supportedTransforms.test(value));
}
function style2(node, property) {
  var css = "";
  var transforms = "";
  if (typeof property === "string") {
    return node.style.getPropertyValue(hyphenateStyleName(property)) || getComputedStyle3(node).getPropertyValue(hyphenateStyleName(property));
  }
  Object.keys(property).forEach(function(key) {
    var value = property[key];
    if (!value && value !== 0) {
      node.style.removeProperty(hyphenateStyleName(key));
    } else if (isTransform(key)) {
      transforms += key + "(" + value + ") ";
    } else {
      css += hyphenateStyleName(key) + ": " + value + ";";
    }
  });
  if (transforms) {
    css += "transform: " + transforms + ";";
  }
  node.style.cssText += ";" + css;
}
function getBodyScrollbarWidth(ownerDocument3 = document) {
  const window2 = ownerDocument3.defaultView;
  return Math.abs(window2.innerWidth - ownerDocument3.documentElement.clientWidth);
}
function useWaitForDOMRef(props) {
  const window2 = useWindow();
  const [resolvedRef, setRef] = createSignal(resolveContainerRef(props.ref, window2?.document));
  createEffect(() => {
    if (props.onResolved && resolvedRef()) {
      props.onResolved(resolvedRef());
    }
  });
  createEffect(() => {
    const nextRef = resolveContainerRef(props.ref);
    if (nextRef !== resolvedRef()) {
      setRef(nextRef);
    }
  });
  return resolvedRef;
}
function getManager(window2) {
  if (!manager) manager = new ModalManager$1({
    ownerDocument: window2?.document
  });
  return manager;
}
function useModalManager(provided) {
  const window2 = useWindow();
  const modalManager = provided || getManager(window2);
  const modal = {
    dialog: null,
    backdrop: null
  };
  return Object.assign(modal, {
    add: () => modalManager.add(modal),
    remove: () => modalManager.remove(modal),
    isTopModal: () => modalManager.isTopModal(modal),
    setDialogRef: (ref) => {
      modal.dialog = ref;
    },
    setBackdropRef: (ref) => {
      modal.backdrop = ref;
    }
  });
}
function useNavItem(options) {
  const parentOnSelect = useContext(SelectableContext$1);
  const navContext = useContext(NavContext$1);
  const tabContext = useContext(TabContext$1);
  const isActive = createMemo(() => options.active == null && options.key != null ? navContext?.activeKey === options.key : options.active);
  const role = createMemo(() => navContext && !options.role && navContext.role === "tablist" ? "tab" : options.role);
  const onClick = createMemo(() => (e) => {
    if (options.disabled) return;
    let result = callEventHandler(options.onClick, e);
    if (options.key == null) {
      return;
    }
    if (parentOnSelect && !result.isPropagationStopped) {
      parentOnSelect(options.key, e);
    }
  });
  const props = {
    get role() {
      return role();
    },
    get [dataAttr("event-key")]() {
      return navContext ? options.key : void 0;
    },
    get id() {
      return navContext ? navContext.getControllerId(options.key) : void 0;
    },
    get tabIndex() {
      return role() === "tab" && (options.disabled || !isActive()) ? -1 : void 0;
    },
    get ["aria-controls"]() {
      return isActive() || !tabContext?.unmountOnExit && !tabContext?.mountOnEnter ? navContext ? navContext.getControlledId(options.key) : void 0 : void 0;
    },
    get ["aria-disabled"]() {
      return role() === "tab" && options.disabled ? true : void 0;
    },
    get ["aria-selected"]() {
      return role() === "tab" && isActive() ? true : void 0;
    },
    get onClick() {
      return onClick();
    }
  };
  const meta = {
    get isActive() {
      return isActive();
    }
  };
  return [props, meta];
}
function useTabPanel(p) {
  const [local, props] = splitProps(mergeProps(defaultProps2, p), ["active", "eventKey", "mountOnEnter", "transition", "unmountOnExit"]);
  const context2 = useContext(TabContext$1);
  if (!context2) return [props, {
    get eventKey() {
      return local.eventKey;
    },
    get isActive() {
      return local.active;
    },
    get mountOnEnter() {
      return local.mountOnEnter;
    },
    get transition() {
      return local.transition;
    },
    get unmountOnExit() {
      return local.unmountOnExit;
    }
  }];
  const key = makeEventKey(local.eventKey);
  const useTabPanel2 = mergeProps(props, {
    get id() {
      return context2?.getControlledId(local.eventKey);
    },
    get "aria-labelledby"() {
      return context2?.getControllerId(local.eventKey);
    }
  });
  return [useTabPanel2, {
    get eventKey() {
      return local.eventKey;
    },
    get isActive() {
      return local.active == null && key != null ? makeEventKey(context2?.activeKey) === key : local.active;
    },
    get transition() {
      return local.transition || context2?.transition || NoopTransition$1;
    },
    get mountOnEnter() {
      return local.mountOnEnter != null ? local.mountOnEnter : context2?.mountOnEnter;
    },
    get unmountOnExit() {
      return local.unmountOnExit != null ? local.unmountOnExit : context2?.unmountOnExit;
    }
  }];
}
var defaultOptions, Button, Button$1, _tmpl$$1, Anchor, Anchor$1, toArray, canUseDOM, optionsSupported, onceSupported, options, DropdownContext, DropdownContext$1, $RAW, $NODE, $NAME, proxyTraps$1, $ROOT, createPopper2, disabledApplyStylesModifier, ariaDescribedByModifier, EMPTY_MODIFIERS, noop$4, getRefTarget, noop$3, currentId, isRoleMenu, noop$2, SelectableContext, makeEventKey, SelectableContext$1, NavContext, NavContext$1, ATTRIBUTE_PREFIX, PROPERTY_PREFIX, DropdownItem, DropdownItem$1, Context, rUpper, msPattern, supportedTransforms, OPEN_DATA_ATTRIBUTE, ModalManager, ModalManager$1, resolveContainerRef, _tmpl$, manager, defaultProps$3, Modal, Modal$1, TabContext, TabContext$1, defaultProps$2, NavItem, NavItem$1, noop$1, EVENT_KEY_ATTR, defaultProps$1, Nav, Nav$1, NoopTransition, NoopTransition$1, OverlayContext, OverlayContext$1, defaultProps2, TabPanel, TabPanel$1, Tabs, Tabs$1;
var init_esm2 = __esm({
  "../node_modules/solid-bootstrap-core/dist/esm/index.js"() {
    init_web();
    init_solid();
    init_lib();
    init_esm();
    defaultOptions = {
      tabIndex: 0
    };
    Button = (props) => {
      const [local, otherProps] = splitProps(props, ["as"]);
      props.tabIndex;
      const [buttonProps, {
        tagName
      }] = useButtonProps({
        tagName: local.as,
        ...otherProps
      });
      return createComponent(Dynamic, mergeProps(otherProps, buttonProps, {
        component: tagName
      }));
    };
    Button$1 = Button;
    _tmpl$$1 = /* @__PURE__ */ template(`<a></a>`, 2);
    Anchor = (props) => {
      const [local, otherProps] = splitProps(props, ["onKeyDown"]);
      const [buttonProps] = useButtonProps(mergeProps({
        tagName: "a"
      }, otherProps));
      const handleKeyDown = (e) => {
        callEventHandler(buttonProps.onKeyDown, e);
        callEventHandler(local.onKeyDown, e);
      };
      return isTrivialHref(props.href) && !props.role || props.role === "button" ? (() => {
        const _el$ = _tmpl$$1.cloneNode(true);
        spread(_el$, mergeProps(otherProps, buttonProps, {
          "onKeyDown": handleKeyDown
        }), false, false);
        return _el$;
      })() : (() => {
        const _el$2 = _tmpl$$1.cloneNode(true);
        spread(_el$2, mergeProps(otherProps, {
          get onKeyDown() {
            return local.onKeyDown;
          }
        }), false, false);
        return _el$2;
      })();
    };
    Anchor$1 = Anchor;
    toArray = Function.prototype.bind.call(Function.prototype.call, [].slice);
    canUseDOM = !!(typeof window !== "undefined" && window.document && window.document.createElement);
    optionsSupported = false;
    onceSupported = false;
    try {
      options = {
        get passive() {
          return optionsSupported = true;
        },
        get once() {
          return onceSupported = optionsSupported = true;
        }
      };
      if (canUseDOM) {
        window.addEventListener("test", options, options);
        window.removeEventListener("test", options, true);
      }
    } catch (e) {
    }
    DropdownContext = createContext(null);
    DropdownContext$1 = DropdownContext;
    $RAW = Symbol("store-raw");
    $NODE = Symbol("store-node");
    $NAME = Symbol("store-name");
    proxyTraps$1 = {
      get(target, property, receiver) {
        if (property === $RAW) return target;
        if (property === $PROXY) return receiver;
        if (property === $TRACK) {
          trackSelf(target);
          return receiver;
        }
        const nodes = getDataNodes(target);
        const tracked = nodes.hasOwnProperty(property);
        let value = tracked ? nodes[property]() : target[property];
        if (property === $NODE || property === "__proto__") return value;
        if (!tracked) {
          const desc = Object.getOwnPropertyDescriptor(target, property);
          if (getListener() && (typeof value !== "function" || target.hasOwnProperty(property)) && !(desc && desc.get)) value = getDataNode(nodes, property, value)();
        }
        return isWrappable(value) ? wrap$1(value) : value;
      },
      has(target, property) {
        if (property === $RAW || property === $PROXY || property === $TRACK || property === $NODE || property === "__proto__") return true;
        this.get(target, property, target);
        return property in target;
      },
      set() {
        return true;
      },
      deleteProperty() {
        return true;
      },
      ownKeys,
      getOwnPropertyDescriptor: proxyDescriptor$1
    };
    $ROOT = Symbol("store-root");
    createPopper2 = popperGenerator({
      defaultModifiers: [hide_default, popperOffsets_default, computeStyles_default, eventListeners_default, offset_default, flip_default, preventOverflow_default, arrow_default]
    });
    disabledApplyStylesModifier = {
      name: "applyStyles",
      enabled: false,
      phase: "afterWrite",
      fn: () => void 0
    };
    ariaDescribedByModifier = {
      name: "ariaDescribedBy",
      enabled: true,
      phase: "afterWrite",
      effect: ({
        state
      }) => () => {
        const {
          reference: reference2,
          popper: popper2
        } = state.elements;
        if ("removeAttribute" in reference2) {
          const ids = (reference2.getAttribute("aria-describedby") || "").split(",").filter((id) => id.trim() !== popper2.id);
          if (!ids.length) reference2.removeAttribute("aria-describedby");
          else reference2.setAttribute("aria-describedby", ids.join(","));
        }
      },
      fn: ({
        state
      }) => {
        const {
          popper: popper2,
          reference: reference2
        } = state.elements;
        const role = popper2.getAttribute("role")?.toLowerCase();
        if (popper2.id && role === "tooltip" && "setAttribute" in reference2) {
          const ids = reference2.getAttribute("aria-describedby");
          if (ids && ids.split(",").indexOf(popper2.id) !== -1) {
            return;
          }
          reference2.setAttribute("aria-describedby", ids ? `${ids},${popper2.id}` : popper2.id);
        }
      }
    };
    EMPTY_MODIFIERS = [];
    noop$4 = () => {
    };
    getRefTarget = (ref) => ref;
    noop$3 = () => {
    };
    currentId = 0;
    isRoleMenu = (el) => el.getAttribute("role")?.toLowerCase() === "menu";
    noop$2 = () => {
    };
    SelectableContext = createContext(null);
    makeEventKey = (eventKey, href = null) => {
      if (eventKey != null) return String(eventKey);
      return href || null;
    };
    SelectableContext$1 = SelectableContext;
    NavContext = createContext(null);
    NavContext$1 = NavContext;
    ATTRIBUTE_PREFIX = `data-rr-ui-`;
    PROPERTY_PREFIX = `rrUi`;
    DropdownItem = (p) => {
      const [local, props] = splitProps(
        // merge in prop defaults
        mergeProps({
          as: Button$1
        }, p),
        // split off local props with rest passed to Dynamic
        ["eventKey", "disabled", "onClick", "active", "as"]
      );
      const [dropdownItemProps] = useDropdownItem({
        get key() {
          return local.eventKey;
        },
        get href() {
          return props.href;
        },
        get disabled() {
          return local.disabled;
        },
        get onClick() {
          return local.onClick;
        },
        get active() {
          return local.active;
        }
      });
      return createComponent(Dynamic, mergeProps({
        get component() {
          return local.as;
        }
      }, props, dropdownItemProps));
    };
    DropdownItem$1 = DropdownItem;
    Context = createContext(canUseDOM ? window : void 0);
    Context.Provider;
    Dropdown.Menu = DropdownMenu;
    Dropdown.Toggle = DropdownToggle;
    Dropdown.Item = DropdownItem$1;
    rUpper = /([A-Z])/g;
    msPattern = /^ms-/;
    supportedTransforms = /^((translate|rotate|scale)(X|Y|Z|3d)?|matrix(3d)?|perspective|skew(X|Y)?)$/i;
    OPEN_DATA_ATTRIBUTE = dataAttr("modal-open");
    ModalManager = class {
      constructor({
        ownerDocument: ownerDocument3,
        handleContainerOverflow = true,
        isRTL = false
      } = {}) {
        this.handleContainerOverflow = handleContainerOverflow;
        this.isRTL = isRTL;
        this.modals = [];
        this.ownerDocument = ownerDocument3;
      }
      getScrollbarWidth() {
        return getBodyScrollbarWidth(this.ownerDocument);
      }
      getElement() {
        return (this.ownerDocument || document).body;
      }
      setModalAttributes(_modal) {
      }
      removeModalAttributes(_modal) {
      }
      setContainerStyle(containerState) {
        const style$1 = {
          overflow: "hidden"
        };
        const paddingProp = this.isRTL ? "paddingLeft" : "paddingRight";
        const container = this.getElement();
        containerState.style = {
          overflow: container.style.overflow,
          [paddingProp]: container.style[paddingProp]
        };
        if (containerState.scrollBarWidth) {
          style$1[paddingProp] = `${parseInt(style2(container, paddingProp) || "0", 10) + containerState.scrollBarWidth}px`;
        }
        container.setAttribute(OPEN_DATA_ATTRIBUTE, "");
        style2(container, style$1);
      }
      reset() {
        [...this.modals].forEach((m) => this.remove(m));
      }
      removeContainerStyle(containerState) {
        const container = this.getElement();
        container.removeAttribute(OPEN_DATA_ATTRIBUTE);
        Object.assign(container.style, containerState.style);
      }
      add(modal) {
        let modalIdx = this.modals.indexOf(modal);
        if (modalIdx !== -1) {
          return modalIdx;
        }
        modalIdx = this.modals.length;
        this.modals.push(modal);
        this.setModalAttributes(modal);
        if (modalIdx !== 0) {
          return modalIdx;
        }
        this.state = {
          scrollBarWidth: this.getScrollbarWidth(),
          style: {}
        };
        if (this.handleContainerOverflow) {
          this.setContainerStyle(this.state);
        }
        return modalIdx;
      }
      remove(modal) {
        const modalIdx = this.modals.indexOf(modal);
        if (modalIdx === -1) {
          return;
        }
        this.modals.splice(modalIdx, 1);
        if (!this.modals.length && this.handleContainerOverflow) {
          this.removeContainerStyle(this.state);
        }
        this.removeModalAttributes(modal);
      }
      isTopModal(modal) {
        return !!this.modals.length && this.modals[this.modals.length - 1] === modal;
      }
    };
    ModalManager$1 = ModalManager;
    resolveContainerRef = (ref, document2) => {
      if (!canUseDOM) return null;
      if (ref == null) return (document2 || ownerDocument()).body;
      if (typeof ref === "function") ref = ref();
      if (ref?.nodeType) return ref || null;
      return null;
    };
    _tmpl$ = /* @__PURE__ */ template(`<div></div>`, 2);
    defaultProps$3 = {
      show: false,
      role: "dialog",
      backdrop: true,
      keyboard: true,
      autoFocus: true,
      enforceFocus: true,
      restoreFocus: true,
      renderBackdrop: (props) => (() => {
        const _el$ = _tmpl$.cloneNode(true);
        spread(_el$, props, false, false);
        return _el$;
      })(),
      onHide: () => {
      }
    };
    Modal = (p) => {
      const [local, props] = splitProps(
        mergeProps(defaultProps$3, p),
        // split off local props with rest passed as dialogProps
        ["show", "role", "class", "style", "children", "backdrop", "keyboard", "onBackdropClick", "onEscapeKeyDown", "transition", "backdropTransition", "autoFocus", "enforceFocus", "restoreFocus", "restoreFocusOptions", "renderDialog", "renderBackdrop", "manager", "container", "onShow", "onHide", "onExit", "onExited", "onExiting", "onEnter", "onEntering", "onEntered", "ref"]
      );
      const container = useWaitForDOMRef({
        get ref() {
          return local.container;
        }
      });
      const modal = useModalManager(local.manager);
      const owner = getOwner();
      const [isMounted, setIsMounted] = createSignal(false);
      onMount(() => setIsMounted(true));
      onCleanup(() => setIsMounted(false));
      const [exited, setExited] = createSignal(!local.show);
      let lastFocusRef = null;
      local.ref?.(modal);
      createComputed(on(() => local.show, (show, prevShow) => {
        if (canUseDOM && !prevShow && show) {
          lastFocusRef = activeElement();
        }
      }));
      createComputed(() => {
        if (!local.transition && !local.show && !exited()) {
          setExited(true);
        } else if (local.show && exited()) {
          setExited(false);
        }
      });
      const handleShow = () => {
        modal.add();
        removeKeydownListenerRef = listen(document, "keydown", handleDocumentKeyDown);
        removeFocusListenerRef = listen(
          document,
          "focus",
          // the timeout is necessary b/c this will run before the new modal is mounted
          // and so steals focus from it
          () => setTimeout(handleEnforceFocus),
          true
        );
        if (local.onShow) {
          local.onShow();
        }
        if (local.autoFocus) {
          const currentActiveElement = activeElement(document);
          if (modal.dialog && currentActiveElement && !contains2(modal.dialog, currentActiveElement)) {
            lastFocusRef = currentActiveElement;
            modal.dialog.focus();
          }
        }
      };
      const handleHide = () => {
        modal.remove();
        removeKeydownListenerRef?.();
        removeFocusListenerRef?.();
        if (local.restoreFocus) {
          lastFocusRef?.focus?.(local.restoreFocusOptions);
          lastFocusRef = null;
        }
      };
      createEffect(() => {
        if (!local.show || !container?.()) return;
        handleShow();
      });
      createEffect(on(exited, (exited2, prev) => {
        if (exited2 && !(prev ?? exited2)) {
          handleHide();
        }
      }));
      onCleanup(() => {
        handleHide();
      });
      const handleEnforceFocus = () => {
        if (!local.enforceFocus || !isMounted() || !modal.isTopModal()) {
          return;
        }
        const currentActiveElement = activeElement();
        if (modal.dialog && currentActiveElement && !contains2(modal.dialog, currentActiveElement)) {
          modal.dialog.focus();
        }
      };
      const handleBackdropClick = (e) => {
        if (e.target !== e.currentTarget) {
          return;
        }
        local.onBackdropClick?.(e);
        if (local.backdrop === true) {
          local.onHide?.();
        }
      };
      const handleDocumentKeyDown = (e) => {
        if (local.keyboard && e.keyCode === 27 && modal.isTopModal()) {
          local.onEscapeKeyDown?.(e);
          if (!e.defaultPrevented) {
            local.onHide?.();
          }
        }
      };
      let removeFocusListenerRef;
      let removeKeydownListenerRef;
      const handleHidden = (...args) => {
        setExited(true);
        local.onExited?.(...args);
      };
      const dialogVisible = createMemo(() => !!(local.show || local.transition && !exited()));
      const dialogProps = mergeProps({
        get role() {
          return local.role;
        },
        get ref() {
          return modal.setDialogRef;
        },
        // apparently only works on the dialog role element
        get "aria-modal"() {
          return local.role === "dialog" ? true : void 0;
        }
      }, props, {
        get style() {
          return local.style;
        },
        get class() {
          return local.class;
        },
        tabIndex: -1
      });
      const getChildAsDocument = () => {
        const c = children(() => local.children);
        c()?.setAttribute?.("role", "document");
        return c;
      };
      let innerDialog = () => runWithOwner(owner, () => local.renderDialog ? local.renderDialog(dialogProps) : (() => {
        const _el$2 = _tmpl$.cloneNode(true);
        spread(_el$2, dialogProps, false, true);
        insert(_el$2, getChildAsDocument);
        return _el$2;
      })());
      const Dialog = () => {
        const Transition3 = local.transition;
        return !Transition3 ? innerDialog : createComponent(Transition3, {
          appear: true,
          unmountOnExit: true,
          get ["in"]() {
            return !!local.show;
          },
          get onExit() {
            return local.onExit;
          },
          get onExiting() {
            return local.onExiting;
          },
          onExited: handleHidden,
          get onEnter() {
            return local.onEnter;
          },
          get onEntering() {
            return local.onEntering;
          },
          get onEntered() {
            return local.onEntered;
          },
          children: innerDialog
        });
      };
      const Backdrop = () => {
        let backdropElement = null;
        if (local.backdrop) {
          const BackdropTransition2 = local.backdropTransition;
          backdropElement = local.renderBackdrop({
            ref: modal.setBackdropRef,
            onClick: handleBackdropClick
          });
          if (BackdropTransition2) {
            backdropElement = createComponent(BackdropTransition2, {
              appear: true,
              get ["in"]() {
                return !!local.show;
              },
              children: backdropElement
            });
          }
        }
        return backdropElement;
      };
      return createComponent(Show, {
        get when() {
          return memo(() => !!container())() && dialogVisible();
        },
        get children() {
          return createComponent(Portal, {
            get mount() {
              return container();
            },
            get children() {
              return [createComponent(Backdrop, {}), createComponent(Dialog, {})];
            }
          });
        }
      });
    };
    Modal$1 = Object.assign(Modal, {
      Manager: ModalManager$1
    });
    TabContext = createContext(null);
    TabContext$1 = TabContext;
    defaultProps$2 = {
      as: Button$1
    };
    NavItem = (p) => {
      const [local, options] = splitProps(mergeProps(defaultProps$2, p), ["as", "active", "eventKey"]);
      const [props, meta] = useNavItem(mergeProps({
        get active() {
          return p.active;
        },
        get key() {
          return makeEventKey(p.eventKey, p.href);
        }
      }, options));
      props[dataAttr("active")] = meta.isActive;
      return createComponent(Dynamic, mergeProps({
        get component() {
          return local.as;
        }
      }, options, props));
    };
    NavItem$1 = NavItem;
    noop$1 = (e) => "";
    EVENT_KEY_ATTR = dataAttr("event-key");
    defaultProps$1 = {
      as: "div"
    };
    Nav = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$1, p), ["as", "onSelect", "activeKey", "role", "onKeyDown"]);
      const [needsRefocusRef, setNeedsRefocusRef] = createSignal(false);
      const [listNode, setListNode] = createSignal(null);
      const parentOnSelect = useContext(SelectableContext$1);
      const tabContext = useContext(TabContext$1);
      const getNextActiveTab = (offset2) => {
        const currentListNode = listNode();
        if (!currentListNode) return null;
        const items = qsa(currentListNode, `[${EVENT_KEY_ATTR}]:not([aria-disabled=true])`);
        const activeChild = currentListNode.querySelector("[aria-selected=true]");
        if (!activeChild || activeChild !== document.activeElement) return null;
        const index = items.indexOf(activeChild);
        if (index === -1) return null;
        let nextIndex = index + offset2;
        if (nextIndex >= items.length) nextIndex = 0;
        if (nextIndex < 0) nextIndex = items.length - 1;
        return items[nextIndex];
      };
      const handleSelect = (key, event) => {
        if (key == null) return;
        local.onSelect?.(key, event);
        parentOnSelect?.(key, event);
      };
      const handleKeyDown = (event) => {
        callEventHandler(local.onKeyDown, event);
        if (!tabContext) {
          return;
        }
        let nextActiveChild;
        switch (event.key) {
          case "ArrowLeft":
          case "ArrowUp":
            nextActiveChild = getNextActiveTab(-1);
            break;
          case "ArrowRight":
          case "ArrowDown":
            nextActiveChild = getNextActiveTab(1);
            break;
          default:
            return;
        }
        if (!nextActiveChild) return;
        event.preventDefault();
        handleSelect(nextActiveChild.dataset[dataProp("EventKey")] || null, event);
        setNeedsRefocusRef(true);
      };
      createEffect(() => {
        if (listNode() && needsRefocusRef()) {
          const activeChild = listNode().querySelector(`[${EVENT_KEY_ATTR}][aria-selected=true]`);
          activeChild?.focus();
        }
        setNeedsRefocusRef(false);
      });
      const mergedRef = (r) => {
        setListNode(r);
        if (typeof props.ref === "function") {
          props.ref(r);
        }
      };
      const activeKey = () => makeEventKey(tabContext?.activeKey ?? local.activeKey);
      const getRole = () => {
        return local.role || (tabContext ? "tablist" : void 0);
      };
      return createComponent(SelectableContext$1.Provider, {
        value: handleSelect,
        get children() {
          return createComponent(NavContext$1.Provider, {
            value: {
              get role() {
                return getRole();
              },
              // used by NavLink to determine it's role
              get activeKey() {
                return activeKey();
              },
              get getControlledId() {
                return tabContext?.getControlledId || noop$1;
              },
              get getControllerId() {
                return tabContext?.getControllerId || noop$1;
              }
            },
            get children() {
              return createComponent(Dynamic, mergeProps({
                get component() {
                  return local.as;
                },
                get ["data-active-key"]() {
                  return activeKey();
                }
              }, props, {
                onKeyDown: handleKeyDown,
                ref: mergedRef,
                get role() {
                  return getRole();
                }
              }));
            }
          });
        }
      });
    };
    Nav$1 = Object.assign(Nav, {
      Item: NavItem$1
    });
    NoopTransition = (props) => {
      const resolvedChildren = children(() => props.children);
      const callChild = () => {
        const c = resolvedChildren();
        return typeof c === "function" ? c(ENTERED, {}) : c;
      };
      return memo(callChild);
    };
    NoopTransition$1 = NoopTransition;
    OverlayContext = createContext();
    OverlayContext$1 = OverlayContext;
    defaultProps2 = {
      role: "tabpanel"
    };
    TabPanel = (props) => {
      const [tabPanelProps, other] = useTabPanel(props);
      other.transition;
      return createComponent(TabContext$1.Provider, {
        value: null,
        get children() {
          return createComponent(SelectableContext$1.Provider, {
            value: null,
            get children() {
              return createComponent(Dynamic, mergeProps({
                get component() {
                  return props.as ?? "div";
                }
              }, tabPanelProps, {
                role: "tabpanel",
                get hidden() {
                  return !other.isActive;
                },
                get ["aria-hidden"]() {
                  return !other.isActive;
                }
              }));
            }
          });
        }
      });
    };
    TabPanel$1 = TabPanel;
    Tabs = (props) => {
      const [activeKey, onSelect] = createControlledProp(() => props.activeKey, () => props.defaultActiveKey, props.onSelect);
      const id = useSSRSafeId(props.id);
      const generateChildId = createMemo(() => props.generateChildId || ((key, type) => id ? `${id}-${type}-${key}` : null));
      const tabContext = {
        get onSelect() {
          return onSelect;
        },
        get activeKey() {
          return activeKey();
        },
        get transition() {
          return props.transition;
        },
        get mountOnEnter() {
          return props.mountOnEnter || false;
        },
        get unmountOnExit() {
          return props.unmountOnExit || false;
        },
        get getControlledId() {
          return (key) => generateChildId()(key, "pane");
        },
        get getControllerId() {
          return (key) => generateChildId()(key, "tab");
        }
      };
      return createComponent(TabContext$1.Provider, {
        value: tabContext,
        get children() {
          return createComponent(SelectableContext$1.Provider, {
            value: onSelect || null,
            get children() {
              return props.children;
            }
          });
        }
      });
    };
    Tabs.Panel = TabPanel$1;
    Tabs$1 = Tabs;
  }
});

// ../node_modules/solid-bootstrap/dist/esm/index.js
function toVal(mix) {
  var k, y, str = "";
  if (typeof mix === "string" || typeof mix === "number") {
    str += mix;
  } else if (typeof mix === "object") {
    if (Array.isArray(mix)) {
      for (k = 0; k < mix.length; k++) {
        if (mix[k]) {
          if (y = toVal(mix[k])) {
            str && (str += " ");
            str += y;
          }
        }
      }
    } else {
      for (k in mix) {
        if (mix[k]) {
          str && (str += " ");
          str += k;
        }
      }
    }
  }
  return str;
}
function classNames(...classes) {
  var i = 0, tmp, x, str = "";
  while (i < classes.length) {
    if (tmp = classes[i++]) {
      if (x = toVal(tmp)) {
        str && (str += " ");
        str += x;
      }
    }
  }
  return str;
}
function useBootstrapPrefix(prefix, defaultPrefix) {
  const themeContext = useContext(ThemeContext);
  return prefix || themeContext.prefixes[defaultPrefix] || defaultPrefix;
}
function useBootstrapBreakpoints() {
  const ctx = useContext(ThemeContext);
  return () => ctx.breakpoints;
}
function useIsRTL() {
  const ctx = useContext(ThemeContext);
  return () => ctx.dir === "rtl";
}
function ownerDocument2(node) {
  return node && node.ownerDocument || document;
}
function ownerWindow2(node) {
  var doc = ownerDocument2(node);
  return doc && doc.defaultView || window;
}
function getComputedStyle$1(node, psuedoElement) {
  return ownerWindow2(node).getComputedStyle(node, psuedoElement);
}
function hyphenate2(string) {
  return string.replace(rUpper2, "-$1").toLowerCase();
}
function hyphenateStyleName2(string) {
  return hyphenate2(string).replace(msPattern2, "-ms-");
}
function isTransform2(value) {
  return !!(value && supportedTransforms2.test(value));
}
function style3(node, property) {
  var css = "";
  var transforms = "";
  if (typeof property === "string") {
    return node.style.getPropertyValue(hyphenateStyleName2(property)) || getComputedStyle$1(node).getPropertyValue(hyphenateStyleName2(property));
  }
  Object.keys(property).forEach(function(key) {
    var value = property[key];
    if (!value && value !== 0) {
      node.style.removeProperty(hyphenateStyleName2(key));
    } else if (isTransform2(key)) {
      transforms += key + "(" + value + ") ";
    } else {
      css += hyphenateStyleName2(key) + ": " + value + ";";
    }
  });
  if (transforms) {
    css += "transform: " + transforms + ";";
  }
  node.style.cssText += ";" + css;
}
function triggerBrowserReflow(node) {
  node.offsetHeight;
}
function addEventListener3(node, eventName, handler, options) {
  if (options && typeof options !== "boolean" && !onceSupported2) {
    var once = options.once, capture = options.capture;
    var wrappedHandler = handler;
    if (!onceSupported2 && once) {
      wrappedHandler = handler.__once || function onceHandler(event) {
        this.removeEventListener(eventName, onceHandler, capture);
        handler.call(this, event);
      };
      handler.__once = wrappedHandler;
    }
    node.addEventListener(eventName, wrappedHandler, optionsSupported2 ? options : capture);
  }
  node.addEventListener(eventName, handler, options);
}
function removeEventListener2(node, eventName, handler, options) {
  var capture = options && typeof options !== "boolean" ? options.capture : options;
  node.removeEventListener(eventName, handler, capture);
  if (handler.__once) {
    node.removeEventListener(eventName, handler.__once, capture);
  }
}
function listen2(node, eventName, handler, options) {
  addEventListener3(node, eventName, handler, options);
  return function() {
    removeEventListener2(node, eventName, handler, options);
  };
}
function triggerEvent(node, eventName, bubbles, cancelable) {
  if (bubbles === void 0) {
    bubbles = false;
  }
  if (cancelable === void 0) {
    cancelable = true;
  }
  if (node) {
    var event = document.createEvent("HTMLEvents");
    event.initEvent(eventName, bubbles, cancelable);
    node.dispatchEvent(event);
  }
}
function parseDuration$1(node) {
  var str = style3(node, "transitionDuration") || "";
  var mult = str.indexOf("ms") === -1 ? 1e3 : 1;
  return parseFloat(str) * mult;
}
function emulateTransitionEnd(element, duration, padding) {
  if (padding === void 0) {
    padding = 5;
  }
  var called = false;
  var handle = setTimeout(function() {
    if (!called) triggerEvent(element, "transitionend", true);
  }, duration + padding);
  var remove = listen2(element, "transitionend", function() {
    called = true;
  }, {
    once: true
  });
  return function() {
    clearTimeout(handle);
    remove();
  };
}
function transitionEnd(element, handler, duration, padding) {
  if (duration == null) duration = parseDuration$1(element) || 0;
  var removeEmulate = emulateTransitionEnd(element, duration, padding);
  var remove = listen2(element, "transitionend", handler);
  return function() {
    removeEmulate();
    remove();
  };
}
function parseDuration(node, property) {
  const str = style3(node, property) || "";
  const mult = str.indexOf("ms") === -1 ? 1e3 : 1;
  return parseFloat(str) * mult;
}
function transitionEndListener(element, handler) {
  const duration = parseDuration(element, "transitionDuration");
  const delay = parseDuration(element, "transitionDelay");
  const remove = transitionEnd(element, (e) => {
    if (e.target === element) {
      remove();
      handler(e);
    }
  }, duration + delay);
}
function getDefaultDimensionValue(dimension, elem) {
  const offset2 = `offset${dimension[0].toUpperCase()}${dimension.slice(1)}`;
  const value = elem[offset2];
  const margins = MARGINS[dimension];
  return value + // @ts-ignore
  parseInt(style3(elem, margins[0]), 10) + // @ts-ignore
  parseInt(style3(elem, margins[1]), 10);
}
function isAccordionItemSelected(activeEventKey, eventKey) {
  return Array.isArray(activeEventKey) ? activeEventKey.includes(eventKey) : activeEventKey === eventKey;
}
function useAccordionButton(eventKey, onClick) {
  const context2 = useContext(AccordionContext);
  return (e) => {
    let eventKeyPassed = eventKey === context2.activeEventKey ? null : eventKey;
    if (context2.alwaysOpen) {
      if (Array.isArray(context2.activeEventKey)) {
        if (context2.activeEventKey.includes(eventKey)) {
          eventKeyPassed = context2.activeEventKey.filter((k) => k !== eventKey);
        } else {
          eventKeyPassed = [...context2.activeEventKey, eventKey];
        }
      } else {
        eventKeyPassed = [eventKey];
      }
    }
    context2.onSelect?.(eventKeyPassed, e);
    callEventHandler(onClick, e);
  };
}
function createWithBsPrefix(prefix, {
  Component,
  defaultProps: defaultProps3 = {}
} = {}) {
  const BsComponent = (p) => {
    const [local, props] = splitProps(mergeProps({
      as: Component
    }, defaultProps3, p), ["class", "bsPrefix", "as"]);
    const resolvedPrefix = useBootstrapPrefix(local.bsPrefix, prefix);
    return createComponent(Dynamic, mergeProps({
      get component() {
        return local.as || "div";
      },
      get ["class"]() {
        return classNames(local.class, resolvedPrefix);
      }
    }, props));
  };
  return BsComponent;
}
function hasClass(element, className2) {
  if (element.classList) return !!className2 && element.classList.contains(className2);
  return (" " + (element.className.baseVal || element.className) + " ").indexOf(" " + className2 + " ") !== -1;
}
function addClass(element, className2) {
  if (element.classList) element.classList.add(className2);
  else if (!hasClass(element, className2)) if (typeof element.className === "string") element.className = element.className + " " + className2;
  else element.setAttribute("class", (element.className && element.className.baseVal || "") + " " + className2);
}
function qsa2(element, selector) {
  return toArray2(element.querySelectorAll(selector));
}
function replaceClassName(origClass, classToRemove) {
  return origClass.replace(new RegExp("(^|\\s)" + classToRemove + "(?:\\s|$)", "g"), "$1").replace(/\s+/g, " ").replace(/^\s*|\s*$/g, "");
}
function removeClass(element, className2) {
  if (element.classList) {
    element.classList.remove(className2);
  } else if (typeof element.className === "string") {
    element.className = replaceClassName(element.className, className2);
  } else {
    element.setAttribute("class", replaceClassName(element.className && element.className.baseVal || "", className2));
  }
}
function getSharedManager(options) {
  if (!sharedManager) sharedManager = new BootstrapModalManager(options);
  return sharedManager;
}
function isVisible(element) {
  if (!element || !element.style || !element.parentNode || // @ts-ignore
  !element.parentNode.style) {
    return false;
  }
  const elementStyle = getComputedStyle(element);
  return elementStyle.display !== "none" && elementStyle.visibility !== "hidden" && getComputedStyle(element.parentNode).display !== "none";
}
function useCol(o) {
  const [local, props] = splitProps(o, ["as", "bsPrefix", "class"]);
  const bsPrefix = useBootstrapPrefix(local.bsPrefix, "col");
  const breakpoints = useBootstrapBreakpoints();
  const spans = [];
  const classes = [];
  breakpoints().forEach((brkPoint) => {
    const propValue = props[brkPoint];
    let span;
    let offset2;
    let order2;
    if (typeof propValue === "object" && propValue != null) {
      ({
        span,
        offset: offset2,
        order: order2
      } = propValue);
    } else {
      span = propValue;
    }
    const infix = brkPoint !== "xs" ? `-${brkPoint}` : "";
    if (span) spans.push(span === true ? `${bsPrefix}${infix}` : `${bsPrefix}${infix}-${span}`);
    if (order2 != null) classes.push(`order${infix}-${order2}`);
    if (offset2 != null) classes.push(`offset${infix}-${offset2}`);
  });
  const [_, cleanedProps] = splitProps(props, DEVICE_SIZES);
  return [mergeProps(cleanedProps, {
    get class() {
      return classNames(local.class, ...spans, ...classes);
    }
  }), {
    get as() {
      return local.as;
    },
    get bsPrefix() {
      return bsPrefix;
    },
    get spans() {
      return spans;
    }
  }];
}
function getDropdownMenuPlacement(alignEnd, dropDirection, isRTL) {
  const topStart = isRTL ? "top-end" : "top-start";
  const topEnd = isRTL ? "top-start" : "top-end";
  const bottomStart = isRTL ? "bottom-end" : "bottom-start";
  const bottomEnd = isRTL ? "bottom-start" : "bottom-end";
  const leftStart = isRTL ? "right-start" : "left-start";
  const leftEnd = isRTL ? "right-end" : "left-end";
  const rightStart = isRTL ? "left-start" : "right-start";
  const rightEnd = isRTL ? "left-end" : "right-end";
  let placement = alignEnd ? bottomEnd : bottomStart;
  if (dropDirection === "up") placement = alignEnd ? topEnd : topStart;
  else if (dropDirection === "end") placement = alignEnd ? rightEnd : rightStart;
  else if (dropDirection === "start") placement = alignEnd ? leftEnd : leftStart;
  return placement;
}
function scrollbarSize(recalc) {
  if (!size && size !== 0 || recalc) {
    if (canUseDOM2) {
      var scrollDiv = document.createElement("div");
      scrollDiv.style.position = "absolute";
      scrollDiv.style.top = "-9999px";
      scrollDiv.style.width = "50px";
      scrollDiv.style.height = "50px";
      scrollDiv.style.overflow = "scroll";
      document.body.appendChild(scrollDiv);
      size = scrollDiv.offsetWidth - scrollDiv.clientWidth;
      document.body.removeChild(scrollDiv);
    }
  }
  return size;
}
function DialogTransition$1(props) {
  return createComponent(Fade$1, mergeProps(props, {
    timeout: void 0
  }));
}
function BackdropTransition$1(props) {
  return createComponent(Fade$1, mergeProps(props, {
    timeout: void 0
  }));
}
function DialogTransition(props) {
  return createComponent(OffcanvasToggling$1, props);
}
function BackdropTransition(props) {
  return createComponent(Fade$1, props);
}
function createButton(name, defaultValue, label = name) {
  function Button3(props) {
    const [_, rest] = splitProps(props, ["children"]);
    return createComponent(PageItem, mergeProps(rest, {
      get children() {
        return [(() => {
          const _el$3 = _tmpl$3.cloneNode(true);
          insert(_el$3, () => props.children || defaultValue);
          return _el$3;
        })(), (() => {
          const _el$4 = _tmpl$2$2.cloneNode(true);
          insert(_el$4, label);
          return _el$4;
        })()];
      }
    }));
  }
  Button3.displayName = name;
  return Button3;
}
function usePlaceholder({
  animation,
  bg,
  bsPrefix,
  size: size2,
  ...props
}) {
  bsPrefix = useBootstrapPrefix(bsPrefix, "placeholder");
  const [{
    class: class_,
    ...colProps
  }] = useCol(props);
  return {
    ...colProps,
    class: classNames(class_, animation ? `${bsPrefix}-${animation}` : bsPrefix, size2 && `${bsPrefix}-${size2}`, bg && `bg-${bg}`)
  };
}
function getTabTransitionComponent(transition) {
  if (typeof transition === "boolean") {
    return transition ? Fade$1 : void 0;
  }
  return transition;
}
var DEFAULT_BREAKPOINTS, ThemeContext, rUpper2, msPattern2, supportedTransforms2, canUseDOM2, optionsSupported2, onceSupported2, options, defaultProps$1d, TransitionWrapper, TransitionWrapper$1, MARGINS, collapseStyles, defaultProps$1c, Collapse, Collapse$1, context$4, AccordionContext, defaultProps$1b, AccordionCollapse, AccordionCollapse$1, context$3, AccordionItemContext, defaultProps$1a, AccordionBody, AccordionBody$1, defaultProps$19, AccordionButton, AccordionButton$1, defaultProps$18, AccordionHeader, AccordionHeader$1, defaultProps$17, AccordionItem, AccordionItem$1, defaultProps$16, Accordion, Accordion$1, defaultProps$15, fadeStyles$1, Fade, Fade$1, _tmpl$$r, defaultProps$14, CloseButton, CloseButton$1, _tmpl$$q, divWithClass, _tmpl$$p, DivStyledAsH4$1, AlertHeading, AlertLink, defaultProps$13, Alert, Alert$1, toArray2, Selector, BootstrapModalManager, sharedManager, defaultProps$11, BreadcrumbItem, BreadcrumbItem$1, _tmpl$$o, defaultProps$10, Breadcrumb, Breadcrumb$1, defaultProps$$, Button2, Button$12, defaultProps$Y, CardImg, CardImg$1, context$2, CardHeaderContext, defaultProps$X, CardHeader, CardHeader$1, DivStyledAsH5$1, DivStyledAsH6, CardBody, CardTitle, CardSubtitle, CardLink, CardText, CardFooter, CardImgOverlay, defaultProps$W, Card, Card$1, CardGroup, CarouselCaption, defaultProps$V, CarouselItem, CarouselItem$1, _tmpl$$m, _tmpl$2$5, _tmpl$3$1, _tmpl$4, _tmpl$5, SWIPE_THRESHOLD, defaultProps$U, Carousel, Carousel$1, DEVICE_SIZES, Col, Col$1, DropdownContext2, DropdownContext$12, defaultProps$S, DropdownItem2, DropdownItem$12, context$1, InputGroupContext, context, NavbarContext, defaultProps$R, DropdownMenu2, DropdownMenu$1, defaultProps$Q, DropdownToggle2, DropdownToggle$1, DropdownHeader, DropdownDivider, DropdownItemText, defaultProps$P, Dropdown2, Dropdown$1, defaultProps$N, Feedback, Feedback$1, _tmpl$$l, defaultProps$M, Image, Image$1, defaultProps$L, FigureImage, FigureImage$1, FigureCaption, FigureCaption$1, Figure, Figure$1, FormContext, FormContext$1, defaultProps$K, FormGroup, FormGroup$1, _tmpl$$k, defaultProps$J, FloatingLabel, FloatingLabel$1, defaultProps$I, FormCheckInput, FormCheckInput$1, FormCheckContext, FormCheckContext$1, _tmpl$$j, defaultProps$H, FormCheckLabel, FormCheckLabel$1, _tmpl$$i, defaultProps$G, FormCheck, FormCheck$1, defaultProps$F, FormControl, FormControl$1, FormFloating, defaultProps$E, FormLabel, FormLabel$1, _tmpl$$h, defaultProps$D, FormRange, FormRange$1, _tmpl$$g, defaultProps$C, FormSelect, FormSelect$1, defaultProps$B, FormText, FormText$1, Switch2, Switch$1, defaultProps$A, Form, Form$1, InputGroupText, InputGroupCheckbox, InputGroupRadio, defaultProps$z, InputGroup, InputGroup$1, defaultProps$y, ListGroupItem, ListGroupItem$1, defaultProps$x, ListGroup, ListGroup$1, size, ModalBody, ModalContext, ModalContext$1, _tmpl$$f, defaultProps$w, ModalDialog, ModalDialog$1, ModalFooter, _tmpl$$e, defaultProps$v, AbstractModalHeader, AbstractModalHeader$1, defaultProps$u, ModalHeader, ModalHeader$1, DivStyledAsH4, ModalTitle, _tmpl$$d, _tmpl$2$4, defaultProps$t, Modal2, Modal$12, NavItem2, defaultProps$s, NavLink, NavLink$1, defaultProps$r, Nav2, Nav$12, defaultProps$q, NavbarBrand, NavbarBrand$1, _tmpl$$c, defaultProps$p, NavbarCollapse, NavbarCollapse$1, _tmpl$$b, defaultProps$o, NavbarToggle, NavbarToggle$1, OffcanvasBody, defaultProps$n, transitionStyles, OffcanvasToggling, OffcanvasToggling$1, defaultProps$m, OffcanvasHeader, OffcanvasHeader$1, DivStyledAsH5, OffcanvasTitle, _tmpl$$a, _tmpl$2$3, defaultProps$l, Offcanvas, Offcanvas$1, NavbarOffcanvas, NavbarOffcanvas$1, NavbarText, defaultProps$k, Navbar, Navbar$1, NavContext2, defaultProps$j, NavDropdown, NavDropdown$1, _tmpl$$9, _tmpl$2$2, _tmpl$3, defaultProps$g, PageItem, PageItem$1, First, Prev, Ellipsis, Next, Last, _tmpl$$8, defaultProps$f, Pagination, Pagination$1, PlaceholderButton, PlaceholderButton$1, defaultProps$e, Placeholder, Placeholder$1, PopoverHeader, PopoverBody, _tmpl$$7, defaultProps$d, Popover, Popover$1, ProgressContext, defaultProps$a, Spinner, Spinner$1, defaultProps$7, TabContainer, TabContainer$1, TabContent, defaultProps$6, TabPane, TabPane$1, Tab, Tab$1, fadeStyles, ToastFade, ToastFade$1, ToastContext, ToastContext$1, _tmpl$$3, defaultProps$32, ToastHeader, ToastHeader$1, ToastBody, _tmpl$$2, defaultProps$22, Toast, Toast$1;
var init_esm3 = __esm({
  "../node_modules/solid-bootstrap/dist/esm/index.js"() {
    init_web();
    init_solid();
    init_esm2();
    init_esm();
    DEFAULT_BREAKPOINTS = ["xxl", "xl", "lg", "md", "sm", "xs"];
    ThemeContext = createContext({
      prefixes: {},
      breakpoints: DEFAULT_BREAKPOINTS
    });
    rUpper2 = /([A-Z])/g;
    msPattern2 = /^ms-/;
    supportedTransforms2 = /^((translate|rotate|scale)(X|Y|Z|3d)?|matrix(3d)?|perspective|skew(X|Y)?)$/i;
    canUseDOM2 = !!(typeof window !== "undefined" && window.document && window.document.createElement);
    optionsSupported2 = false;
    onceSupported2 = false;
    try {
      options = {
        get passive() {
          return optionsSupported2 = true;
        },
        get once() {
          return onceSupported2 = optionsSupported2 = true;
        }
      };
      if (canUseDOM2) {
        window.addEventListener("test", options, options);
        window.removeEventListener("test", options, true);
      }
    } catch (e) {
    }
    defaultProps$1d = {};
    TransitionWrapper = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$1d, p), ["onEnter", "onEntering", "onEntered", "onExit", "onExiting", "onExited", "addEndListener", "children", "childRef"]);
      let [nodeRef, setNodeRef] = createSignal();
      const mergedRef = (ref) => {
        setNodeRef(ref);
        local.childRef?.(ref);
      };
      function normalize(callback) {
        return (param) => {
          if (callback && nodeRef()) {
            callback(nodeRef(), param);
          }
        };
      }
      const handlers = {
        get onEnter() {
          return normalize(local.onEnter);
        },
        get onEntering() {
          return normalize(local.onEntering);
        },
        get onEntered() {
          return normalize(local.onEntered);
        },
        get onExit() {
          return normalize(local.onExit);
        },
        get onExiting() {
          return normalize(local.onExiting);
        },
        get onExited() {
          return normalize(local.onExited);
        },
        get addEndListener() {
          return normalize(local.addEndListener);
        }
      };
      const resolvedChildren = children(() => local.children);
      function renderChild() {
        const child = resolvedChildren();
        if (typeof child === "function") {
          return (status, innerProps) => child(status, {
            ...innerProps,
            ref: mergedRef
          });
        } else {
          mergedRef(child);
          return child;
        }
      }
      return createComponent(Transition2, mergeProps(props, handlers, {
        get nodeRef() {
          return nodeRef();
        },
        get children() {
          return renderChild();
        }
      }));
    };
    TransitionWrapper$1 = TransitionWrapper;
    MARGINS = {
      height: ["marginTop", "marginBottom"],
      width: ["marginLeft", "marginRight"]
    };
    collapseStyles = {
      [EXITED]: "collapse",
      [EXITING]: "collapsing",
      [ENTERING]: "collapsing",
      [ENTERED]: "collapse show",
      [UNMOUNTED]: ""
    };
    defaultProps$1c = {
      in: false,
      dimension: "height",
      timeout: 300,
      mountOnEnter: false,
      unmountOnExit: false,
      appear: false,
      getDimensionValue: getDefaultDimensionValue
    };
    Collapse = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$1c, p), ["onEnter", "onEntering", "onEntered", "onExit", "onExiting", "class", "children", "dimension", "getDimensionValue"]);
      const computedDimension = () => typeof local.dimension === "function" ? local.dimension() : local.dimension;
      const handleEnter = (elem) => {
        elem.style[computedDimension()] = "0";
        local.onEnter?.(elem);
      };
      const handleEntering = (elem) => {
        const scroll2 = `scroll${computedDimension()[0].toUpperCase()}${computedDimension().slice(1)}`;
        elem.style[computedDimension()] = `${elem[scroll2]}px`;
        local.onEntering?.(elem);
      };
      const handleEntered = (elem) => {
        elem.style[computedDimension()] = null;
        local.onEntered?.(elem);
      };
      const handleExit = (elem) => {
        elem.style[computedDimension()] = `${local.getDimensionValue(computedDimension(), elem)}px`;
        triggerBrowserReflow(elem);
        local.onExit?.(elem);
      };
      const handleExiting = (elem) => {
        elem.style[computedDimension()] = null;
        local.onExiting?.(elem);
      };
      const resolvedChildren = children(() => local.children);
      let prevClasses;
      return createComponent(TransitionWrapper$1, mergeProps({
        addEndListener: transitionEndListener
      }, props, {
        get ["aria-expanded"]() {
          return props.role ? props.in : null;
        },
        onEnter: handleEnter,
        onEntering: handleEntering,
        onEntered: handleEntered,
        onExit: handleExit,
        onExiting: handleExiting,
        children: (state, innerProps) => {
          const el = resolvedChildren();
          innerProps.ref(el);
          const newClasses = classNames(local.class, collapseStyles[state], computedDimension() === "width" && "collapse-horizontal");
          resolveClasses(el, prevClasses, newClasses);
          prevClasses = newClasses;
          return el;
        }
      }));
    };
    Collapse$1 = Collapse;
    context$4 = createContext({});
    AccordionContext = context$4;
    defaultProps$1b = {
      as: "div"
    };
    AccordionCollapse = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$1b, p), ["as", "bsPrefix", "class", "children", "eventKey"]);
      const context2 = useContext(AccordionContext);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "accordion-collapse");
      return createComponent(Collapse$1, mergeProps({
        get ["in"]() {
          return isAccordionItemSelected(context2.activeEventKey, local.eventKey);
        }
      }, props, {
        get children() {
          return createComponent(Dynamic, {
            get component() {
              return local.as;
            },
            get ["class"]() {
              return classNames(local.class, bsPrefix);
            },
            get children() {
              return local.children;
            }
          });
        }
      }));
    };
    AccordionCollapse$1 = AccordionCollapse;
    context$3 = createContext({
      eventKey: ""
    });
    AccordionItemContext = context$3;
    defaultProps$1a = {
      as: "div"
    };
    AccordionBody = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$1a, p), ["as", "bsPrefix", "class"]);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "accordion-body");
      const context2 = useContext(AccordionItemContext);
      return createComponent(AccordionCollapse$1, {
        get eventKey() {
          return context2.eventKey;
        },
        get children() {
          return createComponent(Dynamic, mergeProps({
            get component() {
              return local.as;
            }
          }, props, {
            get ["class"]() {
              return classNames(local.class, bsPrefix);
            }
          }));
        }
      });
    };
    AccordionBody$1 = AccordionBody;
    defaultProps$19 = {
      as: "button"
    };
    AccordionButton = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$19, p), ["as", "bsPrefix", "class", "onClick"]);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "accordion-button");
      const itemContext = useContext(AccordionItemContext);
      const accordionOnClick = useAccordionButton(itemContext.eventKey, local.onClick);
      const accordionContext = useContext(AccordionContext);
      return createComponent(Dynamic, mergeProps({
        get component() {
          return local.as;
        },
        onClick: accordionOnClick
      }, props, {
        get type() {
          return local.as === "button" ? "button" : void 0;
        },
        get ["aria-expanded"]() {
          return itemContext.eventKey === accordionContext.activeEventKey;
        },
        get ["class"]() {
          return classNames(local.class, bsPrefix, !isAccordionItemSelected(accordionContext.activeEventKey, itemContext.eventKey) && "collapsed");
        }
      }));
    };
    AccordionButton$1 = AccordionButton;
    defaultProps$18 = {
      as: "h2"
    };
    AccordionHeader = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$18, p), ["as", "bsPrefix", "class", "children", "onClick"]);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "accordion-header");
      return createComponent(Dynamic, mergeProps({
        get component() {
          return local.as;
        }
      }, props, {
        get ["class"]() {
          return classNames(local.class, bsPrefix);
        },
        get children() {
          return createComponent(AccordionButton$1, {
            get onClick() {
              return local.onClick;
            },
            get children() {
              return local.children;
            }
          });
        }
      }));
    };
    AccordionHeader$1 = AccordionHeader;
    defaultProps$17 = {
      as: "div"
    };
    AccordionItem = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$17, p), ["as", "bsPrefix", "class", "eventKey"]);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "accordion-item");
      const contextValue = {
        get eventKey() {
          return local.eventKey;
        }
      };
      return createComponent(AccordionItemContext.Provider, {
        value: contextValue,
        get children() {
          return createComponent(Dynamic, mergeProps({
            get component() {
              return local.as;
            }
          }, props, {
            get ["class"]() {
              return classNames(local.class, bsPrefix);
            }
          }));
        }
      });
    };
    AccordionItem$1 = AccordionItem;
    defaultProps$16 = {
      as: "div"
    };
    Accordion = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$16, p), ["as", "activeKey", "alwaysOpen", "bsPrefix", "class", "defaultActiveKey", "onSelect", "flush"]);
      const [activeKey, onSelect] = createControlledProp(() => local.activeKey, () => local.defaultActiveKey, local.onSelect);
      const prefix = useBootstrapPrefix(local.bsPrefix, "accordion");
      const contextValue = {
        get activeEventKey() {
          return activeKey();
        },
        get alwaysOpen() {
          return local.alwaysOpen;
        },
        get onSelect() {
          return onSelect;
        }
      };
      return createComponent(AccordionContext.Provider, {
        value: contextValue,
        get children() {
          return createComponent(Dynamic, mergeProps({
            get component() {
              return local.as;
            }
          }, props, {
            get ["class"]() {
              return classNames(local.class, prefix, local.flush && `${prefix}-flush`);
            }
          }));
        }
      });
    };
    Accordion$1 = Object.assign(Accordion, {
      Button: AccordionButton$1,
      Collapse: AccordionCollapse$1,
      Item: AccordionItem$1,
      Header: AccordionHeader$1,
      Body: AccordionBody$1
    });
    defaultProps$15 = {
      in: false,
      timeout: 300,
      mountOnEnter: false,
      unmountOnExit: false,
      appear: false
    };
    fadeStyles$1 = {
      [ENTERING]: "show",
      [ENTERED]: "show"
    };
    Fade = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$15, p), ["class", "children", "transitionClasses"]);
      const handleEnter = (node, isAppearing) => {
        triggerBrowserReflow(node);
        props.onEnter?.(node, isAppearing);
      };
      let resolvedChildren;
      let prevClasses;
      return createComponent(TransitionWrapper$1, mergeProps({
        addEndListener: transitionEndListener,
        onEnter: handleEnter
      }, props, {
        children: (status, innerProps) => {
          if (!resolvedChildren) resolvedChildren = children(() => local.children);
          let el = resolvedChildren();
          while (typeof el === "function") el = el();
          innerProps.ref(el);
          const newClasses = classNames(
            "fade",
            local.class,
            // @ts-ignore
            fadeStyles$1?.[status],
            local.transitionClasses?.[status]
          );
          resolveClasses(el, prevClasses, newClasses);
          prevClasses = newClasses;
          return el;
        }
      }));
    };
    Fade$1 = Fade;
    _tmpl$$r = /* @__PURE__ */ template(`<button type="button"></button>`, 2);
    defaultProps$14 = {
      "aria-label": "Close"
    };
    CloseButton = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$14, p), ["class", "variant"]);
      return (() => {
        const _el$ = _tmpl$$r.cloneNode(true);
        spread(_el$, mergeProps({
          get ["class"]() {
            return classNames("btn-close", local.variant && `btn-close-${local.variant}`, local.class);
          }
        }, props), false, false);
        return _el$;
      })();
    };
    CloseButton$1 = CloseButton;
    _tmpl$$q = /* @__PURE__ */ template(`<div></div>`, 2);
    divWithClass = (c) => (p) => {
      return (() => {
        const _el$ = _tmpl$$q.cloneNode(true);
        spread(_el$, mergeProps(p, {
          get ["class"]() {
            return classNames(p.class, c);
          }
        }), false, false);
        return _el$;
      })();
    };
    _tmpl$$p = /* @__PURE__ */ template(`<div role="alert"></div>`, 2);
    DivStyledAsH4$1 = divWithClass("h4");
    AlertHeading = createWithBsPrefix("alert-heading", {
      Component: DivStyledAsH4$1
    });
    AlertLink = createWithBsPrefix("alert-link", {
      Component: Anchor$1
    });
    defaultProps$13 = {
      variant: "primary",
      defaultShow: true,
      transition: Fade$1,
      closeLabel: "Close alert"
    };
    Alert = (uncontrolledProps) => {
      const [local, props] = splitProps(mergeProps(defaultProps$13, uncontrolledProps), ["bsPrefix", "children", "defaultShow", "show", "closeLabel", "closeVariant", "class", "children", "variant", "onClose", "dismissible", "transition"]);
      const [show, onClose] = createControlledProp(() => local.show, () => local.defaultShow, local.onClose);
      const prefix = useBootstrapPrefix(local.bsPrefix, "alert");
      const handleClose = (e) => {
        if (onClose) {
          onClose(false, e);
        }
      };
      const Transition3 = local.transition === true ? Fade$1 : local.transition;
      const alert = () => (() => {
        const _el$ = _tmpl$$p.cloneNode(true);
        spread(_el$, mergeProps(!Transition3 ? props : {}, {
          get ["class"]() {
            return classNames(local.class, prefix, local.variant && `${prefix}-${local.variant}`, local.dismissible && `${prefix}-dismissible`);
          }
        }), false, true);
        insert(_el$, (() => {
          const _c$ = memo(() => !!local.dismissible);
          return () => _c$() && createComponent(CloseButton$1, {
            onClick: handleClose,
            get ["aria-label"]() {
              return local.closeLabel;
            },
            get variant() {
              return local.closeVariant;
            }
          });
        })(), null);
        insert(_el$, () => local.children, null);
        return _el$;
      })();
      return createComponent(Show, {
        when: !!Transition3,
        get fallback() {
          return local.show ? alert : null;
        },
        get children() {
          return createComponent(Transition3, mergeProps({
            unmountOnExit: true
          }, props, {
            ref(r$) {
              undefined = r$;
            },
            get ["in"]() {
              return show();
            },
            children: alert
          }));
        }
      });
    };
    Alert$1 = Object.assign(Alert, {
      Link: AlertLink,
      Heading: AlertHeading
    });
    toArray2 = Function.prototype.bind.call(Function.prototype.call, [].slice);
    Selector = {
      FIXED_CONTENT: ".fixed-top, .fixed-bottom, .is-fixed, .sticky-top",
      STICKY_CONTENT: ".sticky-top",
      NAVBAR_TOGGLER: ".navbar-toggler"
    };
    BootstrapModalManager = class extends ModalManager$1 {
      adjustAndStore(prop, element, adjust) {
        const actual = element.style[prop];
        element.dataset[prop] = actual;
        style3(element, {
          [prop]: `${parseFloat(style3(element, prop)) + adjust}px`
        });
      }
      restore(prop, element) {
        const value = element.dataset[prop];
        if (value !== void 0) {
          delete element.dataset[prop];
          style3(element, {
            [prop]: value
          });
        }
      }
      setContainerStyle(containerState) {
        super.setContainerStyle(containerState);
        const container = this.getElement();
        addClass(container, "modal-open");
        if (!containerState.scrollBarWidth) return;
        const paddingProp = this.isRTL ? "paddingLeft" : "paddingRight";
        const marginProp = this.isRTL ? "marginLeft" : "marginRight";
        qsa2(container, Selector.FIXED_CONTENT).forEach((el) => this.adjustAndStore(paddingProp, el, containerState.scrollBarWidth));
        qsa2(container, Selector.STICKY_CONTENT).forEach((el) => this.adjustAndStore(marginProp, el, -containerState.scrollBarWidth));
        qsa2(container, Selector.NAVBAR_TOGGLER).forEach((el) => this.adjustAndStore(marginProp, el, containerState.scrollBarWidth));
      }
      removeContainerStyle(containerState) {
        super.removeContainerStyle(containerState);
        const container = this.getElement();
        removeClass(container, "modal-open");
        const paddingProp = this.isRTL ? "paddingLeft" : "paddingRight";
        const marginProp = this.isRTL ? "marginLeft" : "marginRight";
        qsa2(container, Selector.FIXED_CONTENT).forEach((el) => this.restore(paddingProp, el));
        qsa2(container, Selector.STICKY_CONTENT).forEach((el) => this.restore(marginProp, el));
        qsa2(container, Selector.NAVBAR_TOGGLER).forEach((el) => this.restore(marginProp, el));
      }
    };
    defaultProps$11 = {
      as: "li",
      active: false,
      linkAs: Anchor$1,
      linkProps: {}
    };
    BreadcrumbItem = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$11, p), ["bsPrefix", "active", "children", "class", "as", "linkAs", "linkProps", "href", "title", "target"]);
      const prefix = useBootstrapPrefix(local.bsPrefix, "breadcrumb-item");
      return createComponent(Dynamic, mergeProps({
        get component() {
          return local.as;
        }
      }, props, {
        get ["class"]() {
          return classNames(prefix, local.class, {
            active: local.active
          });
        },
        get ["aria-current"]() {
          return local.active ? "page" : void 0;
        },
        get children() {
          return memo(() => !!local.active)() ? local.children : createComponent(Dynamic, mergeProps({
            get component() {
              return local.linkAs;
            }
          }, () => local.linkProps, {
            get href() {
              return local.href;
            },
            get title() {
              return local.title;
            },
            get target() {
              return local.target;
            },
            get children() {
              return local.children;
            }
          }));
        }
      }));
    };
    BreadcrumbItem$1 = BreadcrumbItem;
    _tmpl$$o = /* @__PURE__ */ template(`<ol></ol>`, 2);
    defaultProps$10 = {
      as: "nav",
      label: "breadcrumb",
      listProps: {}
    };
    Breadcrumb = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$10, p), ["bsPrefix", "class", "listProps", "children", "label", "as"]);
      const prefix = useBootstrapPrefix(local.bsPrefix, "breadcrumb");
      return createComponent(Dynamic, mergeProps({
        get component() {
          return local.as;
        },
        get ["aria-label"]() {
          return local.label;
        },
        get ["class"]() {
          return classNames(local.class);
        }
      }, props, {
        get children() {
          const _el$ = _tmpl$$o.cloneNode(true);
          spread(_el$, mergeProps(() => local.listProps, {
            get ["class"]() {
              return classNames(prefix, local.listProps?.class);
            }
          }), false, true);
          insert(_el$, () => local.children);
          return _el$;
        }
      }));
    };
    Breadcrumb$1 = Object.assign(Breadcrumb, {
      Item: BreadcrumbItem$1
    });
    defaultProps$$ = {
      variant: "primary",
      active: false,
      disabled: false
    };
    Button2 = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$$, p), ["as", "bsPrefix", "children", "variant", "size", "active", "class"]);
      const prefix = useBootstrapPrefix(local.bsPrefix, "btn");
      const [buttonProps, {
        tagName
      }] = useButtonProps({
        tagName: local.as,
        ...props
      });
      return createComponent(Dynamic, mergeProps({
        component: tagName
      }, buttonProps, props, {
        get ["class"]() {
          return classNames(local.class, prefix, local.active && "active", local.variant && `${prefix}-${local.variant}`, local.size && `${prefix}-${local.size}`, props.href && props.disabled && "disabled");
        },
        get children() {
          return local.children;
        }
      }));
    };
    Button$12 = Button2;
    defaultProps$Y = {
      as: "img"
    };
    CardImg = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$Y, p), ["as", "bsPrefix", "class", "variant"]);
      const prefix = useBootstrapPrefix(local.bsPrefix, "card-img");
      return createComponent(Dynamic, mergeProps({
        get component() {
          return local.as;
        },
        get ["class"]() {
          return classNames(local.variant ? `${prefix}-${local.variant}` : prefix, local.class);
        }
      }, props));
    };
    CardImg$1 = CardImg;
    context$2 = createContext(null);
    CardHeaderContext = context$2;
    defaultProps$X = {
      as: "div"
    };
    CardHeader = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$X, p), ["as", "bsPrefix", "class"]);
      const prefix = useBootstrapPrefix(local.bsPrefix, "card-header");
      const contextValue = {
        get cardHeaderBsPrefix() {
          return prefix;
        }
      };
      return createComponent(CardHeaderContext.Provider, {
        value: contextValue,
        get children() {
          return createComponent(Dynamic, mergeProps({
            get component() {
              return local.as;
            }
          }, props, {
            get ["class"]() {
              return classNames(local.class, prefix);
            }
          }));
        }
      });
    };
    CardHeader$1 = CardHeader;
    DivStyledAsH5$1 = divWithClass("h5");
    DivStyledAsH6 = divWithClass("h6");
    CardBody = createWithBsPrefix("card-body");
    CardTitle = createWithBsPrefix("card-title", {
      Component: DivStyledAsH5$1
    });
    CardSubtitle = createWithBsPrefix("card-subtitle", {
      Component: DivStyledAsH6
    });
    CardLink = createWithBsPrefix("card-link", {
      Component: "a"
    });
    CardText = createWithBsPrefix("card-text", {
      Component: "p"
    });
    CardFooter = createWithBsPrefix("card-footer");
    CardImgOverlay = createWithBsPrefix("card-img-overlay");
    defaultProps$W = {
      as: "div",
      body: false
    };
    Card = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$W, p), ["as", "bsPrefix", "class", "bg", "text", "border", "body", "children"]);
      const prefix = useBootstrapPrefix(local.bsPrefix, "card");
      return createComponent(Dynamic, mergeProps({
        get component() {
          return local.as;
        }
      }, props, {
        get ["class"]() {
          return classNames(local.class, prefix, local.bg && `bg-${local.bg}`, local.text && `text-${local.text}`, local.border && `border-${local.border}`);
        },
        get children() {
          return memo(() => !!local.body)() ? createComponent(CardBody, {
            get children() {
              return local.children;
            }
          }) : local.children;
        }
      }));
    };
    Card$1 = Object.assign(Card, {
      Img: CardImg$1,
      Title: CardTitle,
      Subtitle: CardSubtitle,
      Body: CardBody,
      Link: CardLink,
      Text: CardText,
      Header: CardHeader$1,
      Footer: CardFooter,
      ImgOverlay: CardImgOverlay
    });
    CardGroup = createWithBsPrefix("card-group");
    CarouselCaption = createWithBsPrefix("carousel-caption");
    defaultProps$V = {
      as: "div"
    };
    CarouselItem = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$V, p), ["as", "bsPrefix", "class", "interval"]);
      return {
        item: createComponent(Dynamic, mergeProps({
          get component() {
            return local.as;
          }
        }, props, {
          get ["class"]() {
            return classNames(local.class, useBootstrapPrefix(local.bsPrefix, "carousel-item"));
          }
        })),
        interval: local.interval
      };
    };
    CarouselItem$1 = CarouselItem;
    _tmpl$$m = /* @__PURE__ */ template(`<div></div>`, 2);
    _tmpl$2$5 = /* @__PURE__ */ template(`<button type="button" data-bs-target=""></button>`, 2);
    _tmpl$3$1 = /* @__PURE__ */ template(`<span aria-hidden="true" class="carousel-control-prev-icon"></span>`, 2);
    _tmpl$4 = /* @__PURE__ */ template(`<span class="visually-hidden"></span>`, 2);
    _tmpl$5 = /* @__PURE__ */ template(`<span aria-hidden="true" class="carousel-control-next-icon"></span>`, 2);
    SWIPE_THRESHOLD = 40;
    defaultProps$U = {
      as: "div",
      slide: true,
      fade: false,
      controls: true,
      indicators: true,
      indicatorLabels: [],
      defaultActiveIndex: 0,
      interval: 5e3,
      keyboard: true,
      pause: "hover",
      wrap: true,
      touch: true,
      prevLabel: "Previous",
      nextLabel: "Next"
    };
    Carousel = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$U, p), ["as", "bsPrefix", "slide", "fade", "controls", "indicators", "indicatorLabels", "activeIndex", "defaultActiveIndex", "onSelect", "onSlide", "onSlid", "interval", "keyboard", "onKeyDown", "pause", "onMouseOver", "onMouseOut", "wrap", "touch", "onTouchStart", "onTouchMove", "onTouchEnd", "prevIcon", "prevLabel", "nextIcon", "nextLabel", "variant", "class", "children", "ref"]);
      const [activeIndex, onSelect] = createControlledProp(() => local.activeIndex, () => local.defaultActiveIndex, local.onSelect);
      const prefix = useBootstrapPrefix(local.bsPrefix, "carousel");
      const isRTL = useIsRTL();
      const resolvedChildren = children(() => local.children);
      const items = createMemo(() => {
        const c = resolvedChildren();
        return Array.isArray(c) ? c : [c];
      });
      const [nextDirectionRef, setNextDirectionRef] = createSignal(null);
      const [direction, setDirection] = createSignal("next");
      const [paused, setPaused] = createSignal(false);
      const [isSliding, setIsSliding] = createSignal(false);
      const [renderedActiveIndex, setRenderedActiveIndex] = createSignal(activeIndex() || 0);
      createComputed(() => batch(() => {
        if (!isSliding() && activeIndex() !== renderedActiveIndex()) {
          if (nextDirectionRef()) {
            setDirection(nextDirectionRef());
          } else {
            setDirection((activeIndex() || 0) > renderedActiveIndex() ? "next" : "prev");
          }
          if (local.slide) {
            setIsSliding(true);
          }
          setRenderedActiveIndex(activeIndex() || 0);
        }
      }));
      createEffect(() => {
        if (nextDirectionRef()) {
          setNextDirectionRef(null);
        }
      });
      const activeChildInterval = createMemo(() => {
        for (let index = 0; index < items().length; index++) {
          if (index === activeIndex()) {
            const item = items()[index];
            return item.interval;
          }
        }
        return void 0;
      });
      const prev = (event) => {
        if (isSliding()) {
          return;
        }
        let nextActiveIndex = renderedActiveIndex() - 1;
        if (nextActiveIndex < 0) {
          if (!local.wrap) {
            return;
          }
          nextActiveIndex = items().length - 1;
        }
        setNextDirectionRef("prev");
        onSelect?.(nextActiveIndex, event);
      };
      const next = (event) => {
        if (isSliding()) {
          return;
        }
        let nextActiveIndex = renderedActiveIndex() + 1;
        if (nextActiveIndex >= items().length) {
          if (!local.wrap) {
            return;
          }
          nextActiveIndex = 0;
        }
        setNextDirectionRef("next");
        onSelect?.(nextActiveIndex, event);
      };
      const [elementRef, setElementRef] = createSignal();
      const mergedRef = (ref) => {
        setElementRef(ref);
        if (typeof local.ref === "function") {
          local.ref({
            get element() {
              return elementRef();
            },
            prev,
            next
          });
        }
      };
      const nextWhenVisible = () => {
        if (!document.hidden && isVisible(elementRef())) {
          if (isRTL()) {
            prev();
          } else {
            next();
          }
        }
      };
      const slideDirection = createMemo(() => direction() === "next" ? "start" : "end");
      createEffect(() => {
        if (local.slide) {
          return;
        }
        local.onSlide?.(renderedActiveIndex(), slideDirection());
        local.onSlid?.(renderedActiveIndex(), slideDirection());
      });
      const orderClass = createMemo(() => `${prefix}-item-${direction()}`);
      const directionalClass = createMemo(() => `${prefix}-item-${slideDirection()}`);
      const handleEnter = (node) => {
        triggerBrowserReflow(node);
        local.onSlide?.(renderedActiveIndex(), slideDirection());
      };
      const handleEntered = () => {
        setIsSliding(false);
        local.onSlid?.(renderedActiveIndex(), slideDirection());
      };
      const handleKeyDown = (event) => {
        if (local.keyboard && !/input|textarea/i.test(
          //@ts-ignore
          event.target.tagName
        )) {
          switch (event.key) {
            case "ArrowLeft":
              event.preventDefault();
              if (isRTL()) {
                next(event);
              } else {
                prev(event);
              }
              return;
            case "ArrowRight":
              event.preventDefault();
              if (isRTL()) {
                prev(event);
              } else {
                next(event);
              }
              return;
          }
        }
        callEventHandler(local.onKeyDown, event);
      };
      const handleMouseOver = (event) => {
        if (local.pause === "hover") {
          setPaused(true);
        }
        callEventHandler(local.onMouseOver, event);
      };
      const handleMouseOut = (event) => {
        setPaused(false);
        callEventHandler(local.onMouseOut, event);
      };
      let touchStartXRef;
      let touchDeltaXRef;
      const handleTouchStart = (event) => {
        touchStartXRef = event.touches[0].clientX;
        touchDeltaXRef = 0;
        if (local.pause === "hover") {
          setPaused(true);
        }
        callEventHandler(local.onTouchStart, event);
      };
      const handleTouchMove = (event) => {
        if (event.touches && event.touches.length > 1) {
          touchDeltaXRef = 0;
        } else {
          touchDeltaXRef = event.touches[0].clientX - touchStartXRef;
        }
        callEventHandler(local.onTouchMove, event);
      };
      const handleTouchEnd = (event) => {
        if (local.touch) {
          const touchDeltaX = touchDeltaXRef;
          if (Math.abs(touchDeltaX) > SWIPE_THRESHOLD) {
            if (touchDeltaX > 0) {
              prev(event);
            } else {
              next(event);
            }
          }
        }
        if (local.pause === "hover") {
          let touchUnpauseTimeout = window.setTimeout(() => {
            setPaused(false);
          }, local.interval);
          onCleanup(() => {
            window.clearTimeout(touchUnpauseTimeout);
          });
        }
        callEventHandler(local.onTouchEnd, event);
      };
      const shouldPlay = createMemo(() => local.interval != null && !paused() && !isSliding());
      const [intervalHandleRef, setIntervalHandleRef] = createSignal();
      createEffect(() => {
        if (!shouldPlay()) {
          return void 0;
        }
        const nextFunc = isRTL() ? prev : next;
        setIntervalHandleRef(window.setInterval(document.visibilityState ? nextWhenVisible : nextFunc, activeChildInterval() ?? local.interval ?? void 0));
        onCleanup(() => {
          if (intervalHandleRef() !== null) {
            clearInterval(intervalHandleRef());
          }
        });
      });
      const isActive = createSelector(renderedActiveIndex);
      return createComponent(Dynamic, mergeProps({
        get component() {
          return local.as;
        },
        ref: mergedRef
      }, props, {
        onKeyDown: handleKeyDown,
        onMouseOver: handleMouseOver,
        onMouseOut: handleMouseOut,
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
        get ["class"]() {
          return classNames(local.class, prefix, local.slide && "slide", local.fade && `${prefix}-fade`, local.variant && `${prefix}-${local.variant}`);
        },
        get children() {
          return [memo(() => memo(() => !!local.indicators)() && (() => {
            const _el$2 = _tmpl$$m.cloneNode(true);
            className(_el$2, `${prefix}-indicators`);
            insert(_el$2, createComponent(For, {
              get each() {
                return items();
              },
              children: (_, index) => (() => {
                const _el$3 = _tmpl$2$5.cloneNode(true);
                _el$3.$$click = (e) => onSelect?.(index(), e);
                createRenderEffect((_p$) => {
                  const _v$ = local.indicatorLabels?.length ? local.indicatorLabels[index()] : `Slide ${index() + 1}`, _v$2 = isActive(index()) ? "active" : void 0, _v$3 = isActive(index());
                  _v$ !== _p$._v$ && setAttribute(_el$3, "aria-label", _p$._v$ = _v$);
                  _v$2 !== _p$._v$2 && className(_el$3, _p$._v$2 = _v$2);
                  _v$3 !== _p$._v$3 && setAttribute(_el$3, "aria-current", _p$._v$3 = _v$3);
                  return _p$;
                }, {
                  _v$: void 0,
                  _v$2: void 0,
                  _v$3: void 0
                });
                return _el$3;
              })()
            }));
            return _el$2;
          })()), (() => {
            const _el$ = _tmpl$$m.cloneNode(true);
            className(_el$, `${prefix}-inner`);
            insert(_el$, createComponent(For, {
              get each() {
                return items();
              },
              children: (child, index) => {
                const el = typeof child.item === "function" ? child.item() : child.item;
                return local.slide ? createComponent(TransitionWrapper$1, {
                  get ["in"]() {
                    return isActive(index());
                  },
                  get onEnter() {
                    return isActive(index()) ? handleEnter : void 0;
                  },
                  get onEntered() {
                    return isActive(index()) ? handleEntered : void 0;
                  },
                  addEndListener: transitionEndListener,
                  children: (status, innerProps) => {
                    innerProps.ref(el);
                    const newClasses = classNames(isActive(index()) && status !== "entered" && orderClass(), (status === "entered" || status === "exiting") && "active", (status === "entering" || status === "exiting") && directionalClass());
                    resolveClasses(el, child.prevClasses, newClasses);
                    child.prevClasses = newClasses;
                    return el;
                  }
                }) : () => {
                  createEffect(() => {
                    el.classList.toggle("active", isActive(index()));
                  });
                  return el;
                };
              }
            }));
            return _el$;
          })(), memo(() => memo(() => !!local.controls)() && [memo((() => {
            const _c$ = memo(() => !!(local.wrap || activeIndex() !== 0));
            return () => _c$() && createComponent(Anchor$1, {
              "class": `${prefix}-control-prev`,
              onClick: prev,
              get children() {
                return [memo(() => local.prevIcon ?? _tmpl$3$1.cloneNode(true)), memo(() => memo(() => !!local.prevLabel)() && (() => {
                  const _el$5 = _tmpl$4.cloneNode(true);
                  insert(_el$5, () => local.prevLabel);
                  return _el$5;
                })())];
              }
            });
          })()), memo((() => {
            const _c$2 = memo(() => !!(local.wrap || activeIndex() !== items().length - 1));
            return () => _c$2() && createComponent(Anchor$1, {
              "class": `${prefix}-control-next`,
              onClick: next,
              get children() {
                return [memo(() => local.nextIcon ?? _tmpl$5.cloneNode(true)), memo(() => memo(() => !!local.nextLabel)() && (() => {
                  const _el$7 = _tmpl$4.cloneNode(true);
                  insert(_el$7, () => local.nextLabel);
                  return _el$7;
                })())];
              }
            });
          })())])];
        }
      }));
    };
    Carousel$1 = Object.assign(Carousel, {
      Caption: CarouselCaption,
      Item: CarouselItem$1
    });
    delegateEvents(["click"]);
    DEVICE_SIZES = ["xxl", "xl", "lg", "md", "sm", "xs"];
    Col = (p) => {
      const [useProps, meta] = useCol(p);
      const [local, colProps] = splitProps(useProps, ["class"]);
      return createComponent(Dynamic, mergeProps({
        get component() {
          return meta.as ?? "div";
        }
      }, colProps, {
        get ["class"]() {
          return classNames(local.class, !meta.spans.length && meta.bsPrefix);
        }
      }));
    };
    Col$1 = Col;
    DropdownContext2 = createContext({});
    DropdownContext$12 = DropdownContext2;
    defaultProps$S = {
      as: Anchor$1,
      disabled: false
    };
    DropdownItem2 = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$S, p), ["as", "bsPrefix", "class", "eventKey", "disabled", "onClick", "active"]);
      const prefix = useBootstrapPrefix(local.bsPrefix, "dropdown-item");
      const [dropdownItemProps, meta] = useDropdownItem({
        get key() {
          return local.eventKey;
        },
        get href() {
          return props.href;
        },
        get disabled() {
          return local.disabled;
        },
        get onClick() {
          return local.onClick;
        },
        get active() {
          return local.active;
        }
      });
      return createComponent(Dynamic, mergeProps({
        get component() {
          return local.as;
        }
      }, props, dropdownItemProps, {
        get ["class"]() {
          return classNames(local.class, prefix, meta.isActive && "active", local.disabled && "disabled");
        }
      }));
    };
    DropdownItem$12 = DropdownItem2;
    context$1 = createContext(null);
    InputGroupContext = context$1;
    context = createContext(null);
    NavbarContext = context;
    defaultProps$R = {
      as: "div",
      flip: true
    };
    DropdownMenu2 = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$R, p), ["as", "bsPrefix", "class", "align", "rootCloseEvent", "flip", "show", "renderOnMount", "popperConfig", "ref", "variant"]);
      let alignEnd = false;
      const isNavbar = useContext(NavbarContext);
      const prefix = useBootstrapPrefix(local.bsPrefix, "dropdown-menu");
      const dropdownContext = useContext(DropdownContext$12);
      const align = local.align || dropdownContext.align;
      const isInputGroup = useContext(InputGroupContext);
      const alignClasses = [];
      if (align) {
        if (typeof align === "object") {
          const keys = Object.keys(align);
          if (keys.length) {
            const brkPoint = keys[0];
            const direction = align[brkPoint];
            alignEnd = direction === "start";
            alignClasses.push(`${prefix}-${brkPoint}-${direction}`);
          }
        } else if (align === "end") {
          alignEnd = true;
        }
      }
      const [menuProps, menuMeta] = useDropdownMenu({
        get flip() {
          return local.flip;
        },
        get rootCloseEvent() {
          return local.rootCloseEvent;
        },
        get show() {
          return local.show;
        },
        get usePopper() {
          return !isNavbar && alignClasses.length === 0;
        },
        get offset() {
          return [0, 2];
        },
        get popperConfig() {
          return local.popperConfig;
        },
        get placement() {
          return getDropdownMenuPlacement(alignEnd, dropdownContext.drop, dropdownContext.isRTL);
        }
      });
      const mergedRef = (ref) => {
        menuProps.ref?.(ref);
        local.ref?.(ref);
      };
      const extendedMenuProps = mergeProps(
        menuProps,
        // For custom components provide additional, non-DOM, props;
        typeof local.as !== "string" ? {
          get show() {
            return menuMeta.show;
          },
          get close() {
            return () => menuMeta.toggle?.(false);
          },
          get align() {
            return align;
          }
        } : {}
      );
      const style4 = () => menuMeta.popper?.placement ? {
        ...props.style,
        ...menuProps.style
      } : props.style;
      return createComponent(Show, {
        get when() {
          return menuMeta.hasShown || local.renderOnMount || isInputGroup;
        },
        get children() {
          return createComponent(Dynamic, mergeProps({
            get component() {
              return local.as;
            }
          }, props, extendedMenuProps, {
            ref: mergedRef,
            get style() {
              return style4();
            }
          }, () => alignClasses.length || isNavbar ? {
            "data-bs-popper": "static"
          } : {}, {
            get ["class"]() {
              return classNames(local.class, prefix, menuMeta.show && "show", alignEnd && `${prefix}-end`, local.variant && `${prefix}-${local.variant}`, ...alignClasses);
            }
          }));
        }
      });
    };
    DropdownMenu$1 = DropdownMenu2;
    defaultProps$Q = {
      as: Button$12
    };
    DropdownToggle2 = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$Q, p), ["as", "bsPrefix", "split", "class", "childBsPrefix", "ref"]);
      const prefix = useBootstrapPrefix(local.bsPrefix, "dropdown-toggle");
      const dropdownContext = useContext(DropdownContext$1);
      const isInputGroup = useContext(InputGroupContext);
      if (local.childBsPrefix !== void 0) {
        props.bsPrefix = local.childBsPrefix;
      }
      const [toggleProps] = useDropdownToggle();
      const [toggleLocal, toggleOther] = splitProps(toggleProps, ["ref"]);
      const mergedRef = (ref) => {
        toggleLocal.ref?.(ref);
        local.ref?.(ref);
      };
      return createComponent(Dynamic, mergeProps({
        get component() {
          return local.as;
        },
        get ["class"]() {
          return classNames(local.class, prefix, local.split && `${prefix}-split`, !!isInputGroup && dropdownContext?.show && "show");
        }
      }, toggleOther, props, {
        ref: mergedRef
      }));
    };
    DropdownToggle$1 = DropdownToggle2;
    DropdownHeader = createWithBsPrefix("dropdown-header", {
      defaultProps: {
        role: "heading"
      }
    });
    DropdownDivider = createWithBsPrefix("dropdown-divider", {
      Component: "hr",
      defaultProps: {
        role: "separator"
      }
    });
    DropdownItemText = createWithBsPrefix("dropdown-item-text", {
      Component: "span"
    });
    defaultProps$P = {
      as: "div",
      navbar: false,
      align: "start",
      autoClose: true
    };
    Dropdown2 = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$P, p), ["as", "bsPrefix", "drop", "show", "defaultShow", "class", "align", "onSelect", "onToggle", "focusFirstItemOnShow", "navbar", "autoClose"]);
      const [show, onToggle] = createControlledProp(() => local.show, () => local.defaultShow, local.onToggle);
      const isInputGroup = useContext(InputGroupContext);
      const prefix = useBootstrapPrefix(local.bsPrefix, "dropdown");
      const isRTL = useIsRTL();
      const isClosingPermitted = (source) => {
        if (local.autoClose === false) return source === "click";
        if (local.autoClose === "inside") return source !== "rootClose";
        if (local.autoClose === "outside") return source !== "select";
        return true;
      };
      const handleToggle = (nextShow, meta) => {
        if (
          // null option below is for "bug?" in Solid returning null instead of document
          (meta.originalEvent.currentTarget === document || meta.originalEvent.currentTarget === null) && (meta.source !== "keydown" || meta.originalEvent.key === "Escape")
        ) {
          meta.source = "rootClose";
        }
        if (isClosingPermitted(meta.source)) onToggle?.(nextShow, meta);
      };
      const alignEnd = local.align === "end";
      const placement = getDropdownMenuPlacement(alignEnd, local.drop, isRTL());
      const contextValue = {
        get align() {
          return local.align;
        },
        get drop() {
          return local.drop;
        },
        get isRTL() {
          return isRTL();
        }
      };
      return createComponent(DropdownContext$12.Provider, {
        value: contextValue,
        get children() {
          return createComponent(Dropdown, {
            placement,
            get show() {
              return show();
            },
            get onSelect() {
              return local.onSelect;
            },
            onToggle: handleToggle,
            get focusFirstItemOnShow() {
              return local.focusFirstItemOnShow;
            },
            itemSelector: `.${prefix}-item:not(.disabled):not(:disabled)`,
            get children() {
              return isInputGroup ? props.children : createComponent(Dynamic, mergeProps({
                get component() {
                  return local.as;
                }
              }, props, {
                get ["class"]() {
                  return classNames(local.class, show() && "show", (!local.drop || local.drop === "down") && prefix, local.drop === "up" && "dropup", local.drop === "end" && "dropend", local.drop === "start" && "dropstart");
                }
              }));
            }
          });
        }
      });
    };
    Dropdown$1 = Object.assign(Dropdown2, {
      Toggle: DropdownToggle$1,
      Menu: DropdownMenu$1,
      Item: DropdownItem$12,
      ItemText: DropdownItemText,
      Divider: DropdownDivider,
      Header: DropdownHeader
    });
    defaultProps$N = {
      as: "div",
      type: "valid",
      tooltip: false
    };
    Feedback = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$N, p), ["as", "class", "type", "tooltip"]);
      return createComponent(Dynamic, mergeProps({
        get component() {
          return local.as;
        }
      }, props, {
        get ["class"]() {
          return classNames(local.class, `${local.type}-${local.tooltip ? "tooltip" : "feedback"}`);
        }
      }));
    };
    Feedback$1 = Feedback;
    _tmpl$$l = /* @__PURE__ */ template(`<img>`, 1);
    defaultProps$M = {
      fluid: false,
      rounded: false,
      roundedCircle: false,
      thumbnail: false
    };
    Image = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$M, p), ["bsPrefix", "class", "fluid", "rounded", "roundedCircle", "thumbnail"]);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "img");
      return (() => {
        const _el$ = _tmpl$$l.cloneNode(true);
        spread(_el$, mergeProps(props, {
          get ["class"]() {
            return classNames(local.class, local.fluid && `${bsPrefix}-fluid`, local.rounded && `rounded`, local.roundedCircle && `rounded-circle`, local.thumbnail && `${bsPrefix}-thumbnail`);
          }
        }), false, false);
        return _el$;
      })();
    };
    Image$1 = Image;
    defaultProps$L = {
      fluid: true
    };
    FigureImage = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$L, p), ["class"]);
      return createComponent(Image$1, mergeProps(props, {
        get ["class"]() {
          return classNames(local.class, "figure-img");
        }
      }));
    };
    FigureImage$1 = FigureImage;
    FigureCaption = createWithBsPrefix("figure-caption", {
      Component: "figcaption"
    });
    FigureCaption$1 = FigureCaption;
    Figure = createWithBsPrefix("figure", {
      Component: "figure"
    });
    Figure$1 = Object.assign(Figure, {
      Image: FigureImage$1,
      Caption: FigureCaption$1
    });
    FormContext = createContext({});
    FormContext$1 = FormContext;
    defaultProps$K = {
      as: "div"
    };
    FormGroup = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$K, p), ["as", "controlId"]);
      const context2 = {
        get controlId() {
          return local.controlId;
        }
      };
      return createComponent(FormContext$1.Provider, {
        value: context2,
        get children() {
          return createComponent(Dynamic, mergeProps({
            get component() {
              return local.as;
            }
          }, props));
        }
      });
    };
    FormGroup$1 = FormGroup;
    _tmpl$$k = /* @__PURE__ */ template(`<label></label>`, 2);
    defaultProps$J = {};
    FloatingLabel = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$J, p), ["bsPrefix", "class", "children", "controlId", "label"]);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "form-floating");
      return createComponent(FormGroup$1, mergeProps({
        get ["class"]() {
          return classNames(local.class, bsPrefix);
        },
        get controlId() {
          return local.controlId;
        }
      }, props, {
        get children() {
          return [memo(() => local.children), (() => {
            const _el$ = _tmpl$$k.cloneNode(true);
            insert(_el$, () => local.label);
            createRenderEffect(() => setAttribute(_el$, "for", local.controlId));
            return _el$;
          })()];
        }
      }));
    };
    FloatingLabel$1 = FloatingLabel;
    defaultProps$I = {
      as: "input",
      type: "checkbox",
      isValid: false,
      isInvalid: false
    };
    FormCheckInput = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$I, p), ["as", "id", "bsPrefix", "class", "type", "isValid", "isInvalid"]);
      const formContext = useContext(FormContext$1);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "form-check-input");
      return createComponent(Dynamic, mergeProps({
        get component() {
          return local.as;
        }
      }, props, {
        get type() {
          return local.type;
        },
        get id() {
          return local.id || formContext.controlId;
        },
        get ["class"]() {
          return classNames(local.class, bsPrefix, local.isValid && "is-valid", local.isInvalid && "is-invalid");
        }
      }));
    };
    FormCheckInput$1 = FormCheckInput;
    FormCheckContext = createContext();
    FormCheckContext$1 = FormCheckContext;
    _tmpl$$j = /* @__PURE__ */ template(`<label></label>`, 2);
    defaultProps$H = {};
    FormCheckLabel = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$H, p), ["bsPrefix", "class", "for"]);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "form-check-label");
      const formContext = useContext(FormContext$1);
      const formCheckContext = useContext(FormCheckContext$1);
      formCheckContext?.setHasFormCheckLabel?.(true);
      return (() => {
        const _el$ = _tmpl$$j.cloneNode(true);
        spread(_el$, mergeProps(props, {
          get ["for"]() {
            return local.for || formContext.controlId;
          },
          get ["class"]() {
            return classNames(local.class, bsPrefix);
          }
        }), false, false);
        return _el$;
      })();
    };
    FormCheckLabel$1 = FormCheckLabel;
    _tmpl$$i = /* @__PURE__ */ template(`<div></div>`, 2);
    defaultProps$G = {
      as: "input",
      title: "",
      type: "checkbox",
      inline: false,
      disabled: false,
      isValid: false,
      isInvalid: false,
      feedbackTooltip: false
    };
    FormCheck = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$G, p), ["as", "id", "bsPrefix", "bsSwitchPrefix", "inline", "disabled", "isValid", "isInvalid", "feedbackTooltip", "feedback", "feedbackType", "class", "style", "title", "type", "label", "children"]);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "form-check");
      const bsSwitchPrefix = useBootstrapPrefix(local.bsSwitchPrefix, "form-switch");
      const [hasFormCheckLabel, setHasFormCheckLabel] = createSignal(false);
      const formContext = useContext(FormContext$1);
      const innerFormContext = {
        get controlId() {
          return local.id || formContext.controlId;
        }
      };
      const resolvedChildren = children(() => local.children);
      const hasLabel = createMemo(() => local.label != null && local.label !== false && !resolvedChildren() || hasFormCheckLabel());
      return createComponent(FormContext$1.Provider, {
        value: innerFormContext,
        get children() {
          return createComponent(FormCheckContext$1.Provider, {
            value: {
              setHasFormCheckLabel
            },
            get children() {
              const _el$ = _tmpl$$i.cloneNode(true);
              insert(_el$, () => resolvedChildren() || [createComponent(FormCheckInput$1, mergeProps(props, {
                get type() {
                  return local.type === "switch" ? "checkbox" : local.type;
                },
                get isValid() {
                  return local.isValid;
                },
                get isInvalid() {
                  return local.isInvalid;
                },
                get disabled() {
                  return local.disabled;
                },
                get as() {
                  return local.as;
                }
              })), memo((() => {
                const _c$ = memo(() => !!hasLabel());
                return () => _c$() && createComponent(FormCheckLabel$1, {
                  get title() {
                    return local.title;
                  },
                  get children() {
                    return local.label;
                  }
                });
              })()), memo((() => {
                const _c$2 = memo(() => !!local.feedback);
                return () => _c$2() && createComponent(Feedback$1, {
                  get type() {
                    return local.feedbackType;
                  },
                  get tooltip() {
                    return local.feedbackTooltip;
                  },
                  get children() {
                    return local.feedback;
                  }
                });
              })())]);
              createRenderEffect((_p$) => {
                const _v$ = local.style, _v$2 = classNames(local.class, hasLabel() && bsPrefix, local.inline && `${bsPrefix}-inline`, local.type === "switch" && bsSwitchPrefix);
                _p$._v$ = style(_el$, _v$, _p$._v$);
                _v$2 !== _p$._v$2 && className(_el$, _p$._v$2 = _v$2);
                return _p$;
              }, {
                _v$: void 0,
                _v$2: void 0
              });
              return _el$;
            }
          });
        }
      });
    };
    FormCheck$1 = Object.assign(FormCheck, {
      Input: FormCheckInput$1,
      Label: FormCheckLabel$1
    });
    defaultProps$F = {
      as: "input",
      isValid: false,
      isInvalid: false
    };
    FormControl = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$F, p), ["as", "bsPrefix", "type", "size", "htmlSize", "id", "class", "isValid", "isInvalid", "plaintext", "readOnly"]);
      const formContext = useContext(FormContext$1);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "form-control");
      const classes = () => {
        let classes2;
        if (local.plaintext) {
          classes2 = {
            [`${bsPrefix}-plaintext`]: true
          };
        } else {
          classes2 = {
            [bsPrefix]: true,
            [`${bsPrefix}-${local.size}`]: local.size
          };
        }
        return classes2;
      };
      return createComponent(Dynamic, mergeProps({
        get component() {
          return local.as;
        }
      }, props, {
        get type() {
          return local.type;
        },
        get size() {
          return local.htmlSize;
        },
        get readOnly() {
          return local.readOnly;
        },
        get id() {
          return local.id || formContext.controlId;
        },
        get ["class"]() {
          return classNames(classes(), local.isValid && `is-valid`, local.isInvalid && `is-invalid`, local.type === "color" && `${bsPrefix}-color`);
        }
      }));
    };
    FormControl$1 = Object.assign(FormControl, {
      Feedback: Feedback$1
    });
    FormFloating = createWithBsPrefix("form-floating");
    defaultProps$E = {
      as: "label",
      column: false,
      visuallyHidden: false
    };
    FormLabel = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$E, p), ["as", "bsPrefix", "column", "visuallyHidden", "class", "htmlFor"]);
      const formContext = useContext(FormContext$1);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "form-label");
      let columnClass = "col-form-label";
      if (typeof local.column === "string") columnClass = `${columnClass} ${columnClass}-${local.column}`;
      const classes = () => classNames(local.class, bsPrefix, local.visuallyHidden && "visually-hidden", local.column && columnClass);
      return !!local.column ? createComponent(Col$1, mergeProps({
        as: "label",
        get ["class"]() {
          return classes();
        },
        get htmlFor() {
          return local.htmlFor || formContext.controlId;
        }
      }, props)) : createComponent(Dynamic, mergeProps({
        get component() {
          return local.as;
        },
        get ["class"]() {
          return classes();
        },
        get htmlFor() {
          return local.htmlFor || formContext.controlId;
        }
      }, props));
    };
    FormLabel$1 = FormLabel;
    _tmpl$$h = /* @__PURE__ */ template(`<input>`, 1);
    defaultProps$D = {
      as: "img"
    };
    FormRange = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$D, p), ["bsPrefix", "class", "id"]);
      const formContext = useContext(FormContext$1);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "form-range");
      return (() => {
        const _el$ = _tmpl$$h.cloneNode(true);
        spread(_el$, mergeProps(props, {
          "type": "range",
          get ["class"]() {
            return classNames(local.class, bsPrefix);
          },
          get id() {
            return local.id || formContext.controlId;
          }
        }), false, false);
        return _el$;
      })();
    };
    FormRange$1 = FormRange;
    _tmpl$$g = /* @__PURE__ */ template(`<select></select>`, 2);
    defaultProps$C = {
      isValid: false,
      isInvalid: false
    };
    FormSelect = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$C, p), ["bsPrefix", "size", "htmlSize", "class", "isValid", "isInvalid", "id"]);
      const formContext = useContext(FormContext$1);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "form-select");
      return (() => {
        const _el$ = _tmpl$$g.cloneNode(true);
        spread(_el$, mergeProps(props, {
          get size() {
            return local.htmlSize;
          },
          get ["class"]() {
            return classNames(local.class, bsPrefix, local.size && `${bsPrefix}-${local.size}`, local.isValid && `is-valid`, local.isInvalid && `is-invalid`);
          },
          get id() {
            return local.id || formContext.controlId;
          }
        }), false, false);
        return _el$;
      })();
    };
    FormSelect$1 = FormSelect;
    defaultProps$B = {
      as: "small"
    };
    FormText = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$B, p), ["as", "bsPrefix", "class", "muted"]);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "form-text");
      return createComponent(Dynamic, mergeProps({
        get component() {
          return local.as;
        }
      }, props, {
        get ["class"]() {
          return classNames(local.class, bsPrefix, local.muted && "text-muted");
        }
      }));
    };
    FormText$1 = FormText;
    Switch2 = (props) => createComponent(FormCheck$1, mergeProps(props, {
      type: "switch"
    }));
    Switch$1 = Object.assign(Switch2, {
      Input: FormCheck$1.Input,
      Label: FormCheck$1.Label
    });
    defaultProps$A = {
      as: "form"
    };
    Form = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$A, p), ["as", "class", "validated"]);
      return createComponent(Dynamic, mergeProps({
        get component() {
          return local.as;
        }
      }, props, {
        get ["class"]() {
          return classNames(local.class, local.validated && "was-validated");
        }
      }));
    };
    Form$1 = Object.assign(Form, {
      Group: FormGroup$1,
      Control: FormControl$1,
      Floating: FormFloating,
      Check: FormCheck$1,
      Switch: Switch$1,
      Label: FormLabel$1,
      Text: FormText$1,
      Range: FormRange$1,
      Select: FormSelect$1,
      FloatingLabel: FloatingLabel$1
    });
    InputGroupText = createWithBsPrefix("input-group-text", {
      Component: "span"
    });
    InputGroupCheckbox = (props) => createComponent(InputGroupText, {
      get children() {
        return createComponent(FormCheckInput$1, mergeProps({
          type: "checkbox"
        }, props));
      }
    });
    InputGroupRadio = (props) => createComponent(InputGroupText, {
      get children() {
        return createComponent(FormCheckInput$1, mergeProps({
          type: "radio"
        }, props));
      }
    });
    defaultProps$z = {
      as: "div"
    };
    InputGroup = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$z, p), ["as", "bsPrefix", "size", "hasValidation", "class"]);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "input-group");
      const contextValue = {};
      return createComponent(InputGroupContext.Provider, {
        value: contextValue,
        get children() {
          return createComponent(Dynamic, mergeProps({
            get component() {
              return local.as;
            }
          }, props, {
            get ["class"]() {
              return classNames(local.class, bsPrefix, local.size && `${bsPrefix}-${local.size}`, local.hasValidation && "has-validation");
            }
          }));
        }
      });
    };
    InputGroup$1 = Object.assign(InputGroup, {
      Text: InputGroupText,
      Radio: InputGroupRadio,
      Checkbox: InputGroupCheckbox
    });
    defaultProps$y = {};
    ListGroupItem = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$y, p), ["as", "bsPrefix", "active", "disabled", "eventKey", "class", "variant", "action"]);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "list-group-item");
      const [navItemProps, meta] = useNavItem(mergeProps({
        get key() {
          return makeEventKey(local.eventKey, props.href);
        },
        get active() {
          return local.active;
        }
      }, props));
      const handleClick = createMemo(() => (event) => {
        if (local.disabled) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        navItemProps.onClick(event);
      });
      const disabledProps = () => local.disabled && props.tabIndex === void 0 ? {
        tabIndex: -1,
        ["aria-disabled"]: true
      } : {};
      return createComponent(Dynamic, mergeProps({
        get component() {
          return local.as || (local.action ? props.href ? "a" : "button" : "div");
        }
      }, props, navItemProps, disabledProps, {
        get onClick() {
          return handleClick();
        },
        get ["class"]() {
          return classNames(local.class, bsPrefix, meta.isActive && "active", local.disabled && "disabled", local.variant && `${bsPrefix}-${local.variant}`, local.action && `${bsPrefix}-action`);
        }
      }));
    };
    ListGroupItem$1 = ListGroupItem;
    defaultProps$x = {
      as: "div"
    };
    ListGroup = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$x, p), ["as", "activeKey", "defaultActiveKey", "bsPrefix", "class", "variant", "horizontal", "numbered", "onSelect"]);
      const [activeKey, onSelect] = createControlledProp(() => local.activeKey, () => local.defaultActiveKey, local.onSelect);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "list-group");
      let horizontalVariant;
      if (local.horizontal) {
        horizontalVariant = local.horizontal === true ? "horizontal" : `horizontal-${local.horizontal}`;
      }
      return createComponent(Nav$1, mergeProps({
        get as() {
          return local.as;
        }
      }, props, {
        get activeKey() {
          return activeKey();
        },
        onSelect,
        get ["class"]() {
          return classNames(local.class, bsPrefix, local.variant && `${bsPrefix}-${local.variant}`, horizontalVariant && `${bsPrefix}-${horizontalVariant}`, local.numbered && `${bsPrefix}-numbered`);
        }
      }));
    };
    ListGroup$1 = Object.assign(ListGroup, {
      Item: ListGroupItem$1
    });
    ModalBody = createWithBsPrefix("modal-body");
    ModalContext = createContext({
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      onHide() {
      }
    });
    ModalContext$1 = ModalContext;
    _tmpl$$f = /* @__PURE__ */ template(`<div><div></div></div>`, 4);
    defaultProps$w = {};
    ModalDialog = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$w, p), ["bsPrefix", "class", "contentClass", "centered", "size", "fullscreen", "children", "scrollable"]);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "modal");
      const dialogClass = `${bsPrefix}-dialog`;
      const fullScreenClass = typeof local.fullscreen === "string" ? `${bsPrefix}-fullscreen-${local.fullscreen}` : `${bsPrefix}-fullscreen`;
      return (() => {
        const _el$ = _tmpl$$f.cloneNode(true), _el$2 = _el$.firstChild;
        spread(_el$, mergeProps(props, {
          get ["class"]() {
            return classNames(dialogClass, local.class, local.size && `${bsPrefix}-${local.size}`, local.centered && `${dialogClass}-centered`, local.scrollable && `${dialogClass}-scrollable`, local.fullscreen && fullScreenClass);
          }
        }), false, true);
        insert(_el$2, () => local.children);
        createRenderEffect(() => className(_el$2, classNames(`${bsPrefix}-content`, local.contentClass, local.contentClass)));
        return _el$;
      })();
    };
    ModalDialog$1 = ModalDialog;
    ModalFooter = createWithBsPrefix("modal-footer");
    _tmpl$$e = /* @__PURE__ */ template(`<div></div>`, 2);
    defaultProps$v = {
      closeLabel: "Close",
      closeButton: false
    };
    AbstractModalHeader = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$v, p), ["closeLabel", "closeVariant", "closeButton", "onHide", "children"]);
      const context2 = useContext(ModalContext$1);
      const handleClick = () => {
        context2?.onHide();
        local.onHide?.();
      };
      return (() => {
        const _el$ = _tmpl$$e.cloneNode(true);
        spread(_el$, props, false, true);
        insert(_el$, () => local.children, null);
        insert(_el$, (() => {
          const _c$ = memo(() => !!local.closeButton);
          return () => _c$() && createComponent(CloseButton$1, {
            get ["aria-label"]() {
              return local.closeLabel;
            },
            get variant() {
              return local.closeVariant;
            },
            onClick: handleClick
          });
        })(), null);
        return _el$;
      })();
    };
    AbstractModalHeader$1 = AbstractModalHeader;
    defaultProps$u = {
      closeLabel: "Close",
      closeButton: false
    };
    ModalHeader = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$u, p), ["bsPrefix", "class"]);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "modal-header");
      return createComponent(AbstractModalHeader$1, mergeProps(props, {
        get ["class"]() {
          return classNames(local.class, bsPrefix);
        }
      }));
    };
    ModalHeader$1 = ModalHeader;
    DivStyledAsH4 = divWithClass("h4");
    ModalTitle = createWithBsPrefix("modal-title", {
      Component: DivStyledAsH4
    });
    _tmpl$$d = /* @__PURE__ */ template(`<div></div>`, 2);
    _tmpl$2$4 = /* @__PURE__ */ template(`<div role="dialog"></div>`, 2);
    defaultProps$t = {
      show: false,
      backdrop: true,
      keyboard: true,
      autoFocus: true,
      enforceFocus: true,
      restoreFocus: true,
      animation: true,
      dialogAs: ModalDialog$1
    };
    Modal2 = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$t, p), [
        "bsPrefix",
        "class",
        "style",
        "dialogClass",
        "contentClass",
        "children",
        "dialogAs",
        "aria-labelledby",
        /* BaseModal props */
        "show",
        "animation",
        "backdrop",
        "keyboard",
        "onEscapeKeyDown",
        "onShow",
        "onHide",
        "container",
        "autoFocus",
        "enforceFocus",
        "restoreFocus",
        "restoreFocusOptions",
        "onEntered",
        "onExit",
        "onExiting",
        "onEnter",
        "onEntering",
        "onExited",
        "backdropClass",
        "manager"
      ]);
      const [modalStyle, setStyle] = createSignal({});
      const [animateStaticModal, setAnimateStaticModal] = createSignal(false);
      let waitingForMouseUpRef = false;
      let ignoreBackdropClickRef = false;
      let removeStaticModalAnimationRef = null;
      let modal;
      const isRTL = useIsRTL();
      const mergedRef = (ref) => {
        modal = ref;
        props.ref?.(ref);
      };
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "modal");
      const modalContext = {
        get onHide() {
          return local.onHide;
        }
      };
      function getModalManager() {
        if (local.manager) return local.manager;
        return getSharedManager({
          isRTL: isRTL()
        });
      }
      function updateDialogStyle(node) {
        if (!canUseDOM2) return;
        const containerIsOverflowing = getModalManager().getScrollbarWidth() > 0;
        const modalIsOverflowing = node.scrollHeight > ownerDocument2(node).documentElement.clientHeight;
        setStyle({
          paddingRight: containerIsOverflowing && !modalIsOverflowing ? scrollbarSize() : void 0,
          paddingLeft: !containerIsOverflowing && modalIsOverflowing ? scrollbarSize() : void 0
        });
      }
      const handleWindowResize = () => {
        if (modal) {
          updateDialogStyle(modal.dialog);
        }
      };
      onCleanup(() => {
        if (!isServer) {
          removeEventListener2(window, "resize", handleWindowResize);
        }
        removeStaticModalAnimationRef?.();
      });
      const handleDialogMouseDown = () => {
        waitingForMouseUpRef = true;
      };
      const handleMouseUp = (e) => {
        if (waitingForMouseUpRef && modal && e.target === modal.dialog) {
          ignoreBackdropClickRef = true;
        }
        waitingForMouseUpRef = false;
      };
      const handleStaticModalAnimation = () => {
        setAnimateStaticModal(true);
        removeStaticModalAnimationRef = transitionEnd(modal.dialog, () => {
          setAnimateStaticModal(false);
        });
      };
      const handleStaticBackdropClick = (e) => {
        if (e.target !== e.currentTarget) {
          return;
        }
        handleStaticModalAnimation();
      };
      const handleClick = (e) => {
        if (local.backdrop === "static") {
          handleStaticBackdropClick(e);
          return;
        }
        if (ignoreBackdropClickRef || e.target !== e.currentTarget) {
          ignoreBackdropClickRef = false;
          return;
        }
        local.onHide?.();
      };
      const handleEscapeKeyDown = (e) => {
        if (!local.keyboard && local.backdrop === "static") {
          e.preventDefault();
          handleStaticModalAnimation();
        } else if (local.keyboard && local.onEscapeKeyDown) {
          local.onEscapeKeyDown(e);
        }
      };
      const handleEnter = (node, ...args) => {
        if (node) {
          node.style.display = "block";
          updateDialogStyle(node);
        }
        local.onEnter?.(node, ...args);
      };
      const handleExit = (...args) => {
        removeStaticModalAnimationRef?.();
        local.onExit?.(...args);
      };
      const handleEntering = (...args) => {
        local.onEntering?.(...args);
        if (!isServer) {
          addEventListener3(window, "resize", handleWindowResize);
        }
      };
      const handleExited = (node) => {
        if (node) node.style.display = "";
        local.onExited?.(node);
        if (!isServer) {
          removeEventListener2(window, "resize", handleWindowResize);
        }
      };
      const renderBackdrop = (backdropProps) => (() => {
        const _el$ = _tmpl$$d.cloneNode(true);
        spread(_el$, mergeProps(backdropProps, {
          get ["class"]() {
            return classNames(`${bsPrefix}-backdrop`, local.backdropClass, !local.animation && "show");
          }
        }), false, false);
        return _el$;
      })();
      const baseModalStyle = () => {
        let s = {
          ...local.style,
          ...modalStyle()
        };
        if (!local.animation) {
          s.display = "block";
        }
        return s;
      };
      const renderDialog = (dialogProps) => (() => {
        const _el$2 = _tmpl$2$4.cloneNode(true);
        spread(_el$2, mergeProps(dialogProps, {
          get style() {
            return baseModalStyle();
          },
          get ["class"]() {
            return classNames(local.class, bsPrefix, animateStaticModal() && `${bsPrefix}-static`);
          },
          get onClick() {
            return local.backdrop ? handleClick : void 0;
          },
          "onMouseUp": handleMouseUp,
          get ["aria-labelledby"]() {
            return local["aria-labelledby"];
          }
        }), false, true);
        insert(_el$2, createComponent(Dynamic, mergeProps({
          get component() {
            return local.dialogAs;
          }
        }, props, {
          onMouseDown: handleDialogMouseDown,
          get ["class"]() {
            return local.dialogClass;
          },
          get contentClass() {
            return local.contentClass;
          },
          get children() {
            return local.children;
          }
        })));
        return _el$2;
      })();
      return createComponent(ModalContext$1.Provider, {
        value: modalContext,
        get children() {
          return createComponent(Modal$1, {
            get show() {
              return local.show;
            },
            ref: mergedRef,
            get backdrop() {
              return local.backdrop;
            },
            get container() {
              return local.container;
            },
            keyboard: true,
            get autoFocus() {
              return local.autoFocus;
            },
            get enforceFocus() {
              return local.enforceFocus;
            },
            get restoreFocus() {
              return local.restoreFocus;
            },
            get restoreFocusOptions() {
              return local.restoreFocusOptions;
            },
            onEscapeKeyDown: handleEscapeKeyDown,
            get onShow() {
              return local.onShow;
            },
            get onHide() {
              return local.onHide;
            },
            onEnter: handleEnter,
            onEntering: handleEntering,
            get onEntered() {
              return local.onEntered;
            },
            onExit: handleExit,
            get onExiting() {
              return local.onExiting;
            },
            onExited: handleExited,
            get manager() {
              return getModalManager();
            },
            get transition() {
              return local.animation ? DialogTransition$1 : void 0;
            },
            get backdropTransition() {
              return local.animation ? BackdropTransition$1 : void 0;
            },
            renderBackdrop,
            renderDialog
          });
        }
      });
    };
    Modal$12 = Object.assign(Modal2, {
      Body: ModalBody,
      Header: ModalHeader$1,
      Title: ModalTitle,
      Footer: ModalFooter,
      Dialog: ModalDialog$1,
      TRANSITION_DURATION: 300,
      BACKDROP_TRANSITION_DURATION: 150
    });
    NavItem2 = createWithBsPrefix("nav-item");
    defaultProps$s = {
      as: Anchor$1,
      disabled: false
    };
    NavLink = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$s, p), ["as", "bsPrefix", "class", "active", "eventKey"]);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "nav-link");
      const [navItemProps, meta] = useNavItem(mergeProps({
        get key() {
          return makeEventKey(local.eventKey, props.href);
        },
        get active() {
          return local.active;
        }
      }, props));
      return createComponent(Dynamic, mergeProps({
        get component() {
          return local.as;
        }
      }, props, navItemProps, {
        get ["class"]() {
          return classNames(local.class, bsPrefix, props.disabled && "disabled", meta.isActive && "active");
        }
      }));
    };
    NavLink$1 = NavLink;
    defaultProps$r = {
      as: "div",
      justify: false,
      fill: false
    };
    Nav2 = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$r, p), ["as", "activeKey", "defaultActiveKey", "bsPrefix", "variant", "fill", "justify", "navbar", "navbarScroll", "class", "onSelect"]);
      const [activeKey, onSelect] = createControlledProp(() => local.activeKey, () => local.defaultActiveKey, local.onSelect);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "nav");
      let navbarBsPrefix;
      let cardHeaderBsPrefix;
      let isNavbar = false;
      const navbarContext = useContext(NavbarContext);
      const cardHeaderContext = useContext(CardHeaderContext);
      if (navbarContext) {
        navbarBsPrefix = navbarContext.bsPrefix;
        isNavbar = local.navbar == null ? true : local.navbar;
      } else if (cardHeaderContext) {
        ({
          cardHeaderBsPrefix
        } = cardHeaderContext);
      }
      return createComponent(Nav$1, mergeProps({
        get as() {
          return local.as;
        },
        get activeKey() {
          return activeKey();
        },
        onSelect,
        get ["class"]() {
          return classNames(local.class, {
            [bsPrefix]: !isNavbar,
            [`${navbarBsPrefix}-nav`]: isNavbar,
            [`${navbarBsPrefix}-nav-scroll`]: isNavbar && local.navbarScroll,
            [`${cardHeaderBsPrefix}-${local.variant}`]: !!cardHeaderBsPrefix,
            [`${bsPrefix}-${local.variant}`]: !!local.variant,
            [`${bsPrefix}-fill`]: local.fill,
            [`${bsPrefix}-justified`]: local.justify
          });
        }
      }, props));
    };
    Nav$12 = Object.assign(Nav2, {
      Item: NavItem2,
      Link: NavLink$1
    });
    defaultProps$q = {};
    NavbarBrand = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$q, p), ["as", "bsPrefix", "class"]);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "navbar-brand");
      return createComponent(Dynamic, mergeProps({
        get component() {
          return local.as || (props.href ? "a" : "span");
        }
      }, props, {
        get ["class"]() {
          return classNames(local.class, bsPrefix);
        }
      }));
    };
    NavbarBrand$1 = NavbarBrand;
    _tmpl$$c = /* @__PURE__ */ template(`<div></div>`, 2);
    defaultProps$p = {};
    NavbarCollapse = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$p, p), ["bsPrefix", "class", "children", "ref"]);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "navbar-collapse");
      const context2 = useContext(NavbarContext);
      return createComponent(Collapse$1, mergeProps({
        get ["in"]() {
          return !!context2?.expanded;
        }
      }, props, {
        get children() {
          const _el$ = _tmpl$$c.cloneNode(true);
          const _ref$ = local.ref;
          typeof _ref$ === "function" ? use(_ref$, _el$) : local.ref = _el$;
          insert(_el$, () => local.children);
          createRenderEffect(() => className(_el$, classNames(bsPrefix, local.class)));
          return _el$;
        }
      }));
    };
    NavbarCollapse$1 = NavbarCollapse;
    _tmpl$$b = /* @__PURE__ */ template(`<span></span>`, 2);
    defaultProps$o = {
      as: "button",
      label: "Toggle navigation"
    };
    NavbarToggle = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$o, p), ["as", "bsPrefix", "class", "children", "label", "onClick"]);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "navbar-toggler");
      const context2 = useContext(NavbarContext);
      const handleClick = (e) => {
        callEventHandler(local.onClick, e);
        context2?.onToggle?.();
      };
      if (local.as === "button") {
        props.type = "button";
      }
      return createComponent(Dynamic, mergeProps({
        get component() {
          return local.as;
        }
      }, props, {
        get type() {
          return local.as === "button" ? "button" : void 0;
        },
        onClick: handleClick,
        get ["aria-label"]() {
          return local.label;
        },
        get ["class"]() {
          return classNames(local.class, bsPrefix, !context2?.expanded && "collapsed");
        },
        get children() {
          return local.children || (() => {
            const _el$ = _tmpl$$b.cloneNode(true);
            className(_el$, `${bsPrefix}-icon`);
            return _el$;
          })();
        }
      }));
    };
    NavbarToggle$1 = NavbarToggle;
    OffcanvasBody = createWithBsPrefix("offcanvas-body");
    defaultProps$n = {
      in: false,
      mountOnEnter: false,
      unmountOnExit: false,
      appear: false
    };
    transitionStyles = {
      [ENTERING]: "show",
      [ENTERED]: "show"
    };
    OffcanvasToggling = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$n, p), ["bsPrefix", "class", "children"]);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "offcanvas");
      const resolvedChildren = children(() => local.children);
      let prevClasses;
      return createComponent(TransitionWrapper$1, mergeProps({
        addEndListener: transitionEndListener
      }, props, {
        children: (status, innerProps) => {
          const el = resolvedChildren();
          innerProps.ref(el);
          const newClasses = classNames(
            local.class,
            (status === ENTERING || status === EXITING) && `${bsPrefix}-toggling`,
            // @ts-ignore
            transitionStyles[status]
          );
          resolveClasses(el, prevClasses, newClasses);
          prevClasses = newClasses;
          return el;
        }
      }));
    };
    OffcanvasToggling$1 = OffcanvasToggling;
    defaultProps$m = {
      closeLabel: "Close",
      closeButton: false
    };
    OffcanvasHeader = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$m, p), ["bsPrefix", "class"]);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "offcanvas-header");
      return createComponent(AbstractModalHeader$1, mergeProps(props, {
        get ["class"]() {
          return classNames(local.class, bsPrefix);
        }
      }));
    };
    OffcanvasHeader$1 = OffcanvasHeader;
    DivStyledAsH5 = divWithClass("h5");
    OffcanvasTitle = createWithBsPrefix("offcanvas-title", {
      Component: DivStyledAsH5
    });
    _tmpl$$a = /* @__PURE__ */ template(`<div></div>`, 2);
    _tmpl$2$3 = /* @__PURE__ */ template(`<div role="dialog"></div>`, 2);
    defaultProps$l = {
      show: false,
      backdrop: true,
      keyboard: true,
      scroll: false,
      autoFocus: true,
      enforceFocus: true,
      restoreFocus: true,
      placement: "start"
    };
    Offcanvas = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$l, p), [
        "bsPrefix",
        "class",
        "children",
        "aria-labelledby",
        "placement",
        /*BaseModal props */
        "show",
        "backdrop",
        "keyboard",
        "scroll",
        "onEscapeKeyDown",
        "onShow",
        "onHide",
        "container",
        "autoFocus",
        "enforceFocus",
        "restoreFocus",
        "restoreFocusOptions",
        "onEntered",
        "onExit",
        "onExiting",
        "onEnter",
        "onEntering",
        "onExited",
        "backdropClass",
        "manager",
        "ref"
      ]);
      let modalManager;
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "offcanvas");
      const navbarContext = useContext(NavbarContext);
      const handleHide = () => {
        navbarContext?.onToggle?.();
        local.onHide?.();
      };
      const modalContext = {
        get onHide() {
          return handleHide;
        }
      };
      function getModalManager() {
        if (local.manager) return local.manager;
        if (local.scroll) {
          if (!modalManager) modalManager = new BootstrapModalManager({
            handleContainerOverflow: false
          });
          return modalManager;
        }
        return getSharedManager();
      }
      const handleEnter = (node, ...args) => {
        if (node) node.style.visibility = "visible";
        local.onEnter?.(node, ...args);
      };
      const handleExited = (node, ...args) => {
        if (node) node.style.visibility = "";
        local.onExited?.(...args);
      };
      const renderBackdrop = (backdropProps) => (() => {
        const _el$ = _tmpl$$a.cloneNode(true);
        spread(_el$, mergeProps(backdropProps, {
          get ["class"]() {
            return classNames(`${bsPrefix}-backdrop`, local.backdropClass);
          }
        }), false, true);
        return _el$;
      })();
      let child;
      const renderDialog = (dialogProps) => {
        if (!child) child = children(() => local.children);
        return (() => {
          const _el$2 = _tmpl$2$3.cloneNode(true);
          spread(_el$2, mergeProps(dialogProps, props, {
            get ["class"]() {
              return classNames(local.class, bsPrefix, `${bsPrefix}-${local.placement}`);
            },
            get ["aria-labelledby"]() {
              return local["aria-labelledby"];
            }
          }), false, true);
          insert(_el$2, child);
          return _el$2;
        })();
      };
      return createComponent(ModalContext$1.Provider, {
        value: modalContext,
        get children() {
          return createComponent(Modal$1, {
            get show() {
              return local.show;
            },
            ref(r$) {
              const _ref$ = local.ref;
              typeof _ref$ === "function" ? _ref$(r$) : local.ref = r$;
            },
            get backdrop() {
              return local.backdrop;
            },
            get container() {
              return local.container;
            },
            get keyboard() {
              return local.keyboard;
            },
            get autoFocus() {
              return local.autoFocus;
            },
            get enforceFocus() {
              return local.enforceFocus && !scroll;
            },
            get restoreFocus() {
              return local.restoreFocus;
            },
            get restoreFocusOptions() {
              return local.restoreFocusOptions;
            },
            get onEscapeKeyDown() {
              return local.onEscapeKeyDown;
            },
            get onShow() {
              return local.onShow;
            },
            onHide: handleHide,
            onEnter: handleEnter,
            get onEntering() {
              return local.onEntering;
            },
            get onEntered() {
              return local.onEntered;
            },
            get onExit() {
              return local.onExit;
            },
            get onExiting() {
              return local.onExiting;
            },
            onExited: handleExited,
            get manager() {
              return getModalManager();
            },
            transition: DialogTransition,
            backdropTransition: BackdropTransition,
            renderBackdrop,
            renderDialog
          });
        }
      });
    };
    Offcanvas$1 = Object.assign(Offcanvas, {
      Body: OffcanvasBody,
      Header: OffcanvasHeader$1,
      Title: OffcanvasTitle
    });
    NavbarOffcanvas = (props) => {
      const context2 = useContext(NavbarContext);
      return createComponent(Offcanvas$1, mergeProps({
        get show() {
          return !!context2?.expanded;
        }
      }, props));
    };
    NavbarOffcanvas$1 = NavbarOffcanvas;
    NavbarText = createWithBsPrefix("navbar-text", {
      Component: "span"
    });
    defaultProps$k = {
      as: "nav",
      expand: true,
      variant: "light",
      collapseOnSelect: false
    };
    Navbar = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$k, p), ["as", "bsPrefix", "expand", "variant", "bg", "fixed", "sticky", "class", "expanded", "defaultExpanded", "onToggle", "onSelect", "collapseOnSelect"]);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "navbar");
      const [expanded, onToggle] = createControlledProp(() => local.expanded, () => local.defaultExpanded, local.onToggle);
      const handleCollapse = (...args) => {
        local.onSelect?.(...args);
        if (local.collapseOnSelect && expanded()) {
          onToggle?.(false);
        }
      };
      const expandClass = () => {
        let expandClass2 = `${bsPrefix}-expand`;
        if (typeof local.expand === "string") expandClass2 = `${expandClass2}-${local.expand}`;
        return expandClass2;
      };
      const navbarContext = {
        get onToggle() {
          return () => onToggle?.(!expanded());
        },
        bsPrefix,
        get expanded() {
          return !!expanded();
        }
      };
      return createComponent(NavbarContext.Provider, {
        value: navbarContext,
        get children() {
          return createComponent(SelectableContext$1.Provider, {
            value: handleCollapse,
            get children() {
              return createComponent(Dynamic, mergeProps({
                get component() {
                  return local.as;
                }
              }, props, {
                get role() {
                  return (
                    // will result in some false positives but that seems better
                    // than false negatives. strict `undefined` check allows explicit
                    // "nulling" of the role if the user really doesn't want one
                    props.role === void 0 && local.as !== "nav" ? "Navigation" : props.role
                  );
                },
                get ["class"]() {
                  return classNames(local.class, bsPrefix, local.expand && expandClass(), local.variant && `${bsPrefix}-${local.variant}`, local.bg && `bg-${local.bg}`, local.sticky && `sticky-${local.sticky}`, local.fixed && `fixed-${local.fixed}`);
                }
              }));
            }
          });
        }
      });
    };
    Navbar$1 = Object.assign(Navbar, {
      Brand: NavbarBrand$1,
      Collapse: NavbarCollapse$1,
      Offcanvas: NavbarOffcanvas$1,
      Text: NavbarText,
      Toggle: NavbarToggle$1
    });
    NavContext2 = createContext(null);
    defaultProps$j = {};
    NavDropdown = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$j, p), ["id", "title", "children", "bsPrefix", "class", "rootCloseEvent", "menuRole", "disabled", "active", "renderMenuOnMount", "menuVariant"]);
      const navItemPrefix = useBootstrapPrefix(void 0, "nav-item");
      return createComponent(Dropdown$1, mergeProps(props, {
        get ["class"]() {
          return classNames(local.class, navItemPrefix);
        },
        get children() {
          return [createComponent(Dropdown$1.Toggle, {
            get id() {
              return local.id;
            },
            eventKey: null,
            get active() {
              return local.active;
            },
            get disabled() {
              return local.disabled;
            },
            get childBsPrefix() {
              return local.bsPrefix;
            },
            as: NavLink$1,
            get children() {
              return local.title;
            }
          }), createComponent(Dropdown$1.Menu, {
            get role() {
              return local.menuRole;
            },
            get renderOnMount() {
              return local.renderMenuOnMount;
            },
            get rootCloseEvent() {
              return local.rootCloseEvent;
            },
            get variant() {
              return local.menuVariant;
            },
            get children() {
              return local.children;
            }
          })];
        }
      }));
    };
    NavDropdown$1 = Object.assign(NavDropdown, {
      Item: Dropdown$1.Item,
      ItemText: Dropdown$1.ItemText,
      Divider: Dropdown$1.Divider,
      Header: Dropdown$1.Header
    });
    _tmpl$$9 = /* @__PURE__ */ template(`<li></li>`, 2);
    _tmpl$2$2 = /* @__PURE__ */ template(`<span class="visually-hidden"></span>`, 2);
    _tmpl$3 = /* @__PURE__ */ template(`<span aria-hidden="true"></span>`, 2);
    defaultProps$g = {
      active: false,
      disabled: false,
      activeLabel: "(current)"
    };
    PageItem = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$g, p), ["active", "disabled", "class", "style", "activeLabel", "children", "ref"]);
      return (() => {
        const _el$ = _tmpl$$9.cloneNode(true);
        const _ref$ = local.ref;
        typeof _ref$ === "function" ? use(_ref$, _el$) : local.ref = _el$;
        insert(_el$, createComponent(Dynamic, mergeProps({
          get component() {
            return local.active || local.disabled ? "span" : Anchor$1;
          },
          "class": "page-link",
          get disabled() {
            return local.disabled;
          }
        }, props, {
          get children() {
            return [memo(() => local.children), memo(() => memo(() => !!(local.active && local.activeLabel))() && (() => {
              const _el$2 = _tmpl$2$2.cloneNode(true);
              insert(_el$2, () => local.activeLabel);
              return _el$2;
            })())];
          }
        })));
        createRenderEffect((_p$) => {
          const _v$ = local.style, _v$2 = classNames(local.class, "page-item", {
            active: local.active,
            disabled: local.disabled
          });
          _p$._v$ = style(_el$, _v$, _p$._v$);
          _v$2 !== _p$._v$2 && className(_el$, _p$._v$2 = _v$2);
          return _p$;
        }, {
          _v$: void 0,
          _v$2: void 0
        });
        return _el$;
      })();
    };
    PageItem$1 = PageItem;
    First = createButton("First", "\xAB");
    Prev = createButton("Prev", "\u2039", "Previous");
    Ellipsis = createButton("Ellipsis", "\u2026", "More");
    Next = createButton("Next", "\u203A");
    Last = createButton("Last", "\xBB");
    _tmpl$$8 = /* @__PURE__ */ template(`<ul></ul>`, 2);
    defaultProps$f = {};
    Pagination = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$f, p), ["bsPrefix", "class", "size"]);
      const decoratedBsPrefix = useBootstrapPrefix(local.bsPrefix, "pagination");
      return (() => {
        const _el$ = _tmpl$$8.cloneNode(true);
        spread(_el$, mergeProps(props, {
          get ["class"]() {
            return classNames(local.class, decoratedBsPrefix, local.size && `${decoratedBsPrefix}-${local.size}`);
          }
        }), false, false);
        return _el$;
      })();
    };
    Pagination$1 = Object.assign(Pagination, {
      First,
      Prev,
      Ellipsis,
      Item: PageItem$1,
      Next,
      Last
    });
    PlaceholderButton = (props) => {
      return createComponent(Button$12, mergeProps(() => usePlaceholder(props), {
        disabled: true,
        tabIndex: -1,
        get children() {
          return props.children;
        }
      }));
    };
    PlaceholderButton$1 = PlaceholderButton;
    defaultProps$e = {
      as: "span"
    };
    Placeholder = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$e, p), ["as", "children"]);
      return createComponent(Dynamic, mergeProps({
        get component() {
          return local.as;
        }
      }, () => usePlaceholder(props), {
        get children() {
          return local.children;
        }
      }));
    };
    Placeholder$1 = Object.assign(Placeholder, {
      Button: PlaceholderButton$1
    });
    PopoverHeader = createWithBsPrefix("popover-header");
    PopoverBody = createWithBsPrefix("popover-body");
    _tmpl$$7 = /* @__PURE__ */ template(`<div role="tooltip"><div class="popover-arrow"></div></div>`, 4);
    defaultProps$d = {
      arrowProps: {},
      placement: "right"
    };
    Popover = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$d, p), ["bsPrefix", "placement", "class", "style", "children", "body", "arrowProps", "popper", "show"]);
      const decoratedBsPrefix = useBootstrapPrefix(local.bsPrefix, "popover");
      const context2 = useContext(OverlayContext$1);
      const primaryPlacement = () => (context2?.metadata?.placement || local.placement)?.split("-")?.[0];
      return (() => {
        const _el$ = _tmpl$$7.cloneNode(true), _el$2 = _el$.firstChild;
        spread(_el$, mergeProps({
          get ["x-placement"]() {
            return primaryPlacement();
          },
          get ["class"]() {
            return classNames(local.class, decoratedBsPrefix, primaryPlacement() && `bs-popover-auto`);
          }
        }, props, () => context2?.wrapperProps, {
          get style() {
            return Object.assign({}, local.style, context2?.wrapperProps?.style);
          }
        }), false, true);
        spread(_el$2, mergeProps(() => local.arrowProps, () => context2?.arrowProps), false, false);
        insert(_el$, (() => {
          const _c$ = memo(() => !!local.body);
          return () => _c$() ? createComponent(PopoverBody, {
            get children() {
              return local.children;
            }
          }) : local.children;
        })(), null);
        return _el$;
      })();
    };
    Popover$1 = Object.assign(Popover, {
      Header: PopoverHeader,
      Body: PopoverBody
    });
    ProgressContext = createContext();
    defaultProps$a = {
      as: "div"
    };
    Spinner = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$a, p), ["as", "bsPrefix", "variant", "animation", "size", "class"]);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "spinner");
      const bsSpinnerPrefix = `${bsPrefix}-${local.animation}`;
      return createComponent(Dynamic, mergeProps({
        get component() {
          return local.as;
        }
      }, props, {
        get ["class"]() {
          return classNames(local.class, bsSpinnerPrefix, local.size && `${bsSpinnerPrefix}-${local.size}`, local.variant && `text-${local.variant}`);
        }
      }));
    };
    Spinner$1 = Spinner;
    defaultProps$7 = {};
    TabContainer = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$7, p), ["transition"]);
      return createComponent(Tabs$1, mergeProps(props, {
        get transition() {
          return getTabTransitionComponent(local.transition);
        }
      }));
    };
    TabContainer$1 = TabContainer;
    TabContent = createWithBsPrefix("tab-content");
    defaultProps$6 = {};
    TabPane = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$6, p), ["bsPrefix", "transition"]);
      const [panelProps, meta] = useTabPanel(mergeProps(props, {
        get transition() {
          return getTabTransitionComponent(local.transition);
        }
      }));
      const [panelLocal, rest] = splitProps(panelProps, ["as", "class", "mountOnEnter", "unmountOnExit"]);
      const prefix = useBootstrapPrefix(local.bsPrefix, "tab-pane");
      const Transition3 = meta.transition || Fade$1;
      return createComponent(TabContext$1.Provider, {
        value: null,
        get children() {
          return createComponent(SelectableContext$1.Provider, {
            value: null,
            get children() {
              return createComponent(Transition3, {
                get ["in"]() {
                  return meta.isActive;
                },
                get onEnter() {
                  return meta.onEnter;
                },
                get onEntering() {
                  return meta.onEntering;
                },
                get onEntered() {
                  return meta.onEntered;
                },
                get onExit() {
                  return meta.onExit;
                },
                get onExiting() {
                  return meta.onExiting;
                },
                get onExited() {
                  return meta.onExited;
                },
                get mountOnEnter() {
                  return meta.mountOnEnter;
                },
                get unmountOnExit() {
                  return meta.unmountOnExit;
                },
                get children() {
                  return createComponent(Dynamic, mergeProps({
                    get component() {
                      return panelLocal.as ?? "div";
                    }
                  }, rest, {
                    ref(r$) {
                      const _ref$ = props.ref;
                      typeof _ref$ === "function" ? _ref$(r$) : props.ref = r$;
                    },
                    get ["class"]() {
                      return classNames(panelLocal.class, prefix, meta.isActive && "active");
                    }
                  }));
                }
              });
            }
          });
        }
      });
    };
    TabPane$1 = TabPane;
    Tab = (props) => {
      return props;
    };
    Tab$1 = Object.assign(Tab, {
      Container: TabContainer$1,
      Content: TabContent,
      Pane: TabPane$1
    });
    fadeStyles = {
      [ENTERING]: "showing",
      [EXITING]: "showing show"
    };
    ToastFade = (props) => createComponent(Fade$1, mergeProps(props, {
      transitionClasses: fadeStyles
    }));
    ToastFade$1 = ToastFade;
    ToastContext = createContext();
    ToastContext$1 = ToastContext;
    _tmpl$$3 = /* @__PURE__ */ template(`<div></div>`, 2);
    defaultProps$32 = {
      closeLabel: "Close",
      closeButton: true
    };
    ToastHeader = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$32, p), ["bsPrefix", "closeLabel", "closeVariant", "closeButton", "class", "children"]);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "toast-header");
      const context2 = useContext(ToastContext$1);
      const handleClick = (e) => {
        context2?.onClose?.(e);
      };
      return (() => {
        const _el$ = _tmpl$$3.cloneNode(true);
        spread(_el$, mergeProps(props, {
          get ["class"]() {
            return classNames(bsPrefix, local.class);
          }
        }), false, true);
        insert(_el$, () => local.children, null);
        insert(_el$, (() => {
          const _c$ = memo(() => !!local.closeButton);
          return () => _c$() && createComponent(CloseButton$1, {
            get ["aria-label"]() {
              return local.closeLabel;
            },
            get variant() {
              return local.closeVariant;
            },
            onClick: handleClick,
            "data-dismiss": "toast"
          });
        })(), null);
        return _el$;
      })();
    };
    ToastHeader$1 = ToastHeader;
    ToastBody = createWithBsPrefix("toast-body");
    _tmpl$$2 = /* @__PURE__ */ template(`<div></div>`, 2);
    defaultProps$22 = {
      transition: ToastFade$1,
      show: true,
      animation: true,
      delay: 5e3,
      autohide: false
    };
    Toast = (p) => {
      const [local, props] = splitProps(mergeProps(defaultProps$22, p), ["bsPrefix", "class", "transition", "show", "animation", "delay", "autohide", "onClose", "bg"]);
      const bsPrefix = useBootstrapPrefix(local.bsPrefix, "toast");
      let owner;
      let delayRef = local.delay;
      let onCloseRef = local.onClose;
      createEffect(() => {
        delayRef = local.delay;
        onCloseRef = local.onClose;
      });
      let autohideTimeout;
      const autohideToast = createMemo(() => !!(local.autohide && local.show));
      const autohideFunc = createMemo(() => () => {
        if (autohideToast()) {
          onCloseRef?.();
        }
      });
      createEffect(() => {
        if (autohideToast()) {
          window.clearTimeout(autohideTimeout);
          autohideTimeout = window.setTimeout(autohideFunc(), delayRef);
        }
      });
      onCleanup(() => {
        window.clearTimeout(autohideTimeout);
      });
      const toastContext = {
        get onClose() {
          return local.onClose;
        }
      };
      const hasAnimation = !!(local.transition && local.animation);
      const Transition3 = local.transition;
      const ToastInner = () => runWithOwner(owner, () => (() => {
        const _el$ = _tmpl$$2.cloneNode(true);
        spread(_el$, mergeProps(props, {
          get ["class"]() {
            return classNames(bsPrefix, local.class, local.bg && `bg-${local.bg}`, !hasAnimation && (local.show ? "show" : "hide"));
          },
          "role": "alert",
          "aria-live": "assertive",
          "aria-atomic": "true"
        }), false, false);
        return _el$;
      })());
      return createComponent(ToastContext$1.Provider, {
        value: toastContext,
        children: () => {
          owner = getOwner();
          return createComponent(Show, {
            get when() {
              return hasAnimation && local.transition;
            },
            get fallback() {
              return createComponent(ToastInner, {});
            },
            get children() {
              return createComponent(Transition3, {
                appear: true,
                get ["in"]() {
                  return local.show;
                },
                unmountOnExit: true,
                get children() {
                  return createComponent(ToastInner, {});
                }
              });
            }
          });
        }
      });
    };
    Toast$1 = Object.assign(Toast, {
      Body: ToastBody,
      Header: ToastHeader$1
    });
  }
});

// public/project.jsx
var require_project = __commonJS({
  "public/project.jsx"() {
    init_web();
    init_web();
    init_web();
    init_web();
    init_web();
    init_web();
    init_solid();
    init_esm3();
    var _tmpl$2 = /* @__PURE__ */ template(`<div>`);
    var _tmpl$22 = /* @__PURE__ */ template(`<option value>-- Choose Template --`);
    var _tmpl$32 = /* @__PURE__ */ template(`<div><div><h2>\u2728 Create New Project \u2728`);
    var _tmpl$42 = /* @__PURE__ */ template(`<div> <span>Loading templates...`);
    var _tmpl$52 = /* @__PURE__ */ template(`<option>`);
    var BASE_URL = "/private/server/exocore/web";
    var fetchTemplates = async () => {
      const res = await fetch(`${BASE_URL}/templates`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    };
    var checkProjectStatus = async () => {
      try {
        const res = await fetch(`${BASE_URL}/project/status`, {
          method: "POST"
        });
        if (!res.ok) return;
        const json = await res.json();
        if (json.exists) {
          window.location.href = `${BASE_URL}/public/dashboard`;
        }
      } catch (err) {
        console.error("Error checking project status:", err);
      }
    };
    function App() {
      const [templates, {
        refetch: refetchTemplates
      }] = createResource(fetchTemplates);
      const [projectName, setProjectName] = createSignal("");
      const [templateId, setTemplateId] = createSignal("");
      const [gitUrl, setGitUrl] = createSignal("");
      const [inputType, setInputType] = createSignal("template");
      const [status, setStatus] = createSignal("");
      const [loading, setLoading] = createSignal(false);
      onMount(() => {
        checkProjectStatus();
        document.body.style.margin = "0";
        document.body.style.fontFamily = "'Patrick Hand', cursive";
        document.body.style.background = `
      repeating-linear-gradient(
        to bottom,
        #fff8e1 0px,
        #fff8e1 23px,
        #fdf2cc 24px,
        #fff8e1 25px
      ),
      linear-gradient(
        to right,
        transparent 5%,
        #ffab91 5.5%,
        #ffab91 6.5%,
        transparent 7%,
        transparent 100%
      )
    `;
        document.body.style.backgroundRepeat = "repeat-y";
        document.body.style.backgroundSize = "100% 25px, 100% 100%";
        document.body.style.color = "#444";
        const link = document.createElement("link");
        link.href = "https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap";
        link.rel = "stylesheet";
        document.head.appendChild(link);
      });
      const isCreateDisabled = () => {
        if (loading()) return true;
        if (!projectName().trim()) return true;
        if (inputType() === "template" && !templateId()) return true;
        if (inputType() === "gitUrl" && !gitUrl().trim()) return true;
        return false;
      };
      const handleCreate = async () => {
        setLoading(true);
        setStatus("");
        const finalProjectName = projectName().trim();
        if (!finalProjectName) {
          setStatus("Failed: Project name cannot be empty or just spaces.");
          setLoading(false);
          return;
        }
        try {
          const bodyPayload = {
            name: finalProjectName,
            template: inputType() === "template" ? templateId() : void 0,
            gitUrl: inputType() === "gitUrl" ? gitUrl().trim() : void 0
            // Trim Git URL as well
          };
          const res = await fetch(`${BASE_URL}/project`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(bodyPayload)
          });
          const text = await res.text();
          if (res.ok) {
            setStatus(`Success: ${text}`);
            setTimeout(() => {
              window.location.href = `${BASE_URL}/public/dashboard`;
            }, 1500);
          } else {
            setStatus(`Failed: ${text || "Unknown error"}`);
          }
        } catch (err) {
          setStatus(`Error: ${err.message}`);
        } finally {
          setLoading(false);
        }
      };
      const commonInputStyle = {
        background: "rgba(255, 255, 255, 0.8)",
        border: "1px solid #b0bec5",
        "font-size": "1rem",
        "font-family": "inherit",
        "border-radius": "6px",
        padding: "0.6rem 0.8rem"
      };
      return (() => {
        var _el$ = _tmpl$32(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild;
        _el$.style.setProperty("padding", "2vh 1vw");
        _el$.style.setProperty("display", "flex");
        _el$.style.setProperty("justify-content", "center");
        _el$.style.setProperty("align-items", "center");
        _el$.style.setProperty("min-height", "100vh");
        _el$.style.setProperty("box-sizing", "border-box");
        _el$2.style.setProperty("width", "100%");
        _el$2.style.setProperty("max-width", "520px");
        _el$2.style.setProperty("background-color", "rgba(255, 253, 240, 0.97)");
        _el$2.style.setProperty("border-radius", "15px");
        _el$2.style.setProperty("border", "1px solid #e0e0e0");
        _el$2.style.setProperty("box-shadow", "0 6px 18px rgba(0,0,0,0.12)");
        _el$2.style.setProperty("padding", "2rem 2.5rem");
        _el$3.style.setProperty("text-align", "center");
        _el$3.style.setProperty("margin-bottom", "2rem");
        _el$3.style.setProperty("font-size", "2.3rem");
        _el$3.style.setProperty("color", "#2c3e50");
        insert(_el$2, createComponent(Form$1.Group, {
          "class": "mb-4",
          get children() {
            return [createComponent(Form$1.Label, {
              style: {
                "font-weight": "bold",
                color: "#34495e"
              },
              children: "Project Source"
            }), (() => {
              var _el$4 = _tmpl$2();
              _el$4.style.setProperty("margin-top", "0.5rem");
              insert(_el$4, createComponent(Form$1.Check, {
                inline: true,
                type: "radio",
                label: "From Template",
                name: "inputType",
                id: "inputTypeTemplate",
                value: "template",
                get checked() {
                  return inputType() === "template";
                },
                onChange: () => setInputType("template"),
                style: {
                  "font-family": "inherit",
                  "margin-right": "1rem"
                }
              }), null);
              insert(_el$4, createComponent(Form$1.Check, {
                inline: true,
                type: "radio",
                label: "From Git URL",
                name: "inputType",
                id: "inputTypeGitUrl",
                value: "gitUrl",
                get checked() {
                  return inputType() === "gitUrl";
                },
                onChange: () => setInputType("gitUrl"),
                style: {
                  "font-family": "inherit"
                }
              }), null);
              return _el$4;
            })()];
          }
        }), null);
        insert(_el$2, createComponent(Show, {
          get when() {
            return inputType() === "template";
          },
          get fallback() {
            return createComponent(Form$1.Group, {
              "class": "mb-4",
              get children() {
                return [createComponent(Form$1.Label, {
                  style: {
                    "font-weight": "bold",
                    color: "#34495e"
                  },
                  children: "Git Repository URL"
                }), createComponent(Form$1.Control, {
                  placeholder: "e.g. https://github.com/user/repo.git",
                  get value() {
                    return gitUrl();
                  },
                  onInput: (e) => setGitUrl(e.currentTarget.value),
                  style: commonInputStyle,
                  get disabled() {
                    return loading();
                  }
                })];
              }
            });
          },
          get children() {
            return createComponent(Form$1.Group, {
              "class": "mb-4",
              get children() {
                return [createComponent(Form$1.Label, {
                  style: {
                    "font-weight": "bold",
                    color: "#34495e"
                  },
                  children: "Template"
                }), createComponent(Show, {
                  get when() {
                    return memo(() => !!!templates.loading)() && templates();
                  },
                  get fallback() {
                    return (() => {
                      var _el$6 = _tmpl$42(), _el$7 = _el$6.firstChild, _el$8 = _el$7.nextSibling;
                      _el$6.style.setProperty("text-align", "center");
                      _el$6.style.setProperty("margin-top", "1rem");
                      insert(_el$6, createComponent(Spinner$1, {
                        animation: "border",
                        variant: "secondary"
                      }), _el$7);
                      _el$8.style.setProperty("margin-left", "0.5rem");
                      return _el$6;
                    })();
                  },
                  get children() {
                    return createComponent(Form$1.Select, {
                      get value() {
                        return templateId();
                      },
                      onInput: (e) => setTemplateId(e.currentTarget.value),
                      style: commonInputStyle,
                      get disabled() {
                        return loading();
                      },
                      get children() {
                        return [_tmpl$22(), createComponent(For, {
                          get each() {
                            return templates();
                          },
                          children: (template2) => (() => {
                            var _el$9 = _tmpl$52();
                            insert(_el$9, () => template2.name);
                            createRenderEffect(() => _el$9.value = template2.id);
                            return _el$9;
                          })()
                        })];
                      }
                    });
                  }
                }), createComponent(Show, {
                  get when() {
                    return templates.error;
                  },
                  get children() {
                    return createComponent(Alert$1, {
                      variant: "danger",
                      "class": "mt-2",
                      style: {
                        "font-family": "inherit"
                      },
                      get children() {
                        return ["Could not load templates: ", memo(() => templates.error.message), createComponent(Button$12, {
                          variant: "link",
                          size: "sm",
                          onClick: refetchTemplates,
                          style: {
                            "margin-left": "10px",
                            "font-family": "inherit"
                          },
                          children: "Retry"
                        })];
                      }
                    });
                  }
                })];
              }
            });
          }
        }), null);
        insert(_el$2, createComponent(Form$1.Group, {
          "class": "mb-4",
          get children() {
            return [createComponent(Form$1.Label, {
              style: {
                "font-weight": "bold",
                color: "#34495e"
              },
              children: "Project Name"
            }), createComponent(Form$1.Control, {
              placeholder: "e.g. my-awesome-app",
              get value() {
                return projectName();
              },
              onInput: (e) => setProjectName(e.currentTarget.value.trim()),
              style: commonInputStyle,
              get disabled() {
                return loading();
              }
            })];
          }
        }), null);
        insert(_el$2, createComponent(Button$12, {
          get style() {
            return {
              width: "100%",
              padding: "0.85rem",
              "font-weight": "bold",
              "font-size": "1.1rem",
              background: "#ff8c00",
              color: "white",
              border: "none",
              "border-radius": "8px",
              "font-family": "inherit",
              "box-shadow": "0 4px 8px rgba(0,0,0,0.15)",
              transition: "transform 0.15s ease-out, box-shadow 0.15s ease-out, background-color 0.15s ease-out",
              cursor: isCreateDisabled() ? "not-allowed" : "pointer",
              opacity: isCreateDisabled() ? 0.7 : 1
            };
          },
          onClick: handleCreate,
          get disabled() {
            return isCreateDisabled();
          },
          onMouseOver: (e) => {
            if (!isCreateDisabled()) {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 6px 12px rgba(0,0,0,0.2)";
              e.currentTarget.style.background = "#e67e00";
            }
          },
          onMouseOut: (e) => {
            if (!isCreateDisabled()) {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.15)";
              e.currentTarget.style.background = "#ff8c00";
            }
          },
          get children() {
            return memo(() => !!loading())() ? [createComponent(Spinner$1, {
              as: "span",
              animation: "border",
              size: "sm",
              role: "status",
              "aria-hidden": "true",
              style: {
                "margin-right": "8px"
              }
            }), "Creating..."] : "\u{1F680} Create Project";
          }
        }), null);
        insert(_el$2, createComponent(Show, {
          get when() {
            return status();
          },
          get children() {
            return createComponent(Alert$1, {
              "class": "mt-4",
              get variant() {
                return status().startsWith("Success") ? "success" : "danger";
              },
              style: {
                "font-family": "inherit",
                "text-align": "center",
                padding: "0.8rem",
                "border-radius": "6px"
              },
              get children() {
                return status();
              }
            });
          }
        }), null);
        return _el$;
      })();
    }
    render(() => createComponent(App, {}), document.getElementById("app"));
  }
});
export default require_project();
