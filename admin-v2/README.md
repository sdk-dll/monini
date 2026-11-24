# Monini Admin v2

Next.js 16 + shadcn/ui админ-панель для мониторинга роутеров Huawei VRP
(бэкенд `backend.py`, FastAPI :8099).

## Запуск

```bash
cd admin-v2
npm install
npm run dev -- -p 3001       # панель на :3001
```

Бэкенд должен быть поднят:

```bash
cd .. && ./dev.sh --backend-only
```

Панель читает `MONINI_ADMIN_USER` / `MONINI_ADMIN_PASS` из `../.env`
(или из окружения) и проксирует `/api/*` на `http://127.0.0.1:8099`
с Basic Auth. Переопределить адрес можно через `MONINI_API_URL`.

## Разделы

| Раздел | Маршрут | Что показывает |
| --- | --- | --- |
| Overview | `/` | KPI, графики CPU/RAM/WAN, активные алерты, статус устройств, SSE-индикатор |
| Live telemetry | `/live` | поток `/api/stream` (1с), живые графики, детали кадра |
| Alerts | `/alerts` | критические/warning/info, фильтры |
| History | `/history` | графики метрик за период, экспорт CSV |
| Devices | `/devices` | список, добавление/редактирование/удаление, тест SSH, выбор активного |
| Network | `/network/*` | интерфейсы, маршруты, ARP, MAC, LLDP, VLAN |
| DHCP | `/dhcp` | пулы, аренда, утилизация |
| System | `/system` | модель, VRP, CPU/RAM, температура, NTP/SSH/DNS |
| Logs | `/logs` | поиск, фильтры по модулю/важности, пагинация |
| Traps | `/traps` | буфер SNMP-трапов |
| Console | `/console` | read-only команды (display/ping/tracert) |
| AI Assistant | `/assistant` | SSE-чат с tool calls (snapshot/history/logs/alerts/command) |
| Settings | `/settings/*` | здоровье бэкенда, AI-настройки, каталог инструментов/API |

## Структура

- `src/app/api/[...path]/route.ts` — серверный прокси с Basic Auth и SSE
- `src/lib/api.ts`, `src/lib/types.ts` — типизированный клиент и модели данных
- `src/components/providers/devices-provider.tsx` — выбор активного устройства
- `src/components/layout/` — сайдбар, хедер, оболочка
- `src/components/blocks/` — страницы по разделам
- `src/lib/navigation.ts` — меню и список метрик
