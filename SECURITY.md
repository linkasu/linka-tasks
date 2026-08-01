# Security Policy

## Сообщение об уязвимости

Не создавайте публичный issue с token, Lockbox payload, Object Storage key, session cookie, production response body или данными пользователей. Используйте private security advisory GitHub repository либо согласованный с владельцем проекта закрытый канал.

В сообщении укажите затронутый commit, воспроизводимые шаги, ожидаемое влияние и безопасный способ связаться с вами. Не проверяйте уязвимость на production-данных без отдельного разрешения.

## Секреты

- BotFather token появляется только во время `scripts/finalize-production.sh` и хранится в Lockbox.
- GitHub Actions использует OIDC subject для environment `production`; JSON keys и static IAM keys в GitHub запрещены.
- `infra/.env.production.local` содержит production Object Storage credential, имеет mode `0600` и не должен покидать защищённую рабочую машину.
- Полный `docker compose config`, shell tracing (`set -x`) и печать Telegram API URL с bot token запрещены.
- Lockbox payload, GitHub OIDC JWT и Yandex IAM token не должны попадать в artifacts, cache или logs.

## Компрометация

При подозрении на утечку немедленно остановите deploy, отзовите соответствующий access key или BotFather token, создайте новую Lockbox version и новую container revision. После ротации обновите legacy proxy и повторно выполните `setWebhook` только через финализационный скрипт с явными production confirmations.

Не удаляйте старую Lockbox version до подтверждения работоспособности новой revision и proxy. Сохраните временную шкалу инцидента без значений секретов.

## Границы доверия

Production доступен через Certificate Manager и API Gateway. Serverless Container остаётся private и вызывается только gateway service account. Object Storage bucket не имеет public ACL. Legacy host получает только отдельный proxy secret и не получает YDB, Object Storage или session credentials.
