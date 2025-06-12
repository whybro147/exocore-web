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
function setAttribute(node, name, value) {
  if (isHydrating(node)) return;
  if (value == null) node.removeAttribute(name);
  else node.setAttribute(name, value);
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

// public/profile.jsx
var require_profile = __commonJS({
  "public/profile.jsx"() {
    init_web();
    init_web();
    init_web();
    init_web();
    init_web();
    init_web();
    init_web();
    init_web();
    init_web();
    init_web();
    init_solid();
    var _tmpl$ = /* @__PURE__ */ template(`<svg class=icon viewBox="0 0 24 24"fill=currentColor width=1em height=1em><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z">`);
    var _tmpl$2 = /* @__PURE__ */ template(`<svg class=icon viewBox="0 0 24 24"fill=currentColor width=1em height=1em style=vertical-align:middle;margin-right:4px;><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z">`);
    var _tmpl$3 = /* @__PURE__ */ template(`<svg class=icon viewBox="0 0 24 24"fill=currentColor width=1em height=1em><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z">`);
    var _tmpl$4 = /* @__PURE__ */ template(`<img class=skill-icon>`);
    var _tmpl$5 = /* @__PURE__ */ template(`<div class=spinner>`);
    var _tmpl$6 = /* @__PURE__ */ template(`<style>`);
    var _tmpl$7 = /* @__PURE__ */ template(`<div class=status-message-container><div>`);
    var _tmpl$8 = /* @__PURE__ */ template(`<div class=loading-overlay>`);
    var _tmpl$9 = /* @__PURE__ */ template(`<div class=edit-controls><input type=text><div class=edit-controls-buttons><button class="btn btn-secondary">Cancel</button><button class="btn btn-primary">Save`);
    var _tmpl$0 = /* @__PURE__ */ template(`<div class=active-plan-container>`);
    var _tmpl$1 = /* @__PURE__ */ template(`<button class=edit-icon-btn title="Edit Bio"> Edit`);
    var _tmpl$10 = /* @__PURE__ */ template(`<div class=edit-controls><textarea rows=4></textarea><div class=edit-controls-buttons><button class="btn btn-secondary">Cancel</button><button class="btn btn-primary">Save Bio`);
    var _tmpl$11 = /* @__PURE__ */ template(`<div class=skills-section><h3>Project Skills</h3><p class=project-name>Analyzing: </p><div class=skills-grid>`);
    var _tmpl$12 = /* @__PURE__ */ template(`<div class=profile-card><div class=profile-header><img class=cover-photo alt="Cover photo"></div><img class=avatar alt="User avatar"><div class=profile-body><div class=nickname-container></div><p class=user-details>@<!> &bull; ID: </p><div class=bio-section><h3>About Me`);
    var _tmpl$13 = /* @__PURE__ */ template(`<div class=modal-overlay><div class=modal-content><h2>Update Image</h2><div class=modal-buttons><button class="btn btn-primary"> Upload New</button><button class="btn btn-secondary">Cancel`);
    var _tmpl$14 = /* @__PURE__ */ template(`<div class=profile-container>`);
    var _tmpl$15 = /* @__PURE__ */ template(`<p>Loading Profile...`);
    var _tmpl$16 = /* @__PURE__ */ template(`<div class=initial-load-container>`);
    var _tmpl$17 = /* @__PURE__ */ template(`<p>`);
    var _tmpl$18 = /* @__PURE__ */ template(`<h1 class=nickname-text>`);
    var _tmpl$19 = /* @__PURE__ */ template(`<button class=edit-icon-btn title="Edit Nickname">`);
    var _tmpl$20 = /* @__PURE__ */ template(`<p class=bio-text>`);
    var _tmpl$21 = /* @__PURE__ */ template(`<div class=skill-item><div class=skill-icon-container><span class=fallback-icon></span></div><div class=skill-name></div><div class=skill-percentage></div><div class=skill-percentage-bar>`);
    var IconPencil = () => _tmpl$();
    var IconAdd = () => _tmpl$2();
    var IconCode = () => _tmpl$3();
    var getBasename = (filePath) => {
      if (!filePath) return "";
      const parts = filePath.split(/[\\/]/);
      return parts[parts.length - 1] || "";
    };
    var getSkillIcon = (extension, displayName) => {
      const iconPath = `/private/server/exocore/web/public/icons/${extension.toLowerCase()}.svg`;
      return (() => {
        var _el$4 = _tmpl$4();
        _el$4.addEventListener("error", (e) => {
          e.currentTarget.style.display = "none";
          e.currentTarget.parentNode.querySelector(".fallback-icon").style.display = "block";
        });
        setAttribute(_el$4, "src", iconPath);
        setAttribute(_el$4, "alt", `${displayName} icon`);
        return _el$4;
      })();
    };
    var planStylesConfig = {
      "Core Access": {
        textGrad1: "#D0A9F5",
        textGrad2: "#E8D4F7",
        cardGrad1: "#6A0DAD",
        cardGrad2: "#A74AC7",
        cardBorder: "rgba(75, 0, 130, 0.8)",
        textColor: "#FFFFFF",
        iconFill: "#E8D4F7",
        glowColor: "rgba(224, 187, 228, 0.3)"
      },
      "Prime Core": {
        textGrad1: "#FFEB3B",
        textGrad2: "#FFF59D",
        cardGrad1: "#FBC02D",
        cardGrad2: "#FFD700",
        cardBorder: "rgba(185, 139, 0, 0.8)",
        textColor: "#1A1A1A",
        iconFill: "#424242",
        glowColor: "rgba(255, 250, 205, 0.4)"
      },
      "Alpha Core": {
        textGrad1: "#00BCD4",
        textGrad2: "#80DEEA",
        cardGrad1: "#03A9F4",
        cardGrad2: "#4FC3F7",
        cardBorder: "rgba(2, 119, 189, 0.8)",
        textColor: "#FFFFFF",
        iconFill: "#B2EBF2",
        glowColor: "rgba(128, 222, 234, 0.3)"
      },
      "EXO Elite": {
        textGrad1: "#F44336",
        textGrad2: "#FF8A80",
        cardGrad1: "#D32F2F",
        cardGrad2: "#E57373",
        cardBorder: "rgba(154, 0, 7, 0.8)",
        textColor: "#FFFFFF",
        iconFill: "#FFCDD2",
        glowColor: "rgba(255, 138, 128, 0.3)"
      },
      "Hacker Core": {
        textGrad1: "#4CAF50",
        textGrad2: "#A5D6A7",
        cardGrad1: "#000000",
        cardGrad2: "#388E3C",
        cardBorder: "rgba(27, 94, 32, 0.8)",
        textColor: "#00FF00",
        iconFill: "#C8E6C9",
        glowColor: "rgba(165, 214, 167, 0.3)"
      }
    };
    var defaultPlanStyle = {
      textGrad1: "#B0BEC5",
      textGrad2: "#ECEFF1",
      cardGrad1: "#455A64",
      cardGrad2: "#607D8B",
      cardBorder: "rgba(38, 50, 56, 0.8)",
      textColor: "#FFFFFF",
      iconFill: "#ECEFF1",
      glowColor: "rgba(144, 164, 174, 0.2)"
    };
    function App() {
      const [loading, setLoading] = createSignal(true);
      const [status, setStatus] = createSignal({
        type: "",
        message: ""
      });
      const [userData, setUserData] = createSignal(null);
      const [editingBio, setEditingBio] = createSignal(false);
      const [editingNickname, setEditingNickname] = createSignal(false);
      const [nickname, setNickname] = createSignal("");
      const [bio, setBio] = createSignal("");
      const [modalOpen, setModalOpen] = createSignal(false);
      const [modalAction, setModalAction] = createSignal(() => {
      });
      const [projectSkills, setProjectSkills] = createSignal(null);
      const avatarDimensions = {
        mobile: {
          headerH: 170,
          avatarH: 110,
          overlap: 55
        },
        tablet: {
          headerH: 240,
          avatarH: 140,
          overlap: 70
        },
        desktop: {
          headerH: 280,
          avatarH: 160,
          overlap: 80
        }
      };
      const getToken = () => localStorage.getItem("exocore-token") || "";
      const getCookies = () => localStorage.getItem("exocore-cookies") || "";
      async function fetchUserInfo() {
        setLoading(true);
        const token = getToken();
        const cookies = getCookies();
        if (!token || !cookies) {
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
            setStatus({
              type: "",
              message: ""
            });
            try {
              const skillsRes = await fetch("/private/server/exocore/web/skills", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({})
              });
              if (skillsRes.ok) {
                const skillsData = await skillsRes.json();
                if (skillsData && skillsData.length > 0) {
                  setProjectSkills(skillsData[0]);
                } else {
                  console.warn("Skills data is empty or malformed.");
                  setProjectSkills(null);
                }
              } else {
                console.error("Failed to fetch skills:", skillsRes.status);
                setProjectSkills(null);
              }
            } catch (skillsErr) {
              console.error("Error fetching skills:", skillsErr);
              setProjectSkills(null);
            }
          } else {
            setUserData(null);
            setStatus({
              type: "error",
              message: data.message || "User verification failed. Redirecting..."
            });
            setTimeout(() => {
              window.location.href = "/private/server/exocore/web/public/login";
            }, 2500);
          }
        } catch (err) {
          setUserData(null);
          setStatus({
            type: "error",
            message: "Failed to fetch user info: " + err.message + ". Redirecting..."
          });
          setTimeout(() => {
            window.location.href = "/private/server/exocore/web/public/login";
          }, 2500);
        } finally {
          setLoading(false);
        }
      }
      function uploadBase64Image(base64, field) {
        setLoading(true);
        const token = getToken();
        const cookies = getCookies();
        fetch("/private/server/exocore/web/userinfoEdit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            token,
            cookies,
            field,
            edit: base64
          })
        }).then((res) => res.json()).then((data) => {
          if (data.user) {
            setUserData(data.user);
            setStatus({
              type: "success",
              message: "Image updated!"
            });
          } else {
            setStatus({
              type: "error",
              message: data.message || "Image upload failed."
            });
          }
        }).catch((err) => setStatus({
          type: "error",
          message: "Upload error: " + err.message
        })).finally(() => {
          setLoading(false);
          setModalOpen(false);
          setTimeout(() => setStatus({
            type: "",
            message: ""
          }), 3e3);
        });
      }
      function openImageModal(src, field) {
        setModalAction(() => () => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*,.heic,.heif";
          input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
              if (file.size > 10 * 1024 * 1024) {
                setStatus({
                  type: "error",
                  message: "Max file size: 10MB."
                });
                setTimeout(() => setStatus({
                  type: "",
                  message: ""
                }), 3e3);
                return;
              }
              const reader = new FileReader();
              reader.onload = () => uploadBase64Image(reader.result, field);
              reader.onerror = () => setStatus({
                type: "error",
                message: "Error reading file."
              });
              reader.readAsDataURL(file);
            }
          };
          input.click();
        });
        setModalOpen(true);
      }
      function handleSaveText(field, value, setEditState) {
        setLoading(true);
        const token = getToken();
        const cookies = getCookies();
        fetch("/private/server/exocore/web/userinfoEdit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            token,
            cookies,
            field,
            edit: value
          })
        }).then((res) => res.json()).then((data) => {
          if (data.user) {
            setUserData(data.user);
            if (field === "nickname") setNickname(data.user.nickname || "");
            if (field === "bio") setBio(data.user.bio || "");
            setStatus({
              type: "success",
              message: "Changes saved!"
            });
          } else {
            setStatus({
              type: "error",
              message: data.message || "Failed to save."
            });
          }
        }).catch((err) => setStatus({
          type: "error",
          message: "Save error: " + err.message
        })).finally(() => {
          setEditState(false);
          setLoading(false);
          setTimeout(() => setStatus({
            type: "",
            message: ""
          }), 3e3);
        });
      }
      onMount(fetchUserInfo);
      const Spinner = () => _tmpl$5();
      const activePlanStyles = () => {
        const planName = userData()?.activePlan?.plan;
        return planStylesConfig[planName] || defaultPlanStyle;
      };
      return [(() => {
        var _el$6 = _tmpl$6();
        insert(_el$6, () => `
                @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');

                :root {
                    --bg-primary: #111217; --bg-secondary: #1a1b23; --bg-tertiary: #2a2c3b;
                    --text-primary: #e0e0e0; --text-secondary: #8a8f98; --accent-primary: #00aaff;
                    --accent-secondary: #0088cc; --success-color: #2ecc71; --error-color: #e74c3c;
                    --border-color: rgba(255, 255, 255, 0.1); --shadow-color: rgba(0, 0, 0, 0.5);
                    --radius-main: 16px; --radius-inner: 12px;
                    --font-body: 'Roboto', sans-serif;

                    --avatar-mobile-top: ${avatarDimensions.mobile.headerH - avatarDimensions.mobile.overlap}px;
                    --avatar-tablet-top: ${avatarDimensions.tablet.headerH - avatarDimensions.tablet.overlap}px;
                    --avatar-desktop-top: ${avatarDimensions.desktop.headerH - avatarDimensions.desktop.overlap}px;
                }

                body { background-color: var(--bg-primary); font-family: var(--font-body); color: var(--text-primary); margin: 0; }
                .profile-container { display: flex; justify-content: center; align-items: flex-start; padding: 2rem 1rem; min-height: 100vh; box-sizing: border-box; }
                .profile-card { background: var(--bg-secondary); border-radius: var(--radius-main); box-shadow: 0 15px 40px var(--shadow-color); width: 100%; max-width: 600px; position: relative; border: 1px solid var(--border-color); }
                .profile-header { position: relative; height: ${avatarDimensions.mobile.headerH}px; border-top-left-radius: var(--radius-main); border-top-right-radius: var(--radius-main); overflow: hidden; }
                .cover-photo { width: 100%; height: 100%; object-fit: cover; cursor: pointer; transition: transform 0.4s ease; }
                .cover-photo:hover { transform: scale(1.05); }
                .avatar { width: ${avatarDimensions.mobile.avatarH}px; height: ${avatarDimensions.mobile.avatarH}px; border-radius: 50%; object-fit: cover; background-color: var(--bg-tertiary); border: 5px solid var(--bg-secondary); box-shadow: 0 8px 25px rgba(0,0,0,0.3); position: absolute; top: var(--avatar-mobile-top); left: 50%; transform: translateX(-50%); cursor: pointer; transition: transform 0.3s ease; z-index: 3; }
                .avatar:hover { transform: translateX(-50%) scale(1.1); }
                .profile-body { padding: ${avatarDimensions.mobile.overlap + 15}px 1.5rem 1.5rem; text-align: center; }

                .nickname-container { display: flex; align-items: center; justify-content: center; gap: .75rem; min-height: 42px; }
                .nickname-text { font-size: 2rem; font-weight: 700; color: var(--text-primary); }
                .user-details { color: var(--text-secondary); margin: 0.25rem 0 1.5rem 0; }

                /* Styles for active plan */
                .active-plan-container {
                    display: inline-flex;
                    align-items: center;
                    color: #fff; /* Default color, can be overridden by dynamic style */
                    padding: 0.3rem 0.8rem;
                    border-radius: 15px;
                    font-size: 0.85rem;
                    font-weight: 500;
                    margin-top: -0.5rem;
                    margin-bottom: 1.5rem;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    /* Dynamic styles will be applied here */
                }
                .active-plan-container span {
                    margin-left: 0.3rem;
                }

                .bio-section, .skills-section { margin-top: 1.5rem; padding: 1.5rem; background-color: var(--bg-tertiary); border-radius: var(--radius-inner); text-align: left; }
                .bio-section h3, .skills-section h3 { margin: 0 0 1rem 0; color: var(--text-primary); display: flex; justify-content: space-between; align-items: center; font-size: 1.2rem; }
                .bio-text { color: var(--text-secondary); line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; font-size: 1rem; }

                .edit-icon-btn { background: none; border: none; padding: .3rem; cursor: pointer; color: var(--text-secondary); display: inline-flex; align-items: center; gap: .4rem; font-size: .9rem; font-family: var(--font-body); }
                .edit-icon-btn:hover { color: var(--accent-primary); }

                .edit-controls { display: flex; flex-direction: column; gap: .8rem; animation: fadeIn .3s ease; }
                .edit-controls input, .edit-controls textarea { width: 100%; padding: .8rem 1rem; border: 1px solid var(--border-color); border-radius: var(--radius-inner); font-family: var(--font-body); font-size: 1rem; background-color: var(--bg-primary); color: var(--text-primary); box-sizing: border-box; }
                .edit-controls input:focus, .edit-controls textarea:focus { outline:0; border-color: var(--accent-primary); box-shadow: 0 0 0 3px rgba(0, 170, 255, 0.2); }
                .edit-controls textarea { min-height: 90px; resize: vertical; }

                .edit-controls-buttons { display: flex; justify-content: flex-end; gap: .6rem; }
                .btn { display: inline-flex; align-items: center; justify-content: center; padding: .6rem 1.2rem; border: none; border-radius: var(--radius-inner); cursor: pointer; font-family: var(--font-body); font-size: 1rem; font-weight: 500; transition: all .2s ease; }
                .btn-primary { background: var(--accent-primary); color: #fff; }
                .btn-primary:hover { background: var(--accent-secondary); }
                .btn-secondary { background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); }
                .btn-secondary:hover { background: var(--border-color); }

                .status-message-container { position:fixed; bottom:20px; left:50%; transform:translateX(-50%); z-index:1001; }
                .status-message { padding: .8rem 1.5rem; border-radius: var(--radius-inner); color: #fff; box-shadow: 0 5px 20px rgba(0,0,0,0.3); animation: slideInUp .5s ease, fadeOut .5s ease 2.5s forwards; }
                .status-message.success { background-color: var(--success-color); }
                .status-message.error { background-color: var(--error-color); }

                .modal-overlay { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,.7); display:flex; justify-content:center; align-items:center; z-index:1000; backdrop-filter:blur(5px); animation:fadeIn .3s ease; }
                .modal-content { background: var(--bg-secondary); padding: 2rem; border-radius: var(--radius-main); text-align:center; max-width: 450px; width: 90%; border: 1px solid var(--border-color); }
                .modal-buttons { display:flex; flex-direction:column; gap: .8rem; margin-top: 1.5rem; }
                .loading-overlay { position:absolute; inset:0; background:rgba(26,27,35,.85); display:flex; justify-content:center; align-items:center; z-index:100; border-radius: var(--radius-main); }
                .spinner { border: 4px solid rgba(255,255,255,.1); width: 36px; height: 36px; border-radius: 50%; border-left-color: var(--accent-primary); animation:spin .8s linear infinite; }
                .initial-load-container { display:flex; flex-direction:column; justify-content:center; align-items:center; min-height:80vh; text-align:center; font-size:1.2rem; color: var(--text-secondary); }

                .skills-section h3 { margin-bottom: 1.2rem; }
                .skills-section .project-name { font-size: 1.1rem; color: var(--text-primary); margin-bottom: 1rem; text-align: center; font-weight: 500;}
                .skills-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                    gap: 1rem;
                    justify-content: center;
                }
                .skill-item {
                    background-color: var(--bg-primary);
                    padding: 0.8rem;
                    padding-bottom: 1.5rem;
                    border-radius: var(--radius-inner);
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    border: 1px solid var(--border-color);
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                    position: relative;
                    overflow: hidden;
                }
                .skill-item:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 5px 15px rgba(0,0,0,0.4);
                }
                .skill-icon-container {
                    font-size: 2.5em;
                    line-height: 1;
                    color: var(--accent-primary);
                    margin-bottom: 0.5rem;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    width: 100%;
                    height: 50px;
                    position: relative;
                }
                .skill-icon {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                }
                .fallback-icon {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    display: none;
                }
                .skill-name {
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: var(--text-primary);
                    margin-bottom: 0.3rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    width: 100%;
                }
                .skill-percentage {
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                }

                .skill-percentage-bar {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    height: 8px;
                    background-color: var(--accent-primary);
                    border-bottom-left-radius: var(--radius-inner);
                    border-bottom-right-radius: var(--radius-inner);
                    transition: width 0.3s ease-out;
                }


                @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
                @keyframes slideInUp{ from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
                @keyframes fadeOut{ from { opacity:1 } to { opacity:0 } }
                @keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }

                @media (min-width: 768px) {
                    .profile-card { max-width: 740px; }
                    .profile-header { height: ${avatarDimensions.tablet.headerH}px; }
                    .avatar { width: ${avatarDimensions.tablet.avatarH}px; height: ${avatarDimensions.tablet.avatarH}px; top: var(--avatar-tablet-top); border-width: 6px; }
                    .profile-body { padding: ${avatarDimensions.tablet.overlap + 20}px 2.5rem 2.5rem; }
                    .nickname-text { font-size: 2.2rem; }
                    .skills-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); }
                }

                @media (min-width: 1024px) {
                    .profile-card { max-width: 840px; }
                    .profile-header { height: ${avatarDimensions.desktop.headerH}px; }
                    .avatar { width: ${avatarDimensions.desktop.avatarH}px; height: ${avatarDimensions.desktop.avatarH}px; top: var(--avatar-desktop-top); border-width: 7px; }
                    .profile-body { padding: ${avatarDimensions.desktop.overlap + 25}px 3rem 3rem; }
                    .nickname-text { font-size: 2.5rem; }
                    .skills-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
                }
            `);
        return _el$6;
      })(), createComponent(Show, {
        get when() {
          return memo(() => !!status().message)() && !loading();
        },
        get children() {
          var _el$7 = _tmpl$7(), _el$8 = _el$7.firstChild;
          insert(_el$8, () => status().message);
          createRenderEffect(() => className(_el$8, `status-message ${status().type}`));
          return _el$7;
        }
      }), (() => {
        var _el$9 = _tmpl$14();
        insert(_el$9, createComponent(Show, {
          get when() {
            return memo(() => !!!loading())() && userData();
          },
          get fallback() {
            return (() => {
              var _el$47 = _tmpl$16();
              insert(_el$47, createComponent(Show, {
                get when() {
                  return loading();
                },
                get fallback() {
                  return (() => {
                    var _el$49 = _tmpl$17();
                    insert(_el$49, () => status().message || "Could not load profile.");
                    return _el$49;
                  })();
                },
                get children() {
                  return [createComponent(Spinner, {}), _tmpl$15()];
                }
              }));
              return _el$47;
            })();
          },
          get children() {
            var _el$0 = _tmpl$12(), _el$10 = _el$0.firstChild, _el$11 = _el$10.firstChild, _el$12 = _el$10.nextSibling, _el$13 = _el$12.nextSibling, _el$14 = _el$13.firstChild, _el$20 = _el$14.nextSibling, _el$21 = _el$20.firstChild, _el$23 = _el$21.nextSibling, _el$22 = _el$23.nextSibling, _el$25 = _el$20.nextSibling, _el$26 = _el$25.firstChild, _el$27 = _el$26.firstChild;
            insert(_el$0, createComponent(Show, {
              get when() {
                return loading();
              },
              get children() {
                var _el$1 = _tmpl$8();
                insert(_el$1, createComponent(Spinner, {}));
                return _el$1;
              }
            }), _el$10);
            _el$11.$$click = () => openImageModal(userData()?.cover_photo, "cover_photo");
            _el$12.$$click = () => openImageModal(userData()?.avatar, "avatar");
            insert(_el$14, createComponent(Show, {
              get when() {
                return editingNickname();
              },
              get fallback() {
                return [(() => {
                  var _el$50 = _tmpl$18();
                  insert(_el$50, () => userData()?.nickname || userData()?.user);
                  return _el$50;
                })(), (() => {
                  var _el$51 = _tmpl$19();
                  _el$51.$$click = () => {
                    setNickname(userData()?.nickname || userData()?.user || "");
                    setEditingNickname(true);
                  };
                  insert(_el$51, createComponent(IconPencil, {}));
                  return _el$51;
                })()];
              },
              get children() {
                var _el$15 = _tmpl$9(), _el$16 = _el$15.firstChild, _el$17 = _el$16.nextSibling, _el$18 = _el$17.firstChild, _el$19 = _el$18.nextSibling;
                _el$16.$$input = (e) => setNickname(e.currentTarget.value);
                _el$18.$$click = () => setEditingNickname(false);
                _el$19.$$click = () => handleSaveText("nickname", nickname(), setEditingNickname);
                createRenderEffect(() => _el$16.value = nickname());
                return _el$15;
              }
            }));
            insert(_el$20, () => userData()?.user, _el$23);
            insert(_el$20, () => userData()?.id, null);
            insert(_el$13, createComponent(Show, {
              get when() {
                return userData()?.activePlan?.plan;
              },
              get children() {
                var _el$24 = _tmpl$0();
                insert(_el$24, () => userData()?.activePlan?.plan);
                createRenderEffect((_p$) => {
                  var _v$ = activePlanStyles().cardGrad1, _v$2 = activePlanStyles().textColor, _v$3 = `1px solid ${activePlanStyles().cardBorder}`, _v$4 = `0 2px 8px ${activePlanStyles().glowColor}`;
                  _v$ !== _p$.e && ((_p$.e = _v$) != null ? _el$24.style.setProperty("backgroundColor", _v$) : _el$24.style.removeProperty("backgroundColor"));
                  _v$2 !== _p$.t && ((_p$.t = _v$2) != null ? _el$24.style.setProperty("color", _v$2) : _el$24.style.removeProperty("color"));
                  _v$3 !== _p$.a && ((_p$.a = _v$3) != null ? _el$24.style.setProperty("border", _v$3) : _el$24.style.removeProperty("border"));
                  _v$4 !== _p$.o && ((_p$.o = _v$4) != null ? _el$24.style.setProperty("boxShadow", _v$4) : _el$24.style.removeProperty("boxShadow"));
                  return _p$;
                }, {
                  e: void 0,
                  t: void 0,
                  a: void 0,
                  o: void 0
                });
                return _el$24;
              }
            }), _el$25);
            insert(_el$26, createComponent(Show, {
              get when() {
                return !editingBio();
              },
              get children() {
                var _el$28 = _tmpl$1(), _el$29 = _el$28.firstChild;
                _el$28.$$click = () => {
                  setBio(userData()?.bio || "");
                  setEditingBio(true);
                };
                insert(_el$28, createComponent(IconPencil, {}), _el$29);
                return _el$28;
              }
            }), null);
            insert(_el$25, createComponent(Show, {
              get when() {
                return editingBio();
              },
              get fallback() {
                return (() => {
                  var _el$52 = _tmpl$20();
                  insert(_el$52, () => userData()?.bio || "No bio yet. Click edit to add one!");
                  return _el$52;
                })();
              },
              get children() {
                var _el$30 = _tmpl$10(), _el$31 = _el$30.firstChild, _el$32 = _el$31.nextSibling, _el$33 = _el$32.firstChild, _el$34 = _el$33.nextSibling;
                _el$31.$$input = (e) => setBio(e.currentTarget.value);
                _el$33.$$click = () => setEditingBio(false);
                _el$34.$$click = () => handleSaveText("bio", bio(), setEditingBio);
                createRenderEffect(() => _el$31.value = bio());
                return _el$30;
              }
            }), null);
            insert(_el$13, createComponent(Show, {
              get when() {
                return memo(() => !!(projectSkills() && projectSkills().skills))() && projectSkills().skills.length > 0;
              },
              get children() {
                var _el$35 = _tmpl$11(), _el$36 = _el$35.firstChild, _el$37 = _el$36.nextSibling, _el$38 = _el$37.firstChild, _el$39 = _el$37.nextSibling;
                insert(_el$37, () => getBasename(projectSkills().project), null);
                insert(_el$39, createComponent(For, {
                  get each() {
                    return projectSkills().skills;
                  },
                  children: (skill) => (() => {
                    var _el$53 = _tmpl$21(), _el$54 = _el$53.firstChild, _el$55 = _el$54.firstChild, _el$56 = _el$54.nextSibling, _el$57 = _el$56.nextSibling, _el$58 = _el$57.nextSibling;
                    insert(_el$54, () => getSkillIcon(skill.extension, skill.name), _el$55);
                    insert(_el$55, createComponent(IconCode, {}));
                    insert(_el$56, () => skill.name);
                    insert(_el$57, () => skill.skill);
                    createRenderEffect((_p$) => {
                      var _v$7 = skill.name, _v$8 = skill.skill;
                      _v$7 !== _p$.e && setAttribute(_el$56, "title", _p$.e = _v$7);
                      _v$8 !== _p$.t && ((_p$.t = _v$8) != null ? _el$58.style.setProperty("width", _v$8) : _el$58.style.removeProperty("width"));
                      return _p$;
                    }, {
                      e: void 0,
                      t: void 0
                    });
                    return _el$53;
                  })()
                }));
                return _el$35;
              }
            }), null);
            createRenderEffect((_p$) => {
              var _v$5 = userData()?.cover_photo || `https://source.unsplash.com/random/1600x600/?abstract,dark`, _v$6 = userData()?.avatar || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(userData()?.user || "U")}`;
              _v$5 !== _p$.e && setAttribute(_el$11, "src", _p$.e = _v$5);
              _v$6 !== _p$.t && setAttribute(_el$12, "src", _p$.t = _v$6);
              return _p$;
            }, {
              e: void 0,
              t: void 0
            });
            return _el$0;
          }
        }), null);
        insert(_el$9, createComponent(Show, {
          get when() {
            return modalOpen();
          },
          get children() {
            var _el$40 = _tmpl$13(), _el$41 = _el$40.firstChild, _el$42 = _el$41.firstChild, _el$43 = _el$42.nextSibling, _el$44 = _el$43.firstChild, _el$45 = _el$44.firstChild, _el$46 = _el$44.nextSibling;
            _el$40.$$click = () => setModalOpen(false);
            _el$41.$$click = (e) => e.stopPropagation();
            _el$42.style.setProperty("margin", "0 0 1.5rem 0");
            addEventListener(_el$44, "click", modalAction(), true);
            insert(_el$44, createComponent(IconAdd, {}), _el$45);
            _el$46.$$click = () => setModalOpen(false);
            _el$46.style.setProperty("margin-top", "1rem");
            return _el$40;
          }
        }), null);
        return _el$9;
      })()];
    }
    render(() => createComponent(App, {}), document.getElementById("app"));
    delegateEvents(["click", "input"]);
  }
});
export default require_profile();
