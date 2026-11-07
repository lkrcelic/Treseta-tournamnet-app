import assert from "node:assert/strict";
import {test} from "node:test";
import {createOverlayHistory, HistoryLike} from "../overlayHistory";

// The phone's Back closes the open sheet (and only the top one) instead of leaving the page (#8)

// A tab's history: entries with a state, the current index; back() fires popstate (synchronously here)
function fakeTab() {
  const entries: {page: string; state: unknown}[] = [{page: "prev", state: {next: true}}, {page: "pad", state: {next: true}}];
  let at = 1;
  let onPop = () => {};
  const history: HistoryLike = {
    get state() {
      return entries[at].state;
    },
    pushState(data) {
      entries.splice(at + 1);
      entries.push({page: entries[at].page, state: data});
      at += 1;
    },
    replaceState(data) {
      entries[at] = {...entries[at], state: data};
    },
    back() {
      if (at === 0) return;
      at -= 1;
      onPop();
    },
  };
  const nav = (page: string) => {
    entries.splice(at + 1);
    entries.push({page, state: {next: true}});
    at += 1;
  };
  const replace = (page: string) => {
    entries[at] = {page, state: {next: true}};
  };
  return {
    history,
    nav,
    replace,
    page: () => entries[at].page,
    length: () => entries.length,
    listen: (f: () => void) => (onPop = f),
  };
}

function setup() {
  const tab = fakeTab();
  const pops: boolean[] = [];
  const oh = createOverlayHistory({history: () => tab.history, afterPop: (c) => pops.push(c)});
  tab.listen(() => oh.popped());
  return {tab, oh, pops};
}

test("Back with a sheet open closes the sheet and stays on the page", () => {
  const {tab, oh, pops} = setup();
  let closed = 0;
  oh.opened(() => closed++, () => false);
  assert.equal(tab.length(), 3);
  tab.history.back();
  assert.equal(closed, 1);
  assert.equal(tab.page(), "pad");
  assert.equal(oh.openCount(), 0);
  assert.deepEqual(pops, [true]);
  // the next Back leaves the page as before
  tab.history.back();
  assert.equal(tab.page(), "prev");
});

test("a busy sheet ignores Back and gets its entry back", () => {
  const {tab, oh} = setup();
  let busy = true;
  let closed = 0;
  oh.opened(() => closed++, () => busy);
  tab.history.back();
  assert.equal(closed, 0);
  assert.equal(oh.openCount(), 1);
  assert.equal(tab.length(), 3);
  busy = false;
  tab.history.back();
  assert.equal(closed, 1);
  assert.equal(tab.page(), "pad");
});

test("stacked overlays: Back closes only the top one, then the one under it", () => {
  const {tab, oh} = setup();
  const closed: string[] = [];
  oh.opened(() => closed.push("sponzor"), () => false);
  oh.opened(() => closed.push("crop"), () => false);
  tab.history.back();
  assert.deepEqual(closed, ["crop"]);
  tab.history.back();
  assert.deepEqual(closed, ["crop", "sponzor"]);
  assert.equal(tab.page(), "pad");
});

test("a sheet closed by ✕ or after saving: one Back still leaves the page", () => {
  const {tab, oh} = setup();
  const h = oh.opened(() => assert.fail("not by Back"), () => false);
  oh.closed(h);
  tab.history.back();
  assert.equal(tab.page(), "prev");
});

test("opening a sheet again reuses the spent entry, so entries don't pile up", () => {
  const {tab, oh} = setup();
  for (let i = 0; i < 3; i++) oh.closed(oh.opened(() => {}, () => false));
  assert.equal(tab.length(), 3);
  let closed = 0;
  oh.opened(() => closed++, () => false);
  assert.equal(tab.length(), 3);
  tab.history.back();
  assert.equal(closed, 1);
  assert.equal(tab.page(), "pad");
});

test("the crop closed by Odustani: Back closes Novi sponzor under it", () => {
  const {tab, oh} = setup();
  let sponzor = 0;
  oh.opened(() => sponzor++, () => false);
  oh.closed(oh.opened(() => assert.fail("crop already closed"), () => false));
  tab.history.back();
  assert.equal(sponzor, 1);
  assert.equal(tab.page(), "pad");
});

test("a page left with its sheet open: Back returns to the page, then leaves it", () => {
  const {tab, oh} = setup();
  const h = oh.opened(() => assert.fail("unmounted"), () => false);
  tab.nav("next");
  oh.closed(h);
  tab.history.back();
  assert.equal(tab.page(), "pad");
  tab.history.back();
  assert.equal(tab.page(), "prev");
});

test("a sheet's entry replaced by a navigation still leaves the page with Back", () => {
  const {tab, oh} = setup();
  oh.closed(oh.opened(() => {}, () => false));
  tab.replace("pad?mec=2");
  tab.history.back();
  assert.equal(tab.page(), "prev");
});

test("a reload on a sheet's entry: the entry counts as spent", () => {
  const tab = fakeTab();
  const first = createOverlayHistory({history: () => tab.history});
  first.opened(() => {}, () => false);
  const reloaded = createOverlayHistory({history: () => tab.history});
  tab.listen(() => reloaded.popped());
  reloaded.loaded();
  // the next sheet takes that entry over instead of adding one
  let closed = 0;
  reloaded.opened(() => closed++, () => false);
  assert.equal(tab.length(), 3);
  tab.history.back();
  assert.equal(closed, 1);
});
