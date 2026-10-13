# Sedona Breath

Автономное нативное приложение для часов на HarmonyOS (ArkTS / ArkUI, Stage Model). За 2–10 минут оно проводит через управляемое дыхание, вопросы метода Седоны и мягкое завершение с возвратом к дыханию. В конце можно оценить состояние, а история сохраняется только на часах.

> Это приложение для самопомощи, а не медицинское изделие. Оно не ставит диагнозы и не заменяет психотерапию, врача или экстренную помощь.

## Две сборки

| Часы | Проект | Стек |
|---|---|---|
| `wearable`: Huawei Watch 5, Watch Ultimate и другие с HarmonyOS 5+ | корень репозитория | ArkTS / ArkUI, Stage |
| `liteWearable`: **Huawei Watch Fit 4, Fit 4 Pro** и другие lite-часы | [`lite/`](lite/README.md) | JS / HML / CSS, FA |

Fit 4 и Fit 4 Pro — это lite wearable на LiteOS: ArkTS-пакеты они не принимают. Для них есть отдельная lite-версия в [`lite/`](lite/README.md). Логика сессии (дыхательный движок, вибрация, план, правила поддержки) и все строки у обеих версий общие: lite-файлы `core/*.js` и `i18n/strings.js` генерирует `tools/build-lite.mjs` из ArkTS-исходников.

## Что реализовано

| | |
|---|---|
| Экраны | 11 экранов: Home, Setup, Breathing, Sedona prompt, Completion breathing, Check-in, Completion message, Summary, History, Settings, Onboarding |
| Режимы | «Быстрое снятие стресса» (вопросы 1–4), «Полная практика» (вопросы 1–5 и выбор эмоции после вопроса 1) |
| Дыхание | 4-7-8 (по умолчанию), 4-6, квадрат 4-4-4-4, 4-2-6, свободный ритм (вдох и выдох задаются отдельно, не больше 6 дыханий в минуту) |
| Вибрация | 3 импульса в секунду на вдохе, последняя секунда вдоха без вибрации; на задержке по импульсу в секунду и двойной импульс в последнюю секунду; на выдохе тишина; в конце сессии один длинный импульс |
| Прерывания | Выключение экрана, циферблат, звонок, низкий заряд → пауза и сохранение прогресса → «Продолжить / Завершить»; восстановление после того, как система выгрузила процесс |
| Завершение | «Продолжить» / «Завершить сейчас» (не сохраняется) / «Завершить и сохранить» (статус «Прервана» и этап, на котором остановились) |
| Данные | Только на часах: Preferences (настройки и снимок сессии) и RelationalStore (история). Без сети и аналитики |
| Локализация | ru (по умолчанию) / en / es, выбор языка вручную; в коде нет пользовательских строк |
| Health Kit | Опционально, после явного согласия; пульс — по отдельному согласию |
| Тесты | 36 unit-тестов ядра (hypium) и инструментальные тесты хранения и локализации |

## Быстрый старт

```bash
# сборка отладочного HAP (нужен DevEco Studio 6.x с SDK HarmonyOS, API 12+)
node "C:/Program Files/Huawei/DevEco Studio/tools/hvigor/bin/hvigorw.js" --mode module -p module=entry@default -p product=default assembleHap --no-daemon
```

```bash
# unit-тесты ядра в ArkTS-рантайме (то же, что Run → Local Test в DevEco)
node "C:/Program Files/Huawei/DevEco Studio/tools/hvigor/bin/hvigorw.js" --mode module -p module=entry@default -p product=default test --no-daemon
```

```bash
# те же тесты под Node, без DevEco runtime (для быстрого цикла и CI)
node tools/node-test/run.mjs
```

```bash
# статическая проверка локализации: паритет ключей, плейсхолдеры, длины строк, захардкоженный текст (обе версии)
node tools/check-i18n.mjs
```

```bash
# lite-версия: перегенерировать общее ядро и строки, затем прогнать её тесты
node tools/build-lite.mjs
```

```bash
node tools/node-test/lite.mjs
```

Подпись, установка на часы и отладка по Wi-Fi описаны в [docs/BUILD_AND_RUN.md](docs/BUILD_AND_RUN.md).

## Документация

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — модули, state management, модели, движки, хранение, навигация
- [docs/BUILD_AND_RUN.md](docs/BUILD_AND_RUN.md) — тип проекта, module.json5, permissions, подпись, запуск на часах, HDC, release
- [docs/HEALTH_KIT.md](docs/HEALTH_KIT.md) — разрешения, отказ, запись, работа без Health Kit
- [docs/LIMITATIONS.md](docs/LIMITATIONS.md) — ограничения платформы и моделей
- [docs/TEST_PLAN.md](docs/TEST_PLAN.md) — unit-тесты и ручные сценарии

## Структура

```
AppScope/                     app.json5, иконка приложения
entry/src/main/
  module.json5                wearable, EntryAbility, карточка быстрого старта, VIBRATE
  ets/core/                   чистая логика (общая с lite-версией)
  ets/services/               платформа: вибратор, Preferences, RDB, Health Kit, язык, батарея, окно
  ets/pages/Index.ets         Navigation-хост
  ets/views/                  экраны
  ets/components/             общие компоненты и отображение enum → ресурс
  ets/widget/                 карточка «3 мин»
  resources/{base,en,es}/     строки (base = русский)
entry/src/test/               локальные unit-тесты (hypium)
entry/src/ohosTest/           инструментальные тесты (хранение, локализация)
lite/                         lite-версия для Watch Fit 4 / Fit 4 Pro (отдельный проект DevEco)
tools/                        node-раннеры тестов, проверка локализации, генератор lite-ядра
docs/
```
