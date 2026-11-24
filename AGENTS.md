# Логи

```
backend.py   FastAPI :8099 — SSH-опрос роутеров Huawei VRP, SQLite, API, SSE
admin/       Next.js-панель
```

## Запуск

```bash
cp .env.example .env      # задайте MONINI_ADMIN_PASS
./dev.sh                  # бэкенд :8099 + панель :3000
```

`dev.sh` подхватывает `.env`, поднимает `backend.py` и панель из `admin/`.

## Переменные окружения

| Переменная             | Где     | Назначение                                   |
| ---------------------- | ------- | -------------------------------------------- |
| `MONINI_ADMIN_USER`    | бэкенд  | логин Basic Auth                             |
| `MONINI_ADMIN_PASS`    | бэкенд  | пароль Basic Auth (обязателен)               |
| `HUAWEI_POLL_INTERVAL` | бэкенд  | период тяжёлого снапшота, сек                |
| `HUAWEI_SLOW_INTERVAL` | бэкенд  | период «медленных» команд (logbuffer и др.)  |
| `MONINI_DB`            | бэкенд  | путь к SQLite                                |
