(() => {
  const destination = document.documentElement.dataset.redirectTo;
  if (!destination) return;
  window.location.replace(`${destination}${window.location.search}${window.location.hash}`);
})();
