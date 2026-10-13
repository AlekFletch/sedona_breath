// Minimal @ohos/hypium-compatible shim so the same local unit tests run under Node.
type Fn = () => void;
interface Case { suite: string; name: string; fn: Fn }
const cases: Case[] = [];
let currentSuite = '';

export function describe(name: string, body: Fn): void {
  const prev = currentSuite;
  currentSuite = name;
  body();
  currentSuite = prev;
}
export function it(name: string, _filter: number, fn: Fn): void {
  cases.push({ suite: currentSuite, name, fn });
}
export function beforeAll(_f: Fn): void {}
export function beforeEach(_f: Fn): void {}
export function afterEach(_f: Fn): void {}
export function afterAll(_f: Fn): void {}

class Expect {
  constructor(private v: unknown) {}
  private fail(msg: string): never { throw new Error(msg); }
  assertEqual(e: unknown): void { if (this.v !== e) this.fail(`expected ${JSON.stringify(e)} but got ${JSON.stringify(this.v)}`); }
  assertTrue(): void { if (this.v !== true) this.fail(`expected true but got ${JSON.stringify(this.v)}`); }
  assertFalse(): void { if (this.v !== false) this.fail(`expected false but got ${JSON.stringify(this.v)}`); }
  assertContain(e: unknown): void { if (!(this.v as string).includes(e as string)) this.fail(`${this.v} does not contain ${e}`); }
  assertUndefined(): void { if (this.v !== undefined) this.fail(`expected undefined`); }
  assertLarger(e: number): void { if (!((this.v as number) > e)) this.fail(`${this.v} <= ${e}`); }
}
export function expect(v: unknown): Expect { return new Expect(v); }

export function run(): number {
  let failed = 0;
  for (const c of cases) {
    try { c.fn(); console.log(`  ok   ${c.suite} > ${c.name}`); }
    catch (e) { failed++; console.log(`  FAIL ${c.suite} > ${c.name}: ${(e as Error).message}`); }
  }
  console.log(`\n${cases.length - failed}/${cases.length} passed`);
  return failed;
}
