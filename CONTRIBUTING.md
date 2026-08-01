# Contributing

## Процесс

1. Создайте branch от актуального `main`.
2. Вносите минимальные изменения с отдельными тестами для нового поведения.
3. Выполните локальные Node-проверки без Docker.
4. Откройте pull request и дождитесь workflow `PR quality`.
5. Merge в `main` автоматически собирает image в GitHub Actions, публикует его в YCR и разворачивает production revision.

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

## Infrastructure

- Production resources создаются только скриптами из `scripts/` с `yc --profile default`.
- Не запускайте bootstrap или finalization в рамках тестирования pull request.
- Не выполняйте Docker build локально или на legacy server.
- Не публикуйте image в Docker Hub, GHCR или иной registry: production использует только YCR.
- Изменения API Gateway должны сохранять private container invocation и отдельный gateway service account.
- Новые IAM bindings должны быть resource-scoped, если сервис поддерживает такой уровень.
- Изменения legacy proxy сначала проходят read-only audit и требуют явных host/environment confirmations.

## Secrets

Никогда не коммитьте `.env`/`.local` файлы, Telegram token, IAM token, Object Storage key или содержимое Lockbox. Не включайте `set -x` в shell scripts. Секрет нельзя передавать command-line argument, поскольку он может попасть в process list.

При изменении финализации сохраняйте следующие свойства: hidden stdin для BotFather token, временные файлы `0600`, cleanup trap, отсутствие secret values в stdout/stderr и `setWebhook` только после успешного proxy validation.

## Shell scripts

Все shell scripts используют Bash и обязаны начинаться с:

```bash
#!/usr/bin/env bash
set -euo pipefail
```

Перед pull request запустите `shellcheck scripts/*.sh`, если ShellCheck установлен. Исправляйте причину предупреждения; suppression допустим только рядом с динамическим `source` проверенного локального state.
