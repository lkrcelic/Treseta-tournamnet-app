import assert from "node:assert/strict";
import {test} from "node:test";
import {
  arrivalKind,
  enter,
  labelNavEntry,
  NAV_STACK_MAX,
  NavStack,
  nextNavStack,
  noteReplace,
  notePop,
  parseNavStack,
  previewNavStack,
  previous,
  push,
  readNavStack,
  recordNavigation,
  relabel,
  replaceTop,
  reset,
  stackDepth,
  startNavStack,
  startOver,
  visit,
  writeNavStack,
} from "../navStack";

// The page stack of the Team, Player, Rejting and league pages (handoff §6): Back returns to the previous page step by
// step, Home and the nav drawer start afresh, and the stack stays in step with the browser's history

const paths = (s: NavStack) => s.map((e) => e.path);
const link = {kind: "push", fresh: false, first: false, loadType: null} as const;

test("enter: the page below the top is a step back, the top a reload, anything else a step forward", () => {
  const s = [
    {path: "/teams/29", label: "Puleni"},
    {path: "/players/7", label: "Ivan Perić"},
  ];
  assert.deepEqual(enter(s, "/teams/29"), [{path: "/teams/29", label: "Puleni"}]);
  assert.equal(enter(s, "/players/7"), s);
  assert.deepEqual(paths(enter(s, "/ratings/7")), ["/teams/29", "/players/7", "/ratings/7"]);
  assert.deepEqual(enter([], "/teams/29"), [{path: "/teams/29", label: null}]);
});

test("enter: several pages back at once (the browser's history menu) pops to that page", () => {
  const s = push(push(startOver("/teams/29", "Puleni"), "/players/7", "Ivan Perić"), "/ratings/7");
  assert.deepEqual(enter(s, "/teams/29"), [{path: "/teams/29", label: "Puleni", root: true}]);
  assert.equal(previous(enter(s, "/teams/29")), null);
  // to the nearest entry of that page
  const twice = push(push(s, "/teams/29"), "/players/8");
  assert.deepEqual(paths(enter(twice, "/teams/29")), ["/teams/29", "/players/7", "/ratings/7", "/teams/29"]);
  assert.deepEqual(paths(enter(twice, "/players/7")), ["/teams/29", "/players/7"]);
});

test("enter keeps a known name and takes a newly given one", () => {
  const s = [{path: "/teams/29", label: "Puleni"}];
  assert.equal(enter(s, "/teams/29", null), s);
  assert.equal(enter(s, "/teams/29", "Puleni"), s);
  assert.deepEqual(enter(s, "/teams/29", "Puleni 2"), [{path: "/teams/29", label: "Puleni 2"}]);
  // back to a page whose name changed meanwhile (a renamed team)
  assert.deepEqual(enter([...s, {path: "/players/7", label: null}], "/teams/29", "Novi Puleni"), [{path: "/teams/29", label: "Novi Puleni"}]);
});

test("a link to the page below the top is a new page, as in the browser's history", () => {
  // Puleni → Ivan Perić → his team Puleni again: Back from there returns to Ivan Perić
  const s = push(push(push([], "/teams/29", "Puleni"), "/players/7", "Ivan Perić"), "/teams/29");
  assert.deepEqual(paths(s), ["/teams/29", "/players/7", "/teams/29"]);
  assert.deepEqual(previous(s), {path: "/players/7", label: "Ivan Perić"});
  // the same link twice is one page
  assert.equal(push(s, "/teams/29"), s);
});

test("a replace swaps the top page, and a root stays a root", () => {
  const s = push(startOver("/ratings"), "/ratings/7");
  assert.deepEqual(paths(replaceTop(s, "/ratings/9")), ["/ratings", "/ratings/9"]);
  assert.equal(previous(replaceTop(s, "/ratings/9"))?.path, "/ratings");
  assert.deepEqual(paths(replaceTop([], "/teams/29")), ["/teams/29"]);
  assert.equal(replaceTop(s, "/ratings/7"), s);
  // Rejting opened from the menu, then a row picked (the URL follows the selection): still nothing to go back to
  assert.equal(previous(replaceTop(startOver("/ratings"), "/ratings/7")), null);
});

test("visit picks the rule by how the browser got there", () => {
  const s = push(push([], "/teams/29"), "/players/7");
  assert.deepEqual(paths(visit(s, "/teams/29", "pop")), ["/teams/29"]);
  assert.deepEqual(paths(visit(s, "/teams/29", "push")), ["/teams/29", "/players/7", "/teams/29"]);
  assert.deepEqual(paths(visit(s, "/teams/30", "replace")), ["/teams/29", "/teams/30"]);
});

test("a root has no Back, but keeps the pages before it for the browser's Back", () => {
  const before = push(startOver("/teams/29", "Puleni"), "/players/7", "Ivan Perić");
  const home = reset(before, "/");
  assert.deepEqual(paths(home), ["/teams/29", "/players/7", "/"]);
  assert.equal(previous(home), null);
  // the browser's Back from Home returns to Ivan Perić, who still has his Back to Puleni
  const back = enter(home, "/players/7");
  assert.deepEqual(previous(back), {path: "/teams/29", label: "Puleni", root: true});
  // the page shown becomes a root (the nav drawer item of the page shown), keeping its name
  assert.deepEqual(reset(before, "/players/7"), [
    {path: "/teams/29", label: "Puleni", root: true},
    {path: "/players/7", label: "Ivan Perić", root: true},
  ]);
  assert.deepEqual(startOver("/teams/29"), [{path: "/teams/29", label: null, root: true}]);
  assert.equal(previous([]), null);
});

test("Team → Player → Rejting, then Back, Back returns step by step", () => {
  let s: NavStack = reset([], "/league/2/standings");
  s = push(s, "/teams/29", "Puleni");
  s = push(s, "/players/7", "Ivan Perić");
  s = push(s, "/ratings/7", null);
  assert.equal(previous(s)?.label, "Ivan Perić");
  s = enter(s, "/players/7");
  assert.equal(previous(s)?.label, "Puleni");
  s = enter(s, "/teams/29");
  assert.deepEqual(previous(s), {path: "/league/2/standings", label: null, root: true});
  s = enter(s, "/league/2/standings");
  assert.equal(previous(s), null);
  // and Forward again
  s = enter(enter(s, "/teams/29"), "/players/7");
  assert.deepEqual(paths(s), ["/league/2/standings", "/teams/29", "/players/7"]);
});

test("relabel names only the page at the top", () => {
  const s = push(push([], "/teams/29", "Puleni"), "/players/7");
  assert.deepEqual(relabel(s, "/players/7", "Ivan Perić")[1], {path: "/players/7", label: "Ivan Perić"});
  assert.equal(relabel(s, "/teams/29", "Drugo ime"), s);
  assert.equal(relabel([], "/teams/29", "Puleni").length, 0);
});

test("the stack keeps the last pages of a long session", () => {
  let s: NavStack = [];
  for (let i = 0; i < NAV_STACK_MAX + 5; i++) s = push(s, `/teams/${i}`);
  assert.equal(s.length, NAV_STACK_MAX);
  assert.equal(s[s.length - 1].path, `/teams/${NAV_STACK_MAX + 4}`);
  assert.equal(s[0].path, "/teams/5");
});

test("nextNavStack: Home and the nav drawer make roots, a load from outside starts over", () => {
  const s = push(startOver("/teams/29", "Puleni"), "/players/7", "Ivan Perić");
  assert.deepEqual(paths(nextNavStack(s, "/", link)), ["/teams/29", "/players/7", "/"]);
  assert.equal(previous(nextNavStack(s, "/ratings", {...link, fresh: true})), null);
  assert.equal(previous(nextNavStack(s, "/ratings/7", link))?.label, "Ivan Perić");
  // the first page of a document: a reload of the page the stack left off at keeps it, anything else starts over
  assert.equal(nextNavStack(s, "/players/7", {...link, first: true, loadType: "reload"}), s);
  assert.equal(nextNavStack(s, "/players/7", {...link, first: true, loadType: "back_forward"}), s);
  assert.deepEqual(nextNavStack(s, "/teams/29", {...link, first: true, loadType: "back_forward"}), startOver("/teams/29"));
  assert.deepEqual(nextNavStack(s, "/players/7", {...link, first: true, loadType: "navigate"}), startOver("/players/7"));
  assert.deepEqual(nextNavStack(s, "/players/7", {...link, first: true, loadType: null}), startOver("/players/7"));
});

test("/league/current/… opened from outside: the league's page it lands on takes its place, with no Back", () => {
  // a shared "/league/current/standings?team=29": the app starts there, then Next swaps it for the league's page
  const shared = nextNavStack(push(startOver("/profile"), "/teams/29"), "/league/current/standings", {...link, first: true, loadType: "navigate"});
  const landed = nextNavStack(shared, "/league/2/standings", link);
  assert.deepEqual(paths(landed), ["/league/2/standings"]);
  assert.equal(previous(landed), null);
  // opened by a link in the app, the page before it stays the one Back returns to
  const inApp = nextNavStack(push(push(startOver("/"), "/teams/29"), "/league/current/standings"), "/league/2/standings", link);
  assert.deepEqual(paths(inApp), ["/", "/teams/29", "/league/2/standings"]);
  assert.equal(previous(inApp)?.path, "/teams/29");
  // an ordinary page before a link is still pushed over
  assert.deepEqual(paths(nextNavStack(startOver("/league/2/standings"), "/teams/29", link)), ["/league/2/standings", "/teams/29"]);
});

test("a stored stack is read back, anything else is an empty stack", () => {
  const s = [{path: "/teams/29", label: "Puleni", root: true as const}, {path: "/players/7", label: null}];
  assert.deepEqual(parseNavStack(JSON.stringify(s)), s);
  assert.deepEqual(parseNavStack(null), []);
  assert.deepEqual(parseNavStack("not json"), []);
  assert.deepEqual(parseNavStack(JSON.stringify({path: "/"})), []);
  assert.deepEqual(parseNavStack(JSON.stringify([{path: 5, label: null}])), []);
  assert.deepEqual(parseNavStack(JSON.stringify([{path: "/", label: 3}])), []);
  assert.deepEqual(parseNavStack(JSON.stringify([{path: "/", label: null, root: "yes"}])), []);
});

// ---------- recording navigations (no window here, so the store lives in memory) ----------

test("links push, Back pops, a replace swaps, Home is a root", () => {
  recordNavigation("/league/2/standings", true, "navigate");
  recordNavigation("/teams/29", false, null);
  labelNavEntry("/teams/29", "Puleni");
  recordNavigation("/players/7", false, null);
  assert.equal(previous(readNavStack())?.label, "Puleni");

  // Back (popstate) to the team
  notePop("/teams/29");
  assert.deepEqual(paths(previewNavStack(readNavStack(), "/teams/29")), ["/league/2/standings", "/teams/29"]);
  recordNavigation("/teams/29", false, null);
  assert.deepEqual(paths(readNavStack()), ["/league/2/standings", "/teams/29"]);
  // the note is used up: a link to the same page later is a push
  assert.deepEqual(paths(previewNavStack(push(readNavStack(), "/players/7"), "/teams/29")), ["/league/2/standings", "/teams/29", "/players/7", "/teams/29"]);

  // a replace (useTransitionRouter().replace) takes the top's place
  noteReplace("/teams/30");
  recordNavigation("/teams/30", false, null);
  assert.deepEqual(paths(readNavStack()), ["/league/2/standings", "/teams/30"]);

  // a note for a path that never came (a replace that only changed ?tab=) is dropped by the next navigation
  noteReplace("/burza");
  recordNavigation("/players/7", false, null);
  assert.deepEqual(paths(readNavStack()), ["/league/2/standings", "/teams/30", "/players/7"]);

  recordNavigation("/", false, null);
  assert.equal(previous(readNavStack()), null);
  // Android's Back from Home returns to the player, with his Back to the team
  notePop("/players/7");
  recordNavigation("/players/7", false, null);
  assert.equal(previous(readNavStack())?.path, "/teams/30");
});

test("a nav drawer item makes the page it ends on a root", () => {
  writeNavStack(push(startOver("/teams/29"), "/players/7"));
  // Ukupni poredak opens /league/current/standings, which lands on the league being played now
  startNavStack("/league/current/standings", "/players/7");
  assert.deepEqual(paths(readNavStack()), ["/teams/29", "/players/7"]);
  assert.equal(previous(previewNavStack(readNavStack(), "/league/2/standings")), null);
  recordNavigation("/league/2/standings", false, null);
  assert.equal(previous(readNavStack()), null);
  // the next link is an ordinary step again
  recordNavigation("/teams/29", false, null);
  assert.equal(previous(readNavStack())?.path, "/league/2/standings");
  // the item of the page shown makes it a root at once
  startNavStack("/teams/29", "/teams/29");
  assert.equal(previous(readNavStack()), null);
  recordNavigation("/players/7", false, null);
  assert.equal(previous(readNavStack())?.path, "/teams/29");
});

test("Back to Home pops, and Back from there never finds a page that isn't in the tab's history", () => {
  // a shared link to a team, then Home, then Moj profil
  recordNavigation("/teams/29", true, "navigate");
  recordNavigation("/", false, null);
  recordNavigation("/profile", false, null);
  assert.deepEqual(paths(readNavStack()), ["/teams/29", "/", "/profile"]);
  // the phone's Back to Home: Home is on top again, still a root
  notePop("/");
  assert.equal(previous(previewNavStack(readNavStack(), "/")), null);
  recordNavigation("/", false, null);
  assert.deepEqual(readNavStack(), [
    {path: "/teams/29", label: null, root: true},
    {path: "/", label: null, root: true},
  ]);
  // and Back again to the team the tab started with: it has nothing before it
  notePop("/teams/29");
  recordNavigation("/teams/29", false, null);
  assert.deepEqual(paths(readNavStack()), ["/teams/29"]);
  assert.equal(previous(readNavStack()), null);
});

test("a replace that ends on Home takes the top's place as a root", () => {
  recordNavigation("/league/2/standings", true, "navigate");
  recordNavigation("/teams/29", false, null);
  noteReplace("/");
  recordNavigation("/", false, null);
  assert.deepEqual(readNavStack(), [
    {path: "/league/2/standings", label: null, root: true},
    {path: "/", label: null, root: true},
  ]);
});

test("a label for a page that is no longer on top is ignored", () => {
  recordNavigation("/teams/29", true, "navigate");
  recordNavigation("/players/7", false, null);
  labelNavEntry("/teams/29", "Puleni");
  assert.deepEqual(readNavStack(), [
    {path: "/teams/29", label: null, root: true},
    {path: "/players/7", label: null},
  ]);
});

test("a page knows it was reached by Back, and its place in the stack, before and after it is recorded", () => {
  recordNavigation("/league/2/standings", true, "navigate");
  // the first page of a document is a fresh start
  assert.equal(arrivalKind("/league/2/standings"), "push");
  assert.equal(stackDepth("/league/2/standings"), 1);
  // a link to a team: asked while the team page renders, and again once it is recorded
  assert.equal(arrivalKind("/teams/29"), "push");
  assert.equal(stackDepth("/teams/29"), 2);
  recordNavigation("/teams/29", false, null);
  assert.equal(arrivalKind("/teams/29"), "push");
  assert.equal(stackDepth("/teams/29"), 2);
  // Back to the table: the same place it was left at, before and after recording
  notePop("/league/2/standings");
  assert.equal(arrivalKind("/league/2/standings"), "pop");
  assert.equal(stackDepth("/league/2/standings"), 1);
  recordNavigation("/league/2/standings", false, null);
  assert.equal(arrivalKind("/league/2/standings"), "pop");
  assert.equal(stackDepth("/league/2/standings"), 1);
  // a replace, then a link: no longer Back
  noteReplace("/league/3/standings");
  assert.equal(arrivalKind("/league/3/standings"), "replace");
  recordNavigation("/league/3/standings", false, null);
  assert.equal(arrivalKind("/league/3/standings"), "replace");
  recordNavigation("/teams/30", false, null);
  assert.equal(arrivalKind("/teams/30"), "push");
  assert.equal(arrivalKind("/league/3/standings"), "push");
});
