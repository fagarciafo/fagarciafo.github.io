#!/bin/bash
# Instalador del ejecutor de GitHub Actions para el seguimiento del Colegio Rodolfo Llinás.
# Deja este Mac (chip Apple) leyendo la página del colegio para el repositorio fagarciafo/bot-secop,
# porque el Portal Red Académica solo responde a conexiones desde Colombia.
#
# Uso, en la app Terminal:
#   curl -fsSL https://fagarciafo.github.io/colegio-llinas/instalar-mac.sh | bash
#
# Qué instala: ~/actions-runner (el ejecutor oficial de GitHub y un Python propio). No usa sudo
# ni modifica el sistema. Para desinstalar:  cd ~/actions-runner && ./svc.sh uninstall
set -eo pipefail
REPO_URL="https://github.com/fagarciafo/bot-secop"
DIR="$HOME/actions-runner"
NOMBRE="macbook-alejandro"

if [ "$(uname -s)" != "Darwin" ] || [ "$(uname -m)" != "arm64" ]; then
  echo "Este instalador es para Mac con chip Apple (M1, M2, M3…)."
  exit 1
fi
mkdir -p "$DIR"
cd "$DIR"

echo "1/5 · Descargando el ejecutor de GitHub…"
if [ ! -x ./config.sh ]; then
  VER=$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest \
        | sed -n 's/.*"tag_name": *"v\([0-9.]*\)".*/\1/p' | head -1)
  curl -fL# -o runner.tar.gz "https://github.com/actions/runner/releases/download/v${VER}/actions-runner-osx-arm64-${VER}.tar.gz"
  tar xzf runner.tar.gz
  rm -f runner.tar.gz
fi

echo "2/5 · Descargando Python (solo para este ejecutor; no toca el sistema)…"
if [ ! -x ./python/bin/python3 ]; then
  URL=$(curl -fsSL https://api.github.com/repos/astral-sh/python-build-standalone/releases/latest \
        | grep -oE 'https://[^"]*cpython-3\.1[23]\.[0-9]+(\+|%2B)[0-9]+-aarch64-apple-darwin-install_only\.tar\.gz' | head -1)
  curl -fL# -o python.tar.gz "$URL"
  tar xzf python.tar.gz
  rm -f python.tar.gz
fi
./python/bin/python3 -m pip install --quiet --disable-pip-version-check requests beautifulsoup4

echo "3/5 · Comprobando que este Mac llega a la página del colegio…"
curl -s -o /dev/null -w "   Respuesta del portal: %{http_code} (200 = bien)\n" --max-time 30 \
  https://www.redacademica.edu.co/colegios/colegio-rodolfo-llinas-ied || echo "   El portal no respondió ahora; no impide la instalación."

echo "4/5 · Registro en GitHub"
if [ -f .runner ]; then
  echo "   Este Mac ya estaba registrado."
else
  open "$REPO_URL/settings/actions/runners/new?arch=arm64&os=osx" || true
  echo "   Se abrió GitHub en el navegador. En la sección «Configure» copia el código largo"
  echo "   que aparece después de  --token  (solo el código, sin --token)."
  read -r -p "   Pega aquí ese código y pulsa Enter: " TOKEN < /dev/tty
  ./config.sh --unattended --url "$REPO_URL" --token "$TOKEN" --name "$NOMBRE" --labels colegio --replace
fi

echo "5/5 · Dejándolo como servicio (arranca solo cada vez que inicias sesión)…"
./svc.sh install >/dev/null 2>&1 || true
./svc.sh start
./svc.sh status | tail -2
echo
echo "Listo. Puedes cerrar esta ventana y avisarle a Claude."
