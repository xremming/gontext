import {
  Context,
  ContextGetter,
  ContextGetterWithDefault,
  ContextSetter,
  ContextSetterWithDefault,
  TimeoutError,
  getAbortController,
  getSignal,
  make,
} from "./index";

import { assert, assertType, describe, it, vi } from "vitest";

describe("TimeOutError", () => {
  it("should be an instance of Error", () => {
    const error = new TimeoutError();
    assert.instanceOf(error, Error);
  });

  it("should have a message", () => {
    const error = new TimeoutError();
    assert.equal(error.message, "Timeout");
  });

  it("should have a name", () => {
    const error = new TimeoutError();
    assert.equal(error.name, "TimeoutError");
  });
});

describe("Context.TODO", () => {
  it("should return an empty context", () => {
    const ctx = Context.TODO();
    assert.deepEqual(ctx, {} as Context);
  });

  it("should return a new object each time", () => {
    const ctx1 = Context.TODO();
    const ctx2 = Context.TODO();
    assert.notEqual(ctx1, ctx2);
  });
});

describe("Context.background", () => {
  it("should return an empty context", () => {
    const ctx = Context.background();
    assert.deepEqual(ctx, {} as Context);
  });

  it("should return a new object each time", () => {
    const ctx1 = Context.background();
    const ctx2 = Context.background();
    assert.notEqual(ctx1, ctx2);
  });
});

describe("Context.compose", () => {
  const [getA, setA] = make<number>("a");
  const [getB, setB] = make<number>("b", () => 0);

  it("should not modify the original context", () => {
    const ctxOriginal = Context.TODO();
    Context.compose(ctxOriginal, [
      [setA, 42],
      [setB, 43],
    ]);

    assert.isEmpty(ctxOriginal);
  });

  it("should return a new context with the values set by the setters", () => {
    const ctxOriginal = Context.TODO();
    const ctxNew = Context.compose(ctxOriginal, [
      [setA, 42],
      [setB, 43],
    ]);

    assert.equal(getA(ctxNew), 42);
    assert.equal(getB(ctxNew), 43);
  });
});

describe("Context.withAbort", () => {
  it("should return a promise and an abort function", () => {
    const [result, abort] = Context.withAbort(null, async () => {});
    assertType<Promise<void>>(result);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assertType<(reason?: any) => void>(abort);
  });

  it("should call the function with a new context", async () => {
    const ctxOriginal = Context.TODO();
    await Context.withAbort(ctxOriginal, async (ctx) => {
      assert.notEqual(ctx, ctxOriginal);
    });
  });

  it("should be aborted when the abort function is called", async () => {
    const [result, abort] = Context.withAbort(null, async (ctx) => {
      const signal = getSignal(ctx);
      assert.isFalse(signal.aborted);
      await vi.waitUntil(() => signal.aborted);
      return true;
    });

    abort();
    assert.isTrue(await result);
  });

  it("should be aborted with a reason when the abort function is called with a reason", async () => {
    const [result, abort] = Context.withAbort(null, async (ctx) => {
      const signal = getSignal(ctx);
      assert.isFalse(signal.aborted);

      await vi.waitUntil(() => signal.aborted);

      assert.equal(signal.reason, "reason");

      return true;
    });

    abort("reason");
    assert.isTrue(await result);
  });

  it("should be aborted when an outer abort function is called", async () => {
    const [result, abort] = Context.withAbort(null, async (ctx) => {
      const [result, _abort] = Context.withAbort(ctx, async () => {
        const signal = getSignal(ctx);
        assert.isFalse(signal.aborted);

        await vi.waitUntil(() => signal.aborted);

        return true;
      });

      return await result;
    });

    abort();
    assert.isTrue(await result);
  });
});

describe("Context.withTimeout", () => {
  it("should return a promise", () => {
    const result = Context.withTimeout(null, 1000, async () => {});
    assertType<Promise<void>>(result);
  });

  it("should call the function with a new context", async () => {
    const ctxOriginal = Context.TODO();
    await Context.withTimeout(ctxOriginal, 1000, async (ctx) => {
      assert.notEqual(ctx, ctxOriginal);
    });
  });

  it("should not throw when the timeout is reached", async () => {
    await Context.withTimeout(null, 0, async (ctx) => {
      const signal = getSignal(ctx);
      await vi.waitUntil(() => signal.aborted);
    });
  });

  it("should have the abort reason as TimeoutError when the timeout is reached", async () => {
    await Context.withTimeout(null, 0, async (ctx) => {
      const signal = getSignal(ctx);
      await vi.waitUntil(() => signal.aborted);

      assert.instanceOf(signal.reason, TimeoutError);
    });
  });
});

describe("make", () => {
  it("should return a getter and setter for a key", () => {
    const [getter, setter] = make<number>();
    assertType<ContextGetter<number>>(getter);
    assertType<ContextSetter<number>>(setter);

    const ctx = setter(Context.TODO(), 42);
    assert.equal(getter(ctx), 42);
  });

  it("should return a getter and setter for a key with a name", () => {
    const [getter, setter] = make<number>("key");
    assertType<ContextGetter<number>>(getter);
    assertType<ContextSetter<number>>(setter);

    const ctx = setter(Context.TODO(), 42);
    assert.equal(getter(ctx), 42);
  });

  it("should return a getter and setter for a key with a default value", () => {
    const [getter, setter] = make<number>(() => 42);
    assertType<ContextGetterWithDefault<number>>(getter);
    assertType<ContextSetterWithDefault<number>>(setter);

    const ctx = setter(Context.TODO());
    assert.equal(getter(ctx), 42);
  });

  it("should return a getter and setter for a key with a name and default value", () => {
    const [getter, setter] = make<number>("key", () => 42);
    assertType<ContextGetterWithDefault<number>>(getter);
    assertType<ContextSetterWithDefault<number>>(setter);

    const ctx = setter(Context.TODO());
    assert.equal(getter(ctx), 42);
  });

  it("should work with complex types", () => {
    const [getter, setter] = make<Map<string, number>>();
    assertType<ContextGetter<Map<string, number>>>(getter);
    assertType<ContextSetter<Map<string, number>>>(setter);

    const ctx = setter(Context.TODO(), new Map([["key", 42]]));
    assert.deepEqual(getter(ctx), new Map([["key", 42]]));
  });

  it("should remove null from the type", () => {
    const [get, set] = make<number | null>();
    assertType<ContextGetter<number>>(get);
    assertType<ContextSetter<number>>(set);
  });

  it("should remove undefined from the type", () => {
    const [get, set] = make<number | undefined>();
    assertType<ContextGetter<number>>(get);
    assertType<ContextSetter<number>>(set);
  });
});

describe("getSignal", () => {
  it("should return an AbortSignal from an empty context", () => {
    const ctx: Context = Context.TODO();
    assert.instanceOf(getSignal(ctx), AbortSignal);
  });

  it("should return an AbortSignal when called from withAbort", async () => {
    await Context.withAbort(null, async (ctx) => {
      assert.instanceOf(getSignal(ctx), AbortSignal);
    })[0];
  });

  it("should return an AbortSignal when called from withTimeout", async () => {
    await Context.withTimeout(null, 1000, async (ctx) => {
      assert.instanceOf(getSignal(ctx), AbortSignal);
    });
  });
});

describe("getAbortController", () => {
  it("should not return an AbortController from an empty context", () => {
    const ctx: Context = Context.TODO();
    assert.equal(getAbortController(ctx), null);
  });

  it("should return an AbortController when called from withAbort", async () => {
    await Context.withAbort(null, async (ctx) => {
      assert.instanceOf(getAbortController(ctx), AbortController);
    })[0];
  });

  it("should return an AbortController when called from withTimeout", async () => {
    await Context.withTimeout(null, 1000, async (ctx) => {
      assert.instanceOf(getAbortController(ctx), AbortController);
    });
  });
});
