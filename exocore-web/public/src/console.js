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
      let newIndices, newIndicesNext, temp, tempdisposers, tempIndexes, start, end, newEnd, item;
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
        for (start = 0, end = Math.min(len, newLen); start < end && items[start] === newItems[start]; start++) ;
        for (end = len - 1, newEnd = newLen - 1; end >= start && newEnd >= start && items[end] === newItems[newEnd]; end--, newEnd--) {
          temp[newEnd] = mapped[end];
          tempdisposers[newEnd] = disposers[end];
          indexes && (tempIndexes[newEnd] = indexes[end]);
        }
        newIndices = /* @__PURE__ */ new Map();
        newIndicesNext = new Array(newEnd + 1);
        for (j = newEnd; j >= start; j--) {
          item = newItems[j];
          i = newIndices.get(item);
          newIndicesNext[j] = i === void 0 ? -1 : i;
          newIndices.set(item, j);
        }
        for (i = start; i <= end; i++) {
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
        for (j = start; j < newLen; j++) {
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

// public/console.jsx
var require_console = __commonJS({
  "public/console.jsx"() {
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
    var _tmpl$3 = /* @__PURE__ */ template(`<svg width=14 height=14 viewBox="0 0 24 24"fill=currentColor stroke=currentColor stroke-width=1 stroke-linecap=round stroke-linejoin=round><path d="M8 5v14l11-7z">`);
    var _tmpl$4 = /* @__PURE__ */ template(`<svg width=14 height=14 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2.5 stroke-linecap=round stroke-linejoin=round><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10">`);
    var _tmpl$5 = /* @__PURE__ */ template(`<svg width=14 height=14 viewBox="0 0 24 24"fill=currentColor stroke=currentColor stroke-width=1><rect x=6 y=6 width=12 height=12>`);
    var _tmpl$6 = /* @__PURE__ */ template(`<div class=input-prompt-line><span>&gt;</span><input type=text autofocus>`);
    var _tmpl$7 = /* @__PURE__ */ template(`<div class=app-container><div class=greeting-header><h2 class=greeting>Exocore Console</h2><span class=user-welcome>Welcome, </span></div><div class=console-wrapper><div class=console-header><div class=console-header-dots><span class=red-dot></span><span class=yellow-dot></span><span class=green-dot></span></div><button class=fullscreen-btn title="Toggle Fullscreen"></button></div><div class=console-container></div></div><div class=controls><button class="btn start-btn"> Start Server</button><button class="btn restart-btn"> Restart Server</button><button class="btn stop-btn"> Stop Server`);
    var _tmpl$8 = /* @__PURE__ */ template(`<div class=main-wrapper><style>
              :root {
                --bg-primary: #111217; --bg-secondary: #1a1b23; --bg-tertiary: #0D0E12;
                --text-primary: #e0e0e0; --text-secondary: #8a8f98;
                --border-color: rgba(255, 255, 255, 0.1); --shadow-color: rgba(0, 0, 0, 0.5);
                --font-body: 'Roboto', sans-serif; --font-console: 'Fira Code', monospace;
                --radius-main: 16px; --radius-inner: 10px;
                --btn-start-bg: #28a745; --btn-start-hover: #218838;
                --btn-restart-bg: #007bff; --btn-restart-hover: #0069d9;
                --btn-stop-bg: #dc3545; --btn-stop-hover: #c82333;
                --success-color: #2ecc71; --warning-color: #f39c12; --error-color: #e74c3c;
                --system-message-color: #3498db;
              }
              body { background-color: var(--bg-primary); color: var(--text-primary); font-family: var(--font-body); margin: 0; }
              .main-wrapper { display: flex; justify-content: center; align-items: center; padding: 4vh 2vw; min-height: 100vh; }
              .app-container { background: var(--bg-secondary); padding: 2rem; width: 100%; max-width: 800px; border-radius: var(--radius-main); border: 1px solid var(--border-color); box-shadow: 0 15px 40px var(--shadow-color); display: flex; flex-direction: column; gap: 1.5rem; }
              .greeting-header { text-align: center; }
              .greeting { font-size: 2.25rem; font-weight: 700; color: #fff; letter-spacing: -1px; }
              .user-welcome { font-size: 1rem; color: var(--text-secondary); margin-top: 0.25rem; }
              .console-wrapper { border-radius: var(--radius-inner); background: var(--bg-tertiary); box-shadow: inset 0 4px 15px rgba(0,0,0,0.4); overflow: hidden; display: flex; flex-direction: column; height: 450px; border: 1px solid var(--border-color); position: relative; }
              .console-wrapper:fullscreen { width: 100vw; height: 100vh; border-radius: 0; border: none; }
              .console-header { background: var(--bg-secondary); padding: 0.6rem 1rem; display: flex; align-items: center; border-bottom: 1px solid var(--border-color); position: relative; }
              .console-header-dots { display: flex; gap: 8px; }
              .console-header-dots span { width: 12px; height: 12px; border-radius: 50%; }
              .console-header-dots .red-dot { background-color: #ff5f57; }
              .console-header-dots .yellow-dot { background-color: #ffbd2e; }
              .console-header-dots .green-dot { background-color: #28c940; }
              .fullscreen-btn { position: absolute; top: 50%; right: 1rem; transform: translateY(-50%); background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; }
              .fullscreen-btn:hover { color: var(--text-primary); background-color: rgba(255,255,255,0.1); }
              .console-container { flex-grow: 1; color: var(--text-primary); font-family: var(--font-console); font-size: 14px; line-height: 1.6; padding: 1rem; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
              .input-prompt-line { display: flex; }
              .input-prompt-line span:first-child { color: var(--accent-primary); margin-right: 0.5ch; }
              .input-prompt-line input { flex-grow: 1; background: transparent; border: none; color: var(--text-primary); font-family: var(--font-console); font-size: 14px; outline: none; padding: 0; }
              .controls { display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center; }
              .btn { display: flex; align-items: center; gap: 0.6rem; padding: 0.7rem 1.5rem; font-size: 0.95rem; color: #fff; border: none; border-radius: var(--radius-inner); cursor: pointer; transition: all 0.2s ease; font-weight: 500; }
              .btn:hover { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
              .btn:active { transform: translateY(0); box-shadow: none; }
              .btn.start-btn { background-color: var(--btn-start-bg); }
              .btn.start-btn:hover { background-color: var(--btn-start-hover); }
              .btn.restart-btn { background-color: var(--btn-restart-bg); }
              .btn.restart-btn:hover { background-color: var(--btn-restart-hover); }
              .btn.stop-btn { background-color: var(--btn-stop-bg); }
              .btn.stop-btn:hover { background-color: var(--btn-stop-hover); }
            `);
    var _tmpl$9 = /* @__PURE__ */ template(`<div>Initializing...`);
    var _tmpl$0 = /* @__PURE__ */ template(`<div>Redirecting to login...`);
    var _tmpl$1 = /* @__PURE__ */ template(`<div>`);
    var FullscreenIcon = () => _tmpl$();
    var ExitFullscreenIcon = () => _tmpl$2();
    var StartIcon = () => _tmpl$3();
    var RestartIcon = () => _tmpl$4();
    var StopIcon = () => _tmpl$5();
    function App() {
      const [loading, setLoading] = createSignal(true);
      const [initialLoadComplete, setInitialLoadComplete] = createSignal(false);
      const [status, setStatus] = createSignal("");
      const [userData, setUserData] = createSignal(null);
      const [logs, setLogs] = createSignal([]);
      const [wsStatus, setWsStatus] = createSignal("Disconnected");
      const [isFullScreen, setIsFullScreen] = createSignal(false);
      const [siteLinkVisible, setSiteLinkVisible] = createSignal(false);
      const [isAwaitingInput, setIsAwaitingInput] = createSignal(false);
      const [inputValue, setInputValue] = createSignal("");
      let ws, inputRef, consoleContainerRef, ansiUpInstance;
      let logIdCounter = 0;
      const getToken = () => localStorage.getItem("exocore-token") || "";
      const getCookies = () => localStorage.getItem("exocore-cookies") || "";
      async function fetchUserInfo() {
        setLoading(true);
        const token = getToken();
        const cookies = getCookies();
        if (!token || !cookies) {
          setLoading(false);
          setInitialLoadComplete(true);
          window.location.href = "/private/server/exocore/web/public/login";
          return;
        }
        try {
          const res = await fetch("/private/server/exocore/web/userinfo", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              token,
              cookies
            })
          });
          if (!res.ok) {
            let errorMsg = `Server error: ${res.status}`;
            try {
              const errorData = await res.json();
              errorMsg = errorData.message || errorMsg;
            } catch (parseError) {
            }
            throw new Error(errorMsg);
          }
          const data = await res.json();
          if (data.data?.user && data.data.user.verified === "success") {
            setUserData(data.data.user);
            setStatus("");
          } else {
            setUserData(null);
            setStatus(data.message || "User verification failed. Redirecting...");
            localStorage.removeItem("exocore-token");
            localStorage.removeItem("exocore-cookies");
            setTimeout(() => {
              window.location.href = "/private/server/exocore/web/public/login";
            }, 2500);
          }
        } catch (err) {
          setUserData(null);
          setStatus("Failed to fetch user info: " + err.message + ". Redirecting...");
          localStorage.removeItem("exocore-token");
          localStorage.removeItem("exocore-cookies");
          setTimeout(() => {
            window.location.href = "/private/server/exocore/web/public/login";
          }, 2500);
        } finally {
          setLoading(false);
          setInitialLoadComplete(true);
        }
      }
      const scrollToBottom = () => {
        if (consoleContainerRef) {
          requestAnimationFrame(() => {
            consoleContainerRef.scrollTop = consoleContainerRef.scrollHeight;
          });
        }
      };
      function addLog(line, isSystemMessage = false) {
        let htmlContent;
        if (ansiUpInstance) {
          htmlContent = ansiUpInstance.ansi_to_html(line);
        } else {
          const escapeHtml = (unsafe) => unsafe.replace(/[&<"']/g, (match) => ({
            "&": "&amp;",
            "<": "&lt;",
            '"': "&quot;",
            "'": "&#039;"
          })[match] || match);
          htmlContent = isSystemMessage ? `<span style="color: var(--system-message-color);">${escapeHtml(line)}</span>` : escapeHtml(line);
        }
        if (typeof line === "string" && line.includes(window.origin)) {
          setSiteLinkVisible(true);
        }
        const newLogEntry = {
          id: logIdCounter++,
          html: htmlContent,
          isSystem: isSystemMessage
        };
        setLogs((prev) => [...prev, newLogEntry].slice(-250));
        scrollToBottom();
      }
      function handleInputSubmit(e) {
        if (e.key === "Enter") {
          e.preventDefault();
          if (!ws || ws.readyState !== WebSocket.OPEN) {
            addLog("\x1B[31mError: WebSocket is not connected.\x1B[0m", true);
            return;
          }
          const commandToSend = inputValue();
          ws.send(JSON.stringify({
            type: "STDIN_INPUT",
            payload: commandToSend
          }));
          addLog(`\x1B[38;5;39m> ${commandToSend}\x1B[0m`, true);
          setIsAwaitingInput(false);
          setInputValue("");
        }
      }
      function sendCommand(endpoint) {
        const commandName = endpoint.split("/").pop();
        fetch(endpoint, {
          method: "POST"
        }).then((res) => {
          if (!res.ok) {
            addLog(`\x1B[31mERROR: Command '${commandName}' failed - HTTP ${res.status}\x1B[0m`, true);
          } else {
            addLog(`\x1B[32mSUCCESS: Command '${commandName}' sent.\x1B[0m`, true);
          }
        }).catch((err) => {
          addLog(`\x1B[31mERROR: Failed to send command '${commandName}': ${err.message}\x1B[0m`, true);
        });
      }
      const handleStartCommand = () => {
        setSiteLinkVisible(false);
        setLogs([]);
        addLog("INFO: Starting server...", true);
        sendCommand("/private/server/exocore/web/start");
      };
      const handleRestartCommand = () => {
        setSiteLinkVisible(false);
        setLogs([]);
        addLog("INFO: Restarting server...", true);
        sendCommand("/private/server/exocore/web/restart");
      };
      const handleStopCommand = () => {
        setSiteLinkVisible(false);
        addLog("INFO: Stop command sent.", true);
        sendCommand("/private/server/exocore/web/stop");
      };
      function toggleFullScreen() {
        const el = document.querySelector(".console-wrapper");
        if (!el) return;
        if (!document.fullscreenElement) {
          el.requestFullscreen().catch((err) => addLog("Error entering fullscreen: " + err.message, true));
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
            addLog("\x1B[32mINFO: ANSI color processing enabled.\x1B[0m", true);
          }
        };
        document.head.appendChild(ansiScript);
        fetchUserInfo();
        const wsUrl = (window.location.protocol === "https:" ? "wss" : "ws") + "://" + window.location.host + "/private/server/exocore/web/console";
        function connectWebSocket() {
          ws = new WebSocket(wsUrl);
          ws.onopen = () => setWsStatus("Connected");
          ws.onclose = () => {
            setWsStatus("Disconnected");
            setTimeout(connectWebSocket, 2e3);
          };
          ws.onerror = () => setWsStatus("Error");
          ws.onmessage = (e) => {
            try {
              const message = JSON.parse(e.data);
              if (message?.type === "INPUT_REQUIRED") {
                addLog(message.payload || "Input required:");
                setIsAwaitingInput(true);
                setTimeout(() => inputRef?.focus(), 50);
                scrollToBottom();
              }
            } catch (error) {
              addLog(e.data);
            }
          };
        }
        connectWebSocket();
        document.addEventListener("fullscreenchange", () => setIsFullScreen(!!document.fullscreenElement));
      });
      return (() => {
        var _el$6 = _tmpl$8(), _el$7 = _el$6.firstChild;
        insert(_el$6, createComponent(Show, {
          get when() {
            return initialLoadComplete();
          },
          get fallback() {
            return _tmpl$9();
          },
          get children() {
            return createComponent(Show, {
              get when() {
                return userData();
              },
              get fallback() {
                return _tmpl$0();
              },
              get children() {
                var _el$8 = _tmpl$7(), _el$9 = _el$8.firstChild, _el$0 = _el$9.firstChild, _el$1 = _el$0.nextSibling, _el$10 = _el$1.firstChild, _el$11 = _el$9.nextSibling, _el$12 = _el$11.firstChild, _el$13 = _el$12.firstChild, _el$14 = _el$13.nextSibling, _el$15 = _el$12.nextSibling, _el$19 = _el$11.nextSibling, _el$20 = _el$19.firstChild, _el$21 = _el$20.firstChild, _el$22 = _el$20.nextSibling, _el$23 = _el$22.firstChild, _el$24 = _el$22.nextSibling, _el$25 = _el$24.firstChild;
                insert(_el$1, () => userData()?.user || "User", null);
                _el$14.$$click = toggleFullScreen;
                insert(_el$14, createComponent(Show, {
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
                _el$15.$$click = () => inputRef?.focus();
                var _ref$ = consoleContainerRef;
                typeof _ref$ === "function" ? use(_ref$, _el$15) : consoleContainerRef = _el$15;
                insert(_el$15, createComponent(For, {
                  get each() {
                    return logs();
                  },
                  children: (log) => (() => {
                    var _el$28 = _tmpl$1();
                    createRenderEffect(() => _el$28.innerHTML = log.html);
                    return _el$28;
                  })()
                }), null);
                insert(_el$15, createComponent(Show, {
                  get when() {
                    return isAwaitingInput();
                  },
                  get children() {
                    var _el$16 = _tmpl$6(), _el$17 = _el$16.firstChild, _el$18 = _el$17.nextSibling;
                    _el$18.$$keydown = handleInputSubmit;
                    _el$18.$$input = (e) => setInputValue(e.currentTarget.value);
                    var _ref$2 = inputRef;
                    typeof _ref$2 === "function" ? use(_ref$2, _el$18) : inputRef = _el$18;
                    createRenderEffect(() => _el$18.value = inputValue());
                    return _el$16;
                  }
                }), null);
                _el$20.$$click = handleStartCommand;
                insert(_el$20, createComponent(StartIcon, {}), _el$21);
                _el$22.$$click = handleRestartCommand;
                insert(_el$22, createComponent(RestartIcon, {}), _el$23);
                _el$24.$$click = handleStopCommand;
                insert(_el$24, createComponent(StopIcon, {}), _el$25);
                return _el$8;
              }
            });
          }
        }), null);
        return _el$6;
      })();
    }
    render(() => createComponent(App, {}), document.getElementById("app"));
    delegateEvents(["click", "input", "keydown"]);
  }
});
export default require_console();
