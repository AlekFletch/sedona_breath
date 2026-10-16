# Публикация Sedona Breath Lite в AppGallery

Чек-лист и тексты для карточки приложения. Публикуется lite-версия (`lite/`, bundle `com.alekfletch.sedonabreath.lite`, устройства `liteWearable`: Watch Fit 4 / Fit 4 Pro). ArkTS-версия на устройстве не запускалась и в этот выпуск не входит.

## 1. Перед загрузкой

- [x] Сборка `1014g` (или новее) проверена на часах: полная и быстрая практика до итога, «Ещё раз», «Свободен», пауза, история, настройки, колесо и свайп «назад».
- [x] Изменения закоммичены, версия в `lite/entry/src/main/config.json` (`version.code` / `version.name`) поднята для каждой новой загрузки.
- [x] Release-сертификат `SedonaLiteRelease` и профиль `SedonaLiteReleaseProfile` созданы 16.10.2026 (до 16.10.2029), подпись `release` прописана в `lite/build-profile.json5` (раздел 2).
- [x] Пакет `lite/out/SedonaBreathLite-1.0.0-release.app` собран release-подписью 16.10.2026 (раздел 3). Пересобрать после последних правок и проверки на часах.
- [x] Карточка создана 16.10.2026 (App ID 6917618960378478308): название «Sedona Breath» на en/ru/es-ES/es-419 (совпадает с `MainAbility_label`), значок, устройство «Спортивные часы», категория «Здоровье и спорт», e-mail поддержки, описания, 198 стран без материкового Китая, рейтинг 3+, политика, ИИ не используется, примечание для модератора, бесплатно.
- [x] В `config.json` есть `distroFilter`: только прямоугольный экран 408×480 (у Breath Trainer модерация отклонила версию, обрезанную на круглых часах).
- [x] Значок пакета и магазина — круг на прозрачном фоне (`AppScope/.../foreground.png`), как у Breath Trainer.
- [x] Пакет `SedonaBreathLite-1.0.0-release.app` загружен в черновик 16.10.2026.
- [x] Скриншоты загружены: en — `store/screenshots-square/en/`, es-ES и es-419 — `es/`, ru — `ru/` (по 6).
- [ ] Отправить на проверку.
- [x] Политика конфиденциальности доступна по публичной ссылке (раздел 4).

## 2. Release-подпись (AppGallery Connect)

Сделано 16.10.2026. Файлы: `lite/signing/sedonalite-release.cer` и `sedonalite-release.p7b` (ключ тот же, `sedonalite.p12`). Так это делается заново, *Certificates, App IDs and Profiles*:

1. **Certificates → New certificate**: имя `SedonaLiteRelease`, тип **Release**, загрузить `lite/signing/sedonalite.csr` (тот же ключ, что у debug). Скачать `.cer` → `lite/signing/sedonalite-release.cer`.
2. **Profiles → Add**: проект Sedona Breath, App `com.alekfletch.sedonabreath.lite`, тип **Release**, сертификат `SedonaLiteRelease`. Скачать `.p7b` → `lite/signing/sedonalite-release.p7b`.
3. В `lite/build-profile.json5` добавить в `signingConfigs` конфиг `release` (тот же `.p12`, alias и пароли, новые `.cer` и `.p7b`) и продукт `release`, который на него ссылается. Фильтр `tools/strip-signing.cjs` уберёт подпись из git.

## 3. Сборка пакета

```bash
cd lite && node "C:/Program Files/Huawei/DevEco Studio/tools/hvigor/bin/hvigorw.js" --mode project -p product=release -p buildMode=release assembleApp --no-daemon
```

Перед сборкой удалить `lite/build` и `lite/entry/build`. Нужна переменная `DEVECO_SDK_HOME=C:/Program Files/Huawei/DevEco Studio/sdk`. Результат: `lite/build/outputs/release/lite-release-signed.app` — его и загружать в AppGallery (не `.hap`). Минификация JS работает и в release (задача `SedonaMinifyLiteJS`), самая большая страница — `session.js`, 40,3 КБ из 48.

Release-пакет не ставится на часы через DevEco Assistant, поэтому на часах проверяется debug-сборка того же коммита.

## 4. Политика конфиденциальности

Текст: [`docs/PRIVACY.md`](PRIVACY.md). Репозиторий публичный, после push ссылка будет:
`https://github.com/AlekFletch/sedona_breath/blob/main/docs/PRIVACY.md`

## 5. Карточка приложения

| Поле | Значение |
|---|---|
| Тип приложения | HarmonyOS app, устройство: Lite wearable (часы) |
| Категория | Здоровье и фитнес (Health & Fitness) |
| Языки | русский (по умолчанию), английский, испанский |
| Цена | бесплатно |
| Платежи, реклама | нет |
| Разрешения | `ohos.permission.VIBRATE` |
| Возрастной рейтинг | анкета: насилия, азартных игр, покупок, общения и сбора данных нет; тема — эмоциональное самочувствие |
| Иконка 216×216 | [`store/icon_216.png`](../store/icon_216.png) |
| Скриншоты | `store/screenshots-square/{ru,en}/` — 840×840 (экран 408×480 ×1,5 в рамке, как у Breath Trainer), по 6 на язык; исходные кадры симулятора — `store/screenshots/` |
| Контакт поддержки | rusgadgets@gmail.com |

### Русский

**Название:** Sedona Breath

**Краткое описание (до 80 символов):**
Дыхание и простые вопросы, чтобы отпустить эмоцию — прямо на часах

**Описание:**
Sedona Breath — короткая практика на часах: спокойное дыхание с вибрацией и несколько простых вопросов, которые помогают заметить эмоцию, позволить ей быть и отпустить её.

Как проходит практика:
• выберите эмоцию и оцените её силу от 1 до 5;
• дышите в ритме вибрации: 4-7-8, 4-6, «квадрат», 4-2-6 или свой ритм;
• ответьте себе на вопросы: «Смог бы я позволить этому чувству быть?», «Смог бы я отпустить это чувство?», «Хотел бы я отпустить это чувство?», «Когда?»;
• после завершающего дыхания оцените эмоцию снова или отметьте «Свободен»; если эмоция ещё здесь, пройдите цикл ещё раз.

Что ещё:
• быстрый режим для снятия стресса;
• история практик с силой эмоции до и после;
• вибрационные подсказки — можно заниматься, не глядя на экран;
• работает без телефона и интернета, данные не покидают часы;
• русский, английский и испанский языки.

Это приложение для самопомощи, а не медицинское изделие. Оно не ставит диагнозы, не лечит и не заменяет врача, психотерапию или экстренную помощь.

**Что нового (1.0.0):** Первая версия.

### English

**Name:** Sedona Breath

**Brief intro:**
Breathing and simple questions to let go of an emotion, right on your watch

**Description:**
Sedona Breath is a short practice on your watch: calm breathing guided by vibration and a few simple questions that help you notice an emotion, allow it to be and let it go.

How it works:
• pick the emotion you feel and rate it from 1 to 5;
• breathe with the vibration: 4-7-8, 4-6, box, 4-2-6 or your own rhythm;
• ask yourself: "Could I allow this feeling to be here?", "Could I let this feeling go?", "Would I let this feeling go?", "When?";
• after the closing breaths, rate the emotion again or tap "I'm free"; if it is still there, repeat the cycle.

Also:
• quick stress relief mode;
• practice history with intensity before and after;
• vibration cues, so you can practise without looking at the screen;
• works without a phone or internet, your data stays on the watch;
• English, Russian and Spanish.

This is a self-help app, not a medical device. It does not diagnose or treat and does not replace a doctor, therapy or emergency care.

**What's new (1.0.0):** First release.

### Español

**Nombre:** Sedona Breath

**Introducción breve:**
Respiración y preguntas sencillas para soltar una emoción, en tu reloj

**Descripción:**
Sedona Breath es una práctica breve en tu reloj: respiración tranquila guiada por vibración y unas preguntas sencillas que te ayudan a notar una emoción, permitir que esté y soltarla.

Cómo funciona:
• elige la emoción que sientes y valora su intensidad del 1 al 5;
• respira al ritmo de la vibración: 4-7-8, 4-6, cuadrada, 4-2-6 o tu propio ritmo;
• pregúntate: «¿Podría permitir que este sentimiento esté?», «¿Podría soltar este sentimiento?», «¿Querría soltar este sentimiento?», «¿Cuándo?»;
• tras la respiración final, valora la emoción otra vez o marca «Libre»; si sigue ahí, repite el ciclo.

Además:
• modo de alivio rápido del estrés;
• historial con la intensidad antes y después;
• señales por vibración para practicar sin mirar la pantalla;
• funciona sin teléfono ni internet, tus datos se quedan en el reloj;
• español, inglés y ruso.

Es una app de autoayuda, no un dispositivo médico. No diagnostica ni trata y no sustituye al médico, la terapia ni la ayuda de emergencia.

**Novedades (1.0.0):** Primera versión.

## 6. Риски проверки

- **Товарный знак.** «Sedona Method» — зарегистрированный товарный знак Sedona Training Associates. В тексте карточки метод не назван, но название «Sedona Breath» и строка `MainAbility_desc` («…метода Седоны») могут вызвать отказ или жалобу правообладателя. Решить до загрузки: оставить, переименовать или убрать упоминание метода.
- **Медицинские утверждения.** В описании нет обещаний лечения; дисклеймер есть в приложении (онбординг, «Условия использования») и в карточке.
- **Совместимость.** В карточке указывать только проверенные часы (Watch Fit 4 / Fit 4 Pro); другие lite-часы с экраном не 408×480 не проверены.
