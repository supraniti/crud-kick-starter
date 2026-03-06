export function setPath(pathnameWithSearch) {
  window.history.pushState({}, "", pathnameWithSearch);
}

export function resetBrowserState() {
  window.localStorage.clear();
  setPath("/");
}
