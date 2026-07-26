(function () {
  function enableAppPaneScroll() {
    const pane = document.getElementById('view-container');
    if (!pane || pane.dataset.scrollFixReady === 'true') return;

    pane.dataset.scrollFixReady = 'true';
    let lastY = 0;

    function canScroll() {
      return pane.scrollHeight > pane.clientHeight;
    }

    pane.addEventListener('touchstart', (event) => {
      if (event.touches.length === 1) {
        lastY = event.touches[0].clientY;
      }
    }, { passive: true });

    pane.addEventListener('touchmove', (event) => {
      if (event.touches.length !== 1 || !canScroll()) return;
      const currentY = event.touches[0].clientY;
      const deltaY = lastY - currentY;
      lastY = currentY;
      pane.scrollTop += deltaY;
      event.preventDefault();
    }, { passive: false });

    pane.addEventListener('wheel', (event) => {
      if (!canScroll()) return;
      pane.scrollTop += event.deltaY;
      event.preventDefault();
    }, { passive: false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enableAppPaneScroll);
  } else {
    enableAppPaneScroll();
  }
})();
