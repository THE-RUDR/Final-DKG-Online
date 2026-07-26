(function () {
  function cleanBase(value) {
    return String(value || '').trim().replace(/\/+$/, '');
  }

  window.DKG_BACKEND_URL = cleanBase(window.DKG_BACKEND_URL || localStorage.getItem('dkg_backend_url') || '');

  window.dkgApiUrl = function dkgApiUrl(path) {
    var apiPath = String(path || '');
    if (!apiPath.startsWith('/')) apiPath = '/' + apiPath;
    return window.DKG_BACKEND_URL ? window.DKG_BACKEND_URL + apiPath : apiPath;
  };
})();
