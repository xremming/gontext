const context = Symbol("context");

export type Context = {
  [context]: unknown;
};

export type ContextGetter<T> = (ctx: Context | null) => T | undefined;
export type ContextGetterWithDefault<T> = (ctx: Context | null) => T;
export type ContextSetter<T> = (ctx: Context, value: T) => Context;
export type ContextSetterWithDefault<T> = (ctx: Context, value?: T) => Context;

export class TimeoutError extends Error {
  constructor() {
    super("Timeout");
    this.name = "TimeoutError";
  }
}

export const Context = {
  /**
   * TODO returns a new empty context. Code should use Context.TODO when it's
   * unclear which Context to use or it is not yet available (because the
   * surrounding function has not yet been extended to accept a Context parameter).
   *
   * @returns A new empty context.
   */
  TODO: (): Context => {
    return {} as Context;
  },

  /**
   * background returns a new empty context. It is never aborted, has no values,
   * and has no timeout. It is typically used by the main function, initialization,
   * and tests, and as the top-level Context for incoming requests.
   *
   * @returns A new empty context.
   */
  background: (): Context => {
    return {} as Context;
  },

  /**
   * Use the list of tuples to set multiple values in the context in a single call.
   *
   * @param ctx The context which will be used as the base context.
   * @param setters The list of tuples where the first element is a setter function
   * as returned by `make` and the second element is the value to set.
   * @returns The new context with the values set.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compose: <T extends [setter: ContextSetter<any>, value: any][]>(
    ctx: Context,
    setters: [...T]
  ): Context => {
    return setters.reduce(
      (ctx, [withValue, value]) => withValue(ctx, value),
      ctx
    );
  },

  /**
   * Call the given function `fn` with an `AbortController` and an `AbortSignal`
   * that will be aborted if the returned abort function is called.
   *
   * Do note that the `result` promise WILL NOT be rejected automatically when
   * the abort function is called. It is up to the function to handle checking
   * whether the signal has been aborted and handle it accordingly.
   *
   * @param ctx The context that will be passed to the function. If `null`, a new
   * context will be created.
   * @param fn The function to call.
   * @returns A tuple containing the result promise and the abort function.
   */
  withAbort: <T>(
    ctx: Context | null,
    fn: (ctx: Context) => Promise<T>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): [result: Promise<T>, abort: (reason?: any) => void] => {
    ctx = ctx ?? Context.TODO();

    // We specifically use the `getAbortController` function here because the
    // `getSignal` function has a default value that creates a new `AbortController`
    // if one does not exist in the context.
    const prevAbortController = getAbortController(ctx);
    const abortController = new AbortController();

    const abort = abortController.abort.bind(abortController) as (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reason?: any
    ) => void;

    if (prevAbortController) {
      prevAbortController.signal.addEventListener("abort", () => {
        abortController.abort();
      });
    }

    return [
      fn(
        Context.compose(ctx, [
          [withAbortController, abortController],
          [withSignal, abortController.signal],
        ])
      ).finally(abort),
      abort,
    ];
  },

  /**
   * Call the given function `fn` with a timeout of `ms` milliseconds. The context
   * passed to the function will be extended with an `AbortController` and an
   * `AbortSignal` that will be aborted if the timeout is reached.
   *
   * @param ctx The context that will be passed to the function. If `null`, a new
   * context will be created.
   * @param ms The timeout in milliseconds.
   * @param fn The function to call.
   * @returns A promise that resolves with the result of the function.
   */
  withTimeout: <T>(
    ctx: Context | null,
    ms: number,
    fn: (ctx: Context) => Promise<T>
  ): Promise<T> => {
    const [result, abort] = Context.withAbort(ctx, fn);

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        abort();
        reject(new TimeoutError());
      }, ms);

      result.then(resolve, reject).finally(() => clearTimeout(timeoutId));
    });
  },
};

const getValue = <T>(ctx: Context | null, key: symbol): T | undefined => {
  if (ctx === null) {
    return undefined;
  }

  // Only needed type casts as this is inherently the unsafe part due to how the
  // exposed API of Context looks like.
  return ctx[key.valueOf() as typeof context] as T | undefined;
};

const withValue = <T>(ctx: Context | null, key: symbol, value: T): Context => {
  return {
    ...(ctx ?? Context.TODO()),
    [key.valueOf()]: value,
  };
};

export function make<T>(): [getter: ContextGetter<T>, setter: ContextSetter<T>];
export function make<T>(
  name: string
): [getter: ContextGetter<T>, setter: ContextSetter<T>];
export function make<T>(
  defaultValue: (ctx: Context | null) => T
): [getter: ContextGetterWithDefault<T>, setter: ContextSetterWithDefault<T>];
export function make<T>(
  name: string,
  defaultValue: (ctx: Context | null) => T
): [getter: ContextGetterWithDefault<T>, setter: ContextSetterWithDefault<T>];

export function make<T>(
  arg1?: string | ((ctx: Context | null) => T),
  arg2?: ((ctx: Context | null) => T) | undefined
): [
  getter: ContextGetter<T> | ContextGetterWithDefault<T>,
  setter: ContextSetter<T> | ContextSetterWithDefault<T>
] {
  const name = typeof arg1 === "string" ? arg1 : undefined;
  const defaultValue = typeof arg1 === "function" ? arg1 : arg2;

  const key = Symbol(name);

  return [
    (ctx: Context | null) => getValue(ctx, key) ?? defaultValue?.(ctx),
    (ctx: Context | null, value?: T) =>
      withValue(ctx, key, value ?? defaultValue?.(ctx)),
  ];
}

const [getAbortController, withAbortController] =
  make<AbortController>("AbortController");

const [getSignal, withSignal] = make("AbortSignal", (ctx) => {
  const abortController = getAbortController(ctx);
  return abortController?.signal ?? new AbortController().signal;
});

export { getAbortController, getSignal };
