(() => {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const invite = params.get('invite');
  const origin = params.get('origin');
  let server;
  try {
    server = new URL(origin);
  } catch (_) {
    server = null;
  }
  const valid = typeof invite === 'string' && /^[A-Za-z0-9_-]{43}$/.test(invite) &&
    server && server.protocol === 'https:' && !server.username && !server.password &&
    !server.port && server.pathname === '/' && !server.search && !server.hash &&
    Array.from(params).length === 2;
  const open = document.getElementById('open-app');
  const intro = document.getElementById('intro');
  const help = document.getElementById('help');
  if (!valid) {
    intro.textContent = 'Este enlace de vinculación no es válido o ya no incluye un código. Genera uno nuevo en «Conectar móvil» en el ordenador.';
    help.textContent = 'Si ya tienes Inhouse Photos, también puedes abrirla y escanear un QR nuevo desde la pantalla de inicio.';
    return;
  }
  open.href = 'inhousephotos://vincular?origin=' + encodeURIComponent(server.origin) +
    '&invite=' + encodeURIComponent(invite);
  open.hidden = false;
})();
