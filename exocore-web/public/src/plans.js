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
var booleans, Properties, memo, $$EVENTS, RequestContext;
var init_web = __esm({
  "../node_modules/solid-js/web/dist/web.js"() {
    init_solid();
    init_solid();
    booleans = ["allowfullscreen", "async", "autofocus", "autoplay", "checked", "controls", "default", "disabled", "formnovalidate", "hidden", "indeterminate", "inert", "ismap", "loop", "multiple", "muted", "nomodule", "novalidate", "open", "playsinline", "readonly", "required", "reversed", "seamless", "selected"];
    Properties = /* @__PURE__ */ new Set(["className", "value", "readOnly", "noValidate", "formNoValidate", "isMap", "noModule", "playsInline", ...booleans]);
    memo = (fn) => createMemo(() => fn());
    $$EVENTS = "_$DX_DELEGATE";
    RequestContext = Symbol();
  }
});

// public/plans.jsx
var require_plans = __commonJS({
  "public/plans.jsx"() {
    init_web();
    init_web();
    init_web();
    init_web();
    init_web();
    init_web();
    init_web();
    init_solid();
    var _tmpl$ = /* @__PURE__ */ template(`<svg xmlns=http://www.w3.org/2000/svg viewBox="0 0 16 16"width=24 height=24><path d="M2 0H14V2H16V14H14V16H2V14H0V2H2V0ZM4 4V12H12V4H4Z"></path><path d="M6 6H10V10H6V6Z">`);
    var _tmpl$2 = /* @__PURE__ */ template(`<div class=status-box>`);
    var _tmpl$3 = /* @__PURE__ */ template(`<p class=loading-text>LOADING USER DATA...`);
    var _tmpl$4 = /* @__PURE__ */ template(`<div class=greeting>HELLO, <!>!`);
    var _tmpl$5 = /* @__PURE__ */ template(`<div class=plans-outer-container><div class=plans-container>`);
    var _tmpl$6 = /* @__PURE__ */ template(`<p>NO PLANS AVAILABLE.`);
    var _tmpl$7 = /* @__PURE__ */ template(`<p>CANNOT LOAD USER. TRY LOGIN.`);
    var _tmpl$8 = /* @__PURE__ */ template(`<div class=main-container><style>
          * {
            image-rendering: pixelated !important;
            -ms-interpolation-mode: nearest-neighbor !important; 
            -webkit-font-smoothing: none !important;
            font-smooth: never !important;
            box-sizing: border-box;
          }
          body, input, button, textarea, select {
            font-family: 'Pixelify Sans', sans-serif !important;
          }
          .main-container {
            padding: 2vh 2vw; display: flex; flex-direction: column;
            justify-content: center; align-items: center; min-height: 100vh;
            animation: fadeIn 0.7s 0.1s ease forwards; opacity: 0;
          }
          @keyframes fadeIn { to { opacity: 1; } }
          .greeting {
            font-size: 2.3rem; font-weight: 700; color: #00EFFF;
            margin-bottom: 1.5rem; text-shadow: 2px 2px 0px #110522; 
            letter-spacing: 1px;
          }
          .status-box {
            margin-bottom: 1rem; padding: 10px 15px; border-radius: 2px;
            color: #FEE2E2; background-color: #7F1D1D; border: 2px solid #5F1212;
            box-shadow: 2px 2px 0px #400A0A; font-weight: 700;
            max-width: 500px; width: 90%; text-align: center;
            font-size: 0.8rem; line-height: 1.3; letter-spacing: 0.5px;
          }
          .loading-text {
            font-size: 1.2rem; color: #909090; font-weight: 700; letter-spacing: 0.5px;
          }
          .content-box {
            width: 100%; max-width: 860px; min-height: 350px;
            background-color: rgba(10, 2, 20, 0.9); 
            border-radius: 3px; border: 2px solid #2A0B4A; 
            box-shadow: 3px 3px 0px #0A0314; 
            padding: 1.5rem; text-align: center; user-select: none;
          }
          .plans-outer-container { width: 100%; }
          .plans-container {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 1.3rem; width: 100%; margin-top: 1rem;
          }
          .plan-card {
            display: flex; align-items: flex-start; padding: 12px;
            border-radius: 3px; border: 2px solid var(--card-border);
            color: var(--card-text);
            background: linear-gradient(145deg, var(--card-grad1), var(--card-grad2));
            animation: cardGlow 2.5s infinite alternate;
            transition: transform 0.15s ease-out;
          }
          @keyframes cardGlow {
            from { box-shadow: 2px 2px 0px var(--card-border), 0 0 4px 0px var(--glow-color); }
            to { box-shadow: 2px 2px 0px var(--card-border), 0 0 14px 3px var(--glow-color); }
          }
          .plan-icon-area {
            margin-right: 10px; flex-shrink: 0; padding-top: 2px; 
            width: 24px; height: 24px;
          }
          .plan-details {
            display: flex; flex-direction: column; flex-grow: 1; text-align: left;
          }
          .plan-name {
            font-size: 1.3rem; font-weight: 700; line-height: 1.15; margin-bottom: 5px; 
            letter-spacing: 0.5px;
            background: linear-gradient(60deg, var(--text-grad1, #FFFDE7), var(--text-grad2, #FFF59D));
            -webkit-background-clip: text; background-clip: text; color: transparent;
            padding-bottom: 1px;
          }
          .plan-price {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            font-size: 1.05rem; 
            font-weight: 500; /* Medium weight for standard font */
            margin-bottom: 10px; 
            opacity: 0.95; /* Slightly more opaque */
            color: var(--card-text); 
            letter-spacing: 0.1px; /* More standard letter spacing */
            image-rendering: auto !important; 
            -webkit-font-smoothing: auto !important; /* Enable smoothing for standard font */
            font-smooth: auto !important; /* Enable smoothing for standard font */
          }
          .buy-button {
            background-color: rgba(0,0,0,0.4); color: var(--card-text); 
            border: 2px solid var(--card-text); opacity: 0.95; padding: 7px 14px; 
            border-radius: 2px; box-shadow: 1px 1px 0px rgba(0,0,0,0.6);
            text-transform: uppercase; font-weight: 700; font-size: 0.8rem; 
            letter-spacing: 0.5px; cursor: pointer; align-self: flex-start;
            transition: transform 0.08s linear, background-color 0.08s linear;
          }
          .buy-button:hover { background-color: rgba(20,20,20,0.55); opacity: 1; }
          .buy-button:active { transform: translate(1px, 1px); box-shadow: 0px 0px 0px rgba(0,0,0,0.6); }
          @media (max-width: 600px) {
            .greeting { font-size: 1.9rem; }
            .content-box { padding: 1rem; }
            .plans-container { grid-template-columns: 1fr; gap: 1rem; }
            .plan-name { font-size: 1.15rem; }
            .plan-price { font-size: 0.95rem; } /* Adjust if needed */
            .buy-button { font-size: 0.75rem; padding: 6px 10px; }
          }
        </style><div class=content-box>`);
    var _tmpl$9 = /* @__PURE__ */ template(`<div class=plan-card><div class=plan-icon-area></div><div class=plan-details><div class=plan-name></div><div class=plan-price></div><button class=buy-button>BUY`);
    var PixelIcon = ({
      color
    }) => (() => {
      var _el$ = _tmpl$();
      _el$.style.setProperty("image-rendering", "pixelated");
      (color || "currentColor") != null ? _el$.style.setProperty("fill", color || "currentColor") : _el$.style.removeProperty("fill");
      return _el$;
    })();
    var planStylesConfig = {
      "Core Access": {
        textGrad1: "#D0A9F5",
        textGrad2: "#E8D4F7",
        cardGrad1: "#6A0DAD",
        cardGrad2: "#A74AC7",
        cardBorder: "#4B0082",
        textColor: "#FFFFFF",
        iconFill: "#E8D4F7",
        glowColor: "#E0BBE4"
      },
      "Prime Core": {
        textGrad1: "#FFEB3B",
        textGrad2: "#FFF59D",
        cardGrad1: "#FBC02D",
        cardGrad2: "#FFD700",
        cardBorder: "#B98B00",
        textColor: "#1A1A1A",
        iconFill: "#424242",
        glowColor: "#FFFACD"
      },
      "Alpha Core": {
        textGrad1: "#00BCD4",
        textGrad2: "#80DEEA",
        cardGrad1: "#03A9F4",
        cardGrad2: "#4FC3F7",
        cardBorder: "#0277BD",
        textColor: "#FFFFFF",
        iconFill: "#B2EBF2",
        glowColor: "#80DEEA"
      },
      "EXO Elite": {
        textGrad1: "#F44336",
        textGrad2: "#FF8A80",
        cardGrad1: "#D32F2F",
        cardGrad2: "#E57373",
        cardBorder: "#9A0007",
        textColor: "#FFFFFF",
        iconFill: "#FFCDD2",
        glowColor: "#FF8A80"
      },
      "Hacker Core": {
        textGrad1: "#4CAF50",
        textGrad2: "#A5D6A7",
        cardGrad1: "#388E3C",
        cardGrad2: "#66BB6A",
        cardBorder: "#1B5E20",
        textColor: "#FFFFFF",
        iconFill: "#C8E6C9",
        glowColor: "#A5D6A7"
      }
    };
    var defaultPlanStyle = {
      textGrad1: "#B0BEC5",
      textGrad2: "#ECEFF1",
      cardGrad1: "#455A64",
      cardGrad2: "#607D8B",
      cardBorder: "#263238",
      textColor: "#FFFFFF",
      iconFill: "#ECEFF1",
      glowColor: "#90A4AE"
    };
    var countryCurrencyMap = {
      "Afghanistan": "AFN",
      "Albania": "ALL",
      "Algeria": "DZD",
      "Angola": "AOA",
      "Argentina": "ARS",
      "Armenia": "AMD",
      "Australia": "AUD",
      "Austria": "EUR",
      "Azerbaijan": "AZN",
      "Bahamas": "BSD",
      "Bahrain": "BHD",
      "Bangladesh": "BDT",
      "Barbados": "BBD",
      "Belarus": "BYN",
      "Belgium": "EUR",
      "Belize": "BZD",
      "Benin": "XOF",
      "Bhutan": "BTN",
      "Bolivia": "BOB",
      "Bosnia and Herzegovina": "BAM",
      "Botswana": "BWP",
      "Brazil": "BRL",
      "Brunei": "BND",
      "Bulgaria": "BGN",
      "Burkina Faso": "XOF",
      "Burundi": "BIF",
      "Cambodia": "KHR",
      "Cameroon": "XAF",
      "Canada": "CAD",
      "Cape Verde": "CVE",
      "Central African Republic": "XAF",
      "Chad": "XAF",
      "Chile": "CLP",
      "China": "CNY",
      "Colombia": "COP",
      "Comoros": "KMF",
      "Congo, Dem. Rep.": "CDF",
      "Congo, Rep.": "XAF",
      "Costa Rica": "CRC",
      "Cote d'Ivoire": "XOF",
      "Croatia": "EUR",
      "Cuba": "CUP",
      "Cyprus": "EUR",
      "Czech Republic": "CZK",
      "Denmark": "DKK",
      "Djibouti": "DJF",
      "Dominican Republic": "DOP",
      "Ecuador": "USD",
      "Egypt": "EGP",
      "El Salvador": "USD",
      "Equatorial Guinea": "XAF",
      "Eritrea": "ERN",
      "Estonia": "EUR",
      "Eswatini": "SZL",
      "Ethiopia": "ETB",
      "Fiji": "FJD",
      "Finland": "EUR",
      "France": "EUR",
      "Gabon": "XAF",
      "Gambia": "GMD",
      "Georgia": "GEL",
      "Germany": "EUR",
      "Ghana": "GHS",
      "Greece": "EUR",
      "Guatemala": "GTQ",
      "Guinea": "GNF",
      "Guinea-Bissau": "XOF",
      "Guyana": "GYD",
      "Haiti": "HTG",
      "Honduras": "HNL",
      "Hong Kong": "HKD",
      "Hungary": "HUF",
      "Iceland": "ISK",
      "India": "INR",
      "Indonesia": "IDR",
      "Iran": "IRR",
      "Iraq": "IQD",
      "Ireland": "EUR",
      "Israel": "ILS",
      "Italy": "EUR",
      "Jamaica": "JMD",
      "Japan": "JPY",
      "Jordan": "JOD",
      "Kazakhstan": "KZT",
      "Kenya": "KES",
      "Kiribati": "AUD",
      "Korea, North": "KPW",
      "Korea, South": "KRW",
      "Kuwait": "KWD",
      "Kyrgyzstan": "KGS",
      "Laos": "LAK",
      "Latvia": "EUR",
      "Lebanon": "LBP",
      "Lesotho": "LSL",
      "Liberia": "LRD",
      "Libya": "LYD",
      "Liechtenstein": "CHF",
      "Lithuania": "EUR",
      "Luxembourg": "EUR",
      "Macao": "MOP",
      "Madagascar": "MGA",
      "Malawi": "MWK",
      "Malaysia": "MYR",
      "Maldives": "MVR",
      "Mali": "XOF",
      "Malta": "EUR",
      "Mauritania": "MRU",
      "Mauritius": "MUR",
      "Mexico": "MXN",
      "Micronesia": "USD",
      "Moldova": "MDL",
      "Monaco": "EUR",
      "Mongolia": "MNT",
      "Montenegro": "EUR",
      "Morocco": "MAD",
      "Mozambique": "MZN",
      "Myanmar": "MMK",
      "Namibia": "NAD",
      "Nauru": "AUD",
      "Nepal": "NPR",
      "Netherlands": "EUR",
      "New Zealand": "NZD",
      "Nicaragua": "NIO",
      "Niger": "XOF",
      "Nigeria": "NGN",
      "North Macedonia": "MKD",
      "Norway": "NOK",
      "Oman": "OMR",
      "Pakistan": "PKR",
      "Palau": "USD",
      "Panama": "PAB",
      "Papua New Guinea": "PGK",
      "Paraguay": "PYG",
      "Peru": "PEN",
      "Philippines": "PHP",
      "Poland": "PLN",
      "Portugal": "EUR",
      "Puerto Rico": "USD",
      "Qatar": "QAR",
      "Romania": "RON",
      "Russia": "RUB",
      "Rwanda": "RWF",
      "Samoa": "WST",
      "San Marino": "EUR",
      "Sao Tome and Principe": "STN",
      "Saudi Arabia": "SAR",
      "Senegal": "XOF",
      "Serbia": "RSD",
      "Seychelles": "SCR",
      "Sierra Leone": "SLL",
      "Singapore": "SGD",
      "Slovakia": "EUR",
      "Slovenia": "EUR",
      "Solomon Islands": "SBD",
      "Somalia": "SOS",
      "South Africa": "ZAR",
      "South Sudan": "SSP",
      "Spain": "EUR",
      "Sri Lanka": "LKR",
      "Sudan": "SDG",
      "Suriname": "SRD",
      "Sweden": "SEK",
      "Switzerland": "CHF",
      "Syria": "SYP",
      "Taiwan": "TWD",
      "Tajikistan": "TJS",
      "Tanzania": "TZS",
      "Thailand": "THB",
      "Timor-Leste": "USD",
      "Togo": "XOF",
      "Tonga": "TOP",
      "Trinidad and Tobago": "TTD",
      "Tunisia": "TND",
      "Turkey": "TRY",
      "Turkmenistan": "TMT",
      "Tuvalu": "AUD",
      "Uganda": "UGX",
      "Ukraine": "UAH",
      "United Arab Emirates": "AED",
      "United Kingdom": "GBP",
      "United States": "USD",
      "Uruguay": "UYU",
      "Uzbekistan": "UZS",
      "Vanuatu": "VUV",
      "Venezuela": "VES",
      "Vietnam": "VND",
      "Yemen": "YER",
      "Zambia": "ZMW",
      "Zimbabwe": "ZWL"
    };
    var currencySymbolsMap = {
      "AFN": "\u060B",
      "ALL": "L",
      "DZD": "\u062F.\u062C",
      "AOA": "Kz",
      "ARS": "$",
      "AMD": "\u058F",
      "AUD": "A$",
      "AZN": "\u20BC",
      "BSD": "B$",
      "BHD": ".\u062F.\u0628",
      "BDT": "\u09F3",
      "BBD": "Bds$",
      "BYN": "Br",
      "EUR": "\u20AC",
      "BZD": "BZ$",
      "XOF": "CFA",
      "BTN": "Nu.",
      "BOB": "Bs.",
      "BAM": "KM",
      "BWP": "P",
      "BRL": "R$",
      "BND": "B$",
      "BGN": "\u043B\u0432",
      "BIF": "FBu",
      "KHR": "\u17DB",
      "XAF": "FCFA",
      "CAD": "C$",
      "CVE": "Esc",
      "CLP": "CLP$",
      "CNY": "\xA5",
      "COP": "COL$",
      "KMF": "CF",
      "CDF": "FC",
      "CRC": "\u20A1",
      "CUP": "$MN",
      "CZK": "K\u010D",
      "DKK": "kr.",
      "DJF": "Fdj",
      "DOP": "RD$",
      "USD": "$",
      "EGP": "E\xA3",
      "ERN": "Nfk",
      "SZL": "L",
      "ETB": "Br",
      "FJD": "FJ$",
      "GMD": "D",
      "GEL": "\u20BE",
      "GHS": "\u20B5",
      "GTQ": "Q",
      "GNF": "FG",
      "GYD": "G$",
      "HTG": "G",
      "HNL": "L",
      "HKD": "HK$",
      "HUF": "Ft",
      "ISK": "kr",
      "INR": "\u20B9",
      "IDR": "Rp",
      "IRR": "\uFDFC",
      "IQD": "\u0639.\u062F",
      "ILS": "\u20AA",
      "JMD": "J$",
      "JPY": "\xA5",
      "JOD": "JD",
      "KZT": "\u20B8",
      "KES": "KSh",
      "KPW": "\u20A9",
      "KRW": "\u20A9",
      "KWD": "KD",
      "KGS": "\u0441\u043E\u043C",
      "LAK": "\u20AD",
      "LBP": "\u0644.\u0644",
      "LSL": "M",
      "LRD": "L$",
      "LYD": "LD",
      "CHF": "Fr.",
      "MOP": "MOP$",
      "MGA": "Ar",
      "MWK": "MK",
      "MYR": "RM",
      "MVR": ".\u0783",
      "MRU": "UM",
      "MUR": "\u20A8",
      "MXN": "Mex$",
      "MDL": "L",
      "MNT": "\u20AE",
      "MAD": "\u062F.\u0645.",
      "MZN": "MT",
      "MMK": "K",
      "NAD": "N$",
      "NPR": "\u20A8",
      "NZD": "NZ$",
      "NIO": "C$",
      "NGN": "\u20A6",
      "MKD": "\u0434\u0435\u043D",
      "NOK": "kr",
      "OMR": "\uFDFC",
      "PKR": "\u20A8",
      "PAB": "B/.",
      "PGK": "K",
      "PYG": "\u20B2",
      "PEN": "S/.",
      "PHP": "\u20B1",
      "PLN": "z\u0142",
      "QAR": "\uFDFC",
      "RON": "lei",
      "RUB": "\u20BD",
      "RWF": "RF",
      "WST": "WS$",
      "STN": "Db",
      "SAR": "\uFDFC",
      "RSD": "\u0434\u0438\u043D.",
      "SCR": "\u20A8",
      "SLL": "Le",
      "SGD": "S$",
      "SBD": "SI$",
      "SOS": "Sh.So.",
      "ZAR": "R",
      "SSP": "\xA3",
      "LKR": "Rs",
      "SDG": "\u062C.\u0633.",
      "SRD": "$",
      "SEK": "kr",
      "SYP": "\xA3S",
      "TWD": "NT$",
      "TJS": "\u0405\u041C",
      "TZS": "TSh",
      "THB": "\u0E3F",
      "TOP": "T$",
      "TTD": "TT$",
      "TND": "\u062F.\u062A",
      "TRY": "\u20BA",
      "TMT": "m",
      "UGX": "USh",
      "UAH": "\u20B4",
      "AED": "\u062F.\u0625",
      "GBP": "\xA3",
      "UYU": "$U",
      "UZS": "\u0441\u045E\u043C",
      "VUV": "VT",
      "VES": "Bs.S.",
      "VND": "\u20AB",
      "YER": "\uFDFC",
      "ZMW": "ZK",
      "ZWL": "$"
    };
    function App() {
      const [loading, setLoading] = createSignal(true);
      const [status, setStatus] = createSignal("");
      const [userData, setUserData] = createSignal(null);
      const [plans, setPlans] = createSignal([]);
      const [initialLoadComplete, setInitialLoadComplete] = createSignal(false);
      const [targetCurrency, setTargetCurrency] = createSignal("USD");
      const [exchangeRate, setExchangeRate] = createSignal(1);
      const [currencySymbol, setCurrencySymbol] = createSignal("$");
      const getToken = () => localStorage.getItem("exocore-token") || "";
      const getCookies = () => localStorage.getItem("exocore-cookies") || "";
      async function fetchExchangeRatesForUser(countryName) {
        const currencyCode = countryCurrencyMap[countryName] || "USD";
        const symbol = currencySymbolsMap[currencyCode] || currencyCode + " ";
        setTargetCurrency(currencyCode);
        setCurrencySymbol(symbol);
        if (currencyCode === "USD") {
          setExchangeRate(1);
          return;
        }
        try {
          const response = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${currencyCode}`);
          if (!response.ok) throw new Error(`API error: ${response.status}`);
          const data = await response.json();
          if (data.rates && data.rates[currencyCode]) {
            setExchangeRate(data.rates[currencyCode]);
          } else {
            setExchangeRate(1);
            setTargetCurrency("USD");
            setCurrencySymbol("$");
          }
        } catch (error) {
          setStatus("Could not load local currency. Displaying prices in USD.");
          setExchangeRate(1);
          setTargetCurrency("USD");
          setCurrencySymbol("$");
        }
      }
      async function fetchPlans() {
        try {
          const proxiedUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent("https://pastebin.com/raw/zddjxUGr")}`;
          const res = await fetch(proxiedUrl);
          if (!res.ok) throw new Error(`Failed to fetch plans: ${res.status}`);
          const data = await res.json();
          if (Array.isArray(data)) {
            setPlans(data);
          } else {
            setPlans([]);
          }
        } catch (err) {
          setStatus("Failed to load subscription plans. Please try refreshing.");
          setPlans([]);
        }
      }
      async function fetchUserInfo() {
        setLoading(true);
        setStatus("");
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
            } catch (e) {
            }
            throw new Error(errorMsg);
          }
          const data = await res.json();
          if (data.data?.user && data.data.user.verified === "success") {
            setUserData(data.data.user);
            setStatus("");
            if (data.data.user.country) {
              await fetchExchangeRatesForUser(data.data.user.country);
            } else {
              setTargetCurrency("USD");
              setExchangeRate(1);
              setCurrencySymbol("$");
            }
            await fetchPlans();
          } else {
            setUserData(null);
            setPlans([]);
            setStatus(data.message || "User verification failed. Redirecting to login...");
            localStorage.removeItem("exocore-token");
            localStorage.removeItem("exocore-cookies");
            setTimeout(() => {
              window.location.href = "/private/server/exocore/web/public/login";
            }, 2500);
          }
        } catch (err) {
          setUserData(null);
          setPlans([]);
          setStatus("Failed to fetch user info: " + (err.message || "Unknown error") + ". Redirecting...");
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
      onMount(() => {
        const fontLink = document.createElement("link");
        fontLink.href = "https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;700&display=swap";
        fontLink.rel = "stylesheet";
        document.head.appendChild(fontLink);
        document.body.style.margin = "0";
        document.body.style.fontFamily = "'Pixelify Sans', sans-serif";
        document.body.style.background = "linear-gradient(160deg, #1A073C 0%, #2C0F3A 50%, #4A1B4D 100%)";
        document.body.style.color = "#EAEAEA";
        document.body.style.setProperty("image-rendering", "pixelated", "important");
        document.body.style.setProperty("-webkit-font-smoothing", "none", "important");
        document.body.style.setProperty("font-smooth", "never", "important");
        fetchUserInfo();
      });
      const handleBuyClick = () => {
        window.location.href = "https://www.facebook.com/share/16TsfAhA3z/";
      };
      return (() => {
        var _el$2 = _tmpl$8(), _el$3 = _el$2.firstChild, _el$5 = _el$3.nextSibling;
        insert(_el$2, createComponent(Show, {
          get when() {
            return memo(() => !!status())() && !loading();
          },
          get children() {
            var _el$4 = _tmpl$2();
            insert(_el$4, status);
            return _el$4;
          }
        }), _el$5);
        insert(_el$5, createComponent(Show, {
          get when() {
            return memo(() => !!loading())() && !initialLoadComplete();
          },
          get children() {
            return _tmpl$3();
          }
        }), null);
        insert(_el$5, createComponent(Show, {
          get when() {
            return memo(() => !!(!loading() && initialLoadComplete()))() && userData();
          },
          get children() {
            return [(() => {
              var _el$7 = _tmpl$4(), _el$8 = _el$7.firstChild, _el$0 = _el$8.nextSibling, _el$9 = _el$0.nextSibling;
              insert(_el$7, () => (userData()?.user || userData()?.user?.user || userData()?.data?.user?.user || "USER").toUpperCase(), _el$0);
              return _el$7;
            })(), createComponent(Show, {
              get when() {
                return plans().length > 0;
              },
              get children() {
                var _el$1 = _tmpl$5(), _el$10 = _el$1.firstChild;
                insert(_el$10, createComponent(For, {
                  get each() {
                    return plans();
                  },
                  children: (planItem) => {
                    if (!planItem || typeof planItem.plan !== "string") {
                      return null;
                    }
                    const style = planStylesConfig[planItem.plan] || defaultPlanStyle;
                    let displayPrice = planItem.price || "$0";
                    const originalPriceStr = planItem.price || "$0";
                    const numericUsdPrice = parseFloat(originalPriceStr.replace("$", ""));
                    if (!isNaN(numericUsdPrice) && exchangeRate() !== null && exchangeRate() !== void 0) {
                      if (numericUsdPrice === 0 && targetCurrency() !== "USD") {
                        displayPrice = `${currencySymbol()}0`;
                      } else if (numericUsdPrice === 0 && targetCurrency() === "USD") {
                        displayPrice = `$0`;
                      } else {
                        const convertedPrice = numericUsdPrice * exchangeRate();
                        let formattedConvertedPrice;
                        if (targetCurrency() === "JPY" || targetCurrency() === "KRW") {
                          formattedConvertedPrice = Math.round(convertedPrice);
                        } else {
                          formattedConvertedPrice = convertedPrice.toFixed(2);
                        }
                        displayPrice = `${currencySymbol()}${formattedConvertedPrice}`;
                      }
                    }
                    return (() => {
                      var _el$13 = _tmpl$9(), _el$14 = _el$13.firstChild, _el$15 = _el$14.nextSibling, _el$16 = _el$15.firstChild, _el$17 = _el$16.nextSibling, _el$18 = _el$17.nextSibling;
                      insert(_el$14, createComponent(PixelIcon, {
                        get color() {
                          return style.iconFill;
                        }
                      }));
                      insert(_el$16, () => (planItem.plan || "PLAN").toUpperCase());
                      insert(_el$17, displayPrice);
                      _el$18.$$click = handleBuyClick;
                      createRenderEffect((_p$) => {
                        var _v$ = style.cardGrad1, _v$2 = style.cardGrad2, _v$3 = style.cardBorder, _v$4 = style.textColor, _v$5 = style.iconFill, _v$6 = style.textGrad1, _v$7 = style.textGrad2, _v$8 = style.glowColor;
                        _v$ !== _p$.e && ((_p$.e = _v$) != null ? _el$13.style.setProperty("--card-grad1", _v$) : _el$13.style.removeProperty("--card-grad1"));
                        _v$2 !== _p$.t && ((_p$.t = _v$2) != null ? _el$13.style.setProperty("--card-grad2", _v$2) : _el$13.style.removeProperty("--card-grad2"));
                        _v$3 !== _p$.a && ((_p$.a = _v$3) != null ? _el$13.style.setProperty("--card-border", _v$3) : _el$13.style.removeProperty("--card-border"));
                        _v$4 !== _p$.o && ((_p$.o = _v$4) != null ? _el$13.style.setProperty("--card-text", _v$4) : _el$13.style.removeProperty("--card-text"));
                        _v$5 !== _p$.i && ((_p$.i = _v$5) != null ? _el$13.style.setProperty("--icon-color", _v$5) : _el$13.style.removeProperty("--icon-color"));
                        _v$6 !== _p$.n && ((_p$.n = _v$6) != null ? _el$13.style.setProperty("--text-grad1", _v$6) : _el$13.style.removeProperty("--text-grad1"));
                        _v$7 !== _p$.s && ((_p$.s = _v$7) != null ? _el$13.style.setProperty("--text-grad2", _v$7) : _el$13.style.removeProperty("--text-grad2"));
                        _v$8 !== _p$.h && ((_p$.h = _v$8) != null ? _el$13.style.setProperty("--glow-color", _v$8) : _el$13.style.removeProperty("--glow-color"));
                        return _p$;
                      }, {
                        e: void 0,
                        t: void 0,
                        a: void 0,
                        o: void 0,
                        i: void 0,
                        n: void 0,
                        s: void 0,
                        h: void 0
                      });
                      return _el$13;
                    })();
                  }
                }));
                return _el$1;
              }
            }), createComponent(Show, {
              get when() {
                return memo(() => plans().length === 0)() && !status().includes("Failed to load subscription plans");
              },
              get children() {
                var _el$11 = _tmpl$6();
                _el$11.style.setProperty("color", "#A0A0A0");
                _el$11.style.setProperty("font-weight", "700");
                _el$11.style.setProperty("letter-spacing", "0.5px");
                _el$11.style.setProperty("font-size", "0.9rem");
                return _el$11;
              }
            })];
          }
        }), null);
        insert(_el$5, createComponent(Show, {
          get when() {
            return memo(() => !!(!loading() && initialLoadComplete() && !userData()))() && !status().includes("Redirecting");
          },
          get children() {
            var _el$12 = _tmpl$7();
            _el$12.style.setProperty("color", "#B0B0B0");
            _el$12.style.setProperty("font-weight", "700");
            _el$12.style.setProperty("letter-spacing", "0.5px");
            _el$12.style.setProperty("font-size", "0.9rem");
            return _el$12;
          }
        }), null);
        return _el$2;
      })();
    }
    render(() => createComponent(App, {}), document.getElementById("app"));
    delegateEvents(["click"]);
  }
});
export default require_plans();
