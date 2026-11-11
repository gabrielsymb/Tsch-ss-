#!/usr/bin/env bash

set -u

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_URL="http://127.0.0.1:3000/"
HEALTH_URL="${APP_URL}health"

open_app() {
  if [[ "${TSCHUSS_NO_OPEN:-}" == "1" ]]; then
    return
  fi

  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$APP_URL" >/dev/null 2>&1 &
  fi
}

if curl --silent --fail --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
  printf 'O Tschüss já está rodando em %s\n' "$APP_URL"
  open_app
  exit 0
fi

if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  printf 'Arquivo .env não encontrado em %s\n' "$PROJECT_DIR" >&2
  printf 'Crie o .env antes de iniciar o aplicativo.\n' >&2
  read -r -p 'Pressione Enter para fechar.' _
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  NODE_BIN_DIR="$(find "$HOME/.nvm/versions/node" -mindepth 2 -maxdepth 2 -type f -name npm -printf '%h\n' 2>/dev/null | sort -V | tail -n 1)"
  if [[ -n "$NODE_BIN_DIR" ]]; then
    export PATH="$NODE_BIN_DIR:$PATH"
  fi
fi

if ! command -v npm >/dev/null 2>&1; then
  printf 'Node.js/npm não foi encontrado.\n' >&2
  read -r -p 'Pressione Enter para fechar.' _
  exit 1
fi

if command -v pg_isready >/dev/null 2>&1 &&
  ! pg_isready -h 127.0.0.1 -p 5432 -t 2 >/dev/null 2>&1; then
  printf 'Iniciando o PostgreSQL. A senha do computador pode ser solicitada.\n'
  if command -v pg_ctlcluster >/dev/null 2>&1; then
    sudo pg_ctlcluster 16 main start || true
  fi

  if ! pg_isready -h 127.0.0.1 -p 5432 -t 5 >/dev/null 2>&1; then
    printf 'Não foi possível iniciar o PostgreSQL na porta 5432.\n' >&2
    read -r -p 'Pressione Enter para fechar.' _
    exit 1
  fi
fi

cd "$PROJECT_DIR"
printf 'Iniciando o Tschüss em %s\n' "$APP_URL"
printf 'Mantenha esta janela aberta. Use Ctrl+C para desligar o servidor.\n\n'

npm run dev &
SERVER_PID=$!

for _attempt in {1..60}; do
  if curl --silent --fail --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
    open_app
    break
  fi

  if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    wait "$SERVER_PID"
    exit $?
  fi

  sleep 1
done

wait "$SERVER_PID"
