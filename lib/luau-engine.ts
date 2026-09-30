type WasmFactory = (moduleArg: LuauModule) => Promise<Partial<LuauModule>>;

type LuauEnv = {
  set: (key: string, value: unknown, bypassReadonly?: boolean) => boolean;
};

type LuauVmState = {
  luaValueCache: Map<number, object>;
  jsValueCache: Map<number, object>;
  jsValueReverse: Map<object, number>;
  transactionData: unknown[];
  nextJSRef: number;
  nextTXKey: number;
  env: LuauEnv;
};

type LuauModule = {
  LUA_VALUE: symbol;
  JS_VALUE: symbol;
  JS_MUTABLE: symbol;
  securityTransmitList: Map<unknown, boolean>;
  options: Map<string, boolean>;
  states: Array<LuauVmState | null>;
  _makeLuaState: (stateIdx: number) => Promise<unknown>;
  _getLuaValue: (state: unknown, index: number) => number;
  _luauLoad: (state: unknown, sourceTx: number, nameTx: number) => number;
  _luauClose: (state: unknown) => void;
  luauToJsValue: (stateIdx: number, state: unknown, value: unknown) => unknown;
  GlueError: new (message?: string) => Error;
  fprintwarn: (...args: unknown[]) => void;
};

const Luau = {
  LUA_VALUE: Symbol("LuaValue"),
  JS_VALUE: Symbol("JsValue"),
  JS_MUTABLE: Symbol("JsMutable"),
  securityTransmitList: new Map<unknown, boolean>(),
  options: new Map<string, boolean>([["LUA_IMPLICIT_ARRAYS_TO_JS_ARRAYS", true]]),
  states: [] as LuauModule["states"],
} as LuauModule;

let ready: Promise<void> | null = null;

function disguiseWorkerAsPage(): () => void {
  const scope = globalThis as unknown as {
    window?: object;
    WorkerGlobalScope?: unknown;
  };
  if (typeof scope.WorkerGlobalScope === "undefined") return () => {};
  const hadWindow = "window" in scope;
  const previousWindow = scope.window;
  const previousWorkerScope = scope.WorkerGlobalScope;
  scope.window = scope;
  delete scope.WorkerGlobalScope;
  return () => {
    if (hadWindow) scope.window = previousWindow;
    else delete scope.window;
    scope.WorkerGlobalScope = previousWorkerScope;
  };
}

export function preloadLuau(): Promise<void> {
  return ensureRuntime();
}

function ensureRuntime(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    const imported = (await import("luau-web/src/lib/Luau.Web.Asyncify.js")) as {
      default?: WasmFactory;
    };
    const factory = imported.default;
    if (!factory) throw new Error("Luau runtime is unavailable");
    const restore = disguiseWorkerAsPage();
    try {
      Object.assign(Luau, await factory(Luau));
    } finally {
      restore();
    }
  })();
  return ready;
}

class CompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompileError";
  }
}

export class LuauState {
  private stateIdx = 0;
  private state: unknown = null;
  private destroyed = false;
  env: LuauEnv | null = null;

  static async createAsync(): Promise<LuauState> {
    await ensureRuntime();
    const instance = new LuauState();
    instance.state = await Luau._makeLuaState(instance.stateIdx);
    const vm = Luau.states[instance.stateIdx];
    if (!vm || !("env" in vm)) throw new Error("Luau runtime is unavailable");
    instance.env = vm.env;
    return instance;
  }

  private constructor() {
    this.stateIdx = Luau.states.length + 1;
    Luau.states[this.stateIdx] = {
      luaValueCache: new Map(),
      jsValueCache: new Map(),
      jsValueReverse: new Map(),
      transactionData: [],
      nextJSRef: -1,
      nextTXKey: 0,
      env: null as unknown as LuauEnv,
    };
  }

  private vm(): LuauVmState {
    const vm = Luau.states[this.stateIdx];
    if (!vm || !("transactionData" in vm)) {
      throw new Luau.GlueError("Cannot use destroyed Luau state");
    }
    return vm as LuauVmState;
  }

  private getValue(index: number): unknown {
    if (this.destroyed) throw new Luau.GlueError("Cannot use destroyed Luau state");
    const transactionId = Luau._getLuaValue(this.state, index);
    const raw = this.vm().transactionData[transactionId];
    let parsed: unknown = raw;
    if (typeof raw === "string") {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }
    return Luau.luauToJsValue(this.stateIdx, this.state, parsed);
  }

  private makeTransaction(value: unknown): number {
    if (this.destroyed) throw new Luau.GlueError("Cannot use destroyed Luau state");
    const vm = this.vm();
    const index = vm.nextTXKey++;
    vm.transactionData[index] = value;
    return index;
  }

  loadstring(source: string, chunkname: string, _throwOnError = true): (...args: unknown[]) => unknown {
    if (this.destroyed) throw new Luau.GlueError("Cannot use destroyed Luau state");
    const status = Luau._luauLoad(
      this.state,
      this.makeTransaction(source),
      this.makeTransaction(chunkname)
    );
    if (status !== 0) throw new CompileError(String(this.getValue(-1)));
    const compiled = this.getValue(-1);
    if (typeof compiled !== "function") {
      throw new CompileError("Luau did not return a chunk");
    }
    return compiled as (...args: unknown[]) => unknown;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.env = null;
    Luau.states[this.stateIdx] = null;
    // This wasm build cannot open another state after luauClose. Drop the
    // worker instead of closing when a later run still needs the runtime.
    Luau._luauClose(this.state);
  }
}
