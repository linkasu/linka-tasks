# Linka Tasks

Внутренний сервис управления задачами АНО «Линка». Приложение на Nuxt 4 разворачивается только в production-контуре Yandex Cloud. Локальные и серверные сборки Docker запрещены: production image собирает только GitHub Actions и публикует только в Yandex Container Registry (YCR).

## Архитектура

```text
Browser / Telegram
        |
        v
tasks.nkolinka.ru
Certificate Manager + API Gateway (HTTP and WebSocket)
        |
        v
private Serverless Container
        |
        +--> YDB Serverless
        +--> private Object Storage bucket
        +--> Lockbox runtime secrets

Timer triggers --> job bridge Function --> POST /api/jobs/*

GitHub Actions --OIDC--> deploy service account --> YCR + container revisions

Telegram --> bot.todos.nkolinka.ru legacy nginx --> tasks.nkolinka.ru/api/telegram/webhook
```

Production resources находятся в новой папке `linka-tasks-prod` облака `aacidov-main`. Единственное исключение: существующая DNS-зона `nkolinka.ru.` остаётся в папке `nko-linka`.

API Gateway проксирует обычный HTTP-трафик и операции WebSocket `/api/realtime` в один private Serverless Container. Сертификат `tasks.nkolinka.ru` выпускается Certificate Manager через DNS challenge.

## Доступы

Bootstrap создаёт три отдельных service account:

| Account | Назначение | Минимальные права |
| --- | --- | --- |
| `linka-tasks-runtime` | Код приложения | `ydb.editor` на базе, `storage.editor` в изолированной production-папке, `lockbox.payloadViewer` на одном секрете, `api-gateway.websocketWriter` на gateway |
| `linka-tasks-deploy` | GitHub Actions | push image в одном registry, update одного container, use runtime SA, чтение метаданных одного Lockbox secret |
| `linka-tasks-gateway` | API Gateway и timer triggers | invoke одного private container и job bridge Function |

GitHub не хранит JSON key или иной долговременный ключ. Workflow получает короткоживущий GitHub OIDC JWT. Federated credential принимает только subject:

```text
repo:OWNER/REPOSITORY:environment:production
```

## Предварительные условия

- `yc` с авторизованным профилем `default` и правами создавать ресурсы в `aacidov-main`, а также DNS records в `nko-linka`.
- `jq`, `openssl`, `gh`, `ssh`, `scp` и `curl`.
- Созданный GitHub repository с default branch `main`.
- `gh auth status` успешно работает для этого repository.
- Доступ по SSH к `USER@circlestickers.ru` и известен абсолютный путь Compose project.
- BotFather token пока не вводится и нигде не сохраняется до этапа финализации.

Скрипты используют только `yc --profile default`. Они идемпотентно находят ресурсы по имени и не удаляют существующие объекты. При конфликте DNS или потерянном секрете Object Storage key скрипт останавливается вместо перезаписи.

## Bootstrap

Запуск создаёт реальные production-ресурсы. В этом репозитории он только подготовлен и автоматически не запускался.

```bash
./scripts/bootstrap-production.sh
```

Bootstrap создаёт:

- папку `linka-tasks-prod`;
- YDB Serverless с deletion protection;
- private Object Storage bucket без public ACL, с CORS только для `https://tasks.nkolinka.ru` (`PUT`, `GET`, `HEAD`, любые request headers, exposed `ETag`);
- единственный YCR registry;
- private Serverless Container без обязательной первой revision;
- пустую job bridge Function без version: код и Lockbox binding появятся только при финализации;
- пустой Lockbox secret с deletion protection, без Telegram token и без payload version;
- runtime, deploy и gateway service accounts и resource-scoped bindings;
- HTTP/WebSocket API Gateway из `infra/api-gateway.yaml.tpl`;
- managed certificate и DNS records для `tasks.nkolinka.ru`.

Локальные IDs и единственный доступный при создании secret Object Storage key записываются с mode `0600` в `infra/.env.production.local`. Файл игнорируется правилом `.env.*`. Его необходимо хранить как production credential и не прикладывать к issue, CI artifact или сообщению.

Certificate Manager может некоторое время оставаться в `VALIDATING`. В этом случае bootstrap завершится без token и попросит повторить ту же команду после DNS propagation.

Успешный bootstrap останавливается до BotFather token и печатает точную следующую команду финализации:

```bash
./scripts/finalize-production.sh
```

Сначала нужно подключить GitHub и получить первую container revision.

## GitHub OIDC

После создания repository выполните:

```bash
./scripts/configure-github-oidc.sh OWNER/REPOSITORY
```

Скрипт идемпотентно создаёт workload identity federation, federated credential с environment subject, GitHub environment `production` и несекретные repository variables. Затем отправьте `main` в GitHub.

`PR quality` выполняет `npm ci`, lint, typecheck, Vitest и Nuxt build. `Deploy production` повторяет quality job, обменивает GitHub OIDC JWT на короткоживущий Yandex IAM token, собирает Docker image в GitHub-hosted runner, отправляет immutable SHA tag и `latest` в YCR и создаёт revision. Workflow передаёт repository variable `TELEGRAM_BOT_USERNAME` в `NUXT_TELEGRAM_BOT_USERNAME`; до финализации значение ожидаемо пустое.

Первый deploy выполняется до появления Lockbox version. В revision нет Telegram и Object Storage credentials; приложение и публичная оболочка могут стартовать, а Telegram-аутентификация остаётся недоступной. Это ожидаемый безопасный промежуточный режим. Workflow не подставляет пустые секреты и не блокирует deployment.

Нельзя выполнять `docker build`, `docker compose build` или сборку image на `circlestickers.ru`. Изменения Dockerfile проверяются только PR checks и собираются production workflow.

## Финализация

После успешного первого `Deploy production` выполните ровно:

```bash
./scripts/finalize-production.sh
```

Первый запуск выполняет только SSH/Compose audit и останавливается до чтения token и любых изменений Lockbox, container revision, proxy или Telegram. После проверки используйте напечатанную команду с `--apply-proxy` и явными подтверждениями.

Apply-запуск:

1. До token проверяет все аргументы, локальный proxy env, GitHub access, SSH target, remote paths и выполняет read-only audit: service names, image names и `docker compose ps`. Полный `docker compose config` не выводится, поскольку он может содержать secrets.
2. При отсутствии Lockbox version скрыто читает BotFather token из stdin. Token не передаётся аргументом процесса и не печатается.
3. Вызывает Telegram `getMe`, проверяет username, передаёт `NUXT_TELEGRAM_BOT_USERNAME` в revision и записывает `TELEGRAM_BOT_USERNAME` в GitHub repository variables.
4. Генерирует отдельные random secrets для Telegram webhook, legacy proxy, session и internal jobs и создаёт первую Lockbox version вместе с Object Storage credentials.
5. Создаёт новую container revision того же image с точными Lockbox bindings.
6. Создаёт version job bridge Function с `internal-job-secret` из Lockbox и идемпотентно создаёт или обновляет два timer trigger. Каждый раз в минуту bridge делает `POST` к `/api/jobs/outbox` и `/api/jobs/recurrences` с header `x-internal-job-secret`.
7. Проверяет и перезагружает legacy nginx, затем вызывает Telegram `setWebhook`.

Если в Lockbox уже есть current version, обычный apply повторно использует её независимо от локального `LOCKBOX_VERSION_ID`: token читается из Lockbox, новая version не создаётся. Ротация возможна только с явным `--rotate-secrets` и полным proxy preflight/apply, чтобы не менять связанные app/proxy secrets до успешного аудита.

Для неинтерактивной передачи token допустим только защищённый stdin из secret manager. Не помещайте token в shell argument или environment history.

### Legacy proxy и setWebhook

Подготовьте локальный ignored-файл по примеру `infra/legacy-proxy/proxy.env.example`. Все пути должны быть абсолютными. `PROXY_REMOTE_CONFIG` указывает на отдельный host-level nginx virtual host для `bot.todos.nkolinka.ru`. До запуска finalizer создайте A-record на legacy server, установите `certbot` и выпустите Let's Encrypt certificate через webroot `/var/www/linka-tasks-acme`. Nginx template сохраняет ACME path доступным для автоматического renewal. Finalizer откатывает config, если `nginx -t` или reload завершается ошибкой.

После ручной проверки audit выполните команду, напечатанную скриптом:

```bash
./scripts/finalize-production.sh \
  --legacy-host USER@circlestickers.ru \
  --legacy-compose-dir /ABSOLUTE/COMPOSE/PATH \
  --apply-proxy \
  --proxy-env-file /ABSOLUTE/PATH/proxy.env.local \
  --confirm-environment production \
  --confirm-host bot.todos.nkolinka.ru
```

Без всех трёх явных значений `--legacy-host`, `--confirm-host` и `--confirm-environment production` изменения не применяются. Apply атомарно обновляет отдельный host-level nginx virtual host, выполняет `nginx -t`, reload и только после успешной проверки вызывает Telegram `setWebhook`. При ошибке предыдущий config восстанавливается. Bot token остаётся в Lockbox и во временном файле `0600`, удаляемом trap.

Revision использует поддерживаемый текущим `yc` флаг `--zone-instances-limit 1` как временную границу масштабирования для логики с process-local serialization. Это лимит на availability zone, а не строгий глобальный singleton; долговременное решение должно обеспечивать распределённую сериализацию через YDB. Глобального `--max-instances` в локальном `yc 1.16.0` нет.

## Операции

### Обычный deploy

Merge в `main` автоматически создаёт новый SHA-tagged image и revision. Если Lockbox version уже существует, workflow сохраняет все bindings. Ручной Docker build не нужен и запрещён.

### Проверка deployment

```bash
yc serverless container revision list \
  --container-id "$CONTAINER_ID" \
  --folder-id "$FOLDER_ID" \
  --profile default
```

Проверьте `https://tasks.nkolinka.ru`, login flow и WebSocket reconnect. Не выводите Lockbox payload или полный Compose config в terminal recording и CI logs.

### Ротация runtime secrets

Добавьте `--rotate-secrets` к полной команде `--apply-proxy` из раздела выше. Команда сначала повторит все локальные, GitHub и SSH проверки и audit, только затем запросит BotFather token, создаст новую Lockbox version, revision и согласованно обновит proxy/webhook. Отдельный запуск `--rotate-secrets` без proxy apply останавливается до token и ничего не ротирует.

### Rollback

YCR image помечен commit SHA. Для rollback экспортируйте значения из `infra/.env.production.local` в ожидаемые `scripts/deploy-production-revision.sh` переменные и передайте предыдущий immutable image URI. Не перемещайте `latest` вручную и не собирайте image локально.

### Потеря локального state

IDs можно восстановить через `yc list`, но Object Storage secret access key восстановить нельзя. Bootstrap обнаружит существующий key и остановится, не создавая бесконтрольно новый. Отзовите потерянный key, создайте новый по процедуре ротации и обновите Lockbox.

## Локальная разработка

Docker для разработки не используется.

```bash
npm ci
npm run dev
```

Проверки:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Vitest запускает unit suite и настроен с `passWithNoTests`, чтобы временно пустой suite не блокировал infrastructure-only ветку.

## Документы

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
- [infra/api-gateway.yaml.tpl](infra/api-gateway.yaml.tpl)
- [infra/legacy-proxy/proxy.env.example](infra/legacy-proxy/proxy.env.example)
