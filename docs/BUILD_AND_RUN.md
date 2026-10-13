# Сборка, подпись, запуск на часах

## 1. Тип проекта

- DevEco Studio 6.x (проверено на 6.1.1, hvigor 6.24.4, SDK HarmonyOS 6.1.1 / API 24).
- Шаблон соответствует **Application → Empty Ability**, Stage Model, Device type **Wearable**, Compatible SDK `5.0.0(12)`.
- Откройте корень репозитория через *File → Open*. Если DevEco попросит, выполните *Sync*: он скачает `@ohos/hypium` и `@ohos/hamock` из ohpm.

## 2. Ключевые файлы конфигурации

| Файл | Что важно |
|---|---|
| `AppScope/app.json5` | `bundleName: com.alekfletch.sedonabreath`. Его нужно поменять на свой bundle name из AppGallery Connect, если он отличается |
| `build-profile.json5` | `targetSdkVersion 6.1.1(24)`, `compatibleSdkVersion 5.0.0(12)`, `runtimeOS HarmonyOS`, пустые `signingConfigs` |
| `entry/src/main/module.json5` | `deviceTypes: ["wearable"]`, `EntryAbility` (`launchType: singleton`), `QuickStartFormAbility` (карточка), разрешение `ohos.permission.VIBRATE` |
| `entry/build-profile.json5` | обфускация в release: `-enable-toplevel-obfuscation`, `-enable-filename-obfuscation`, `-remove-log`; property-обфускация выключена, потому что записи сериализуются по именам полей |

### Разрешения

| Разрешение | Тип | Зачем |
|---|---|---|
| `ohos.permission.VIBRATE` | system_grant (выдаётся при установке, без диалога) | Вибрационные подсказки |

Других разрешений нет: нет `INTERNET`, нет фоновой работы, нет датчиков. Health Kit использует собственную авторизацию через `healthStore.requestAuthorizations`, а не `requestPermissions` (см. [HEALTH_KIT.md](HEALTH_KIT.md)).

## 3. Сборка из командной строки

```bash
node "C:/Program Files/Huawei/DevEco Studio/tools/hvigor/bin/hvigorw.js" --mode module -p module=entry@default -p product=default -p buildMode=debug assembleHap --no-daemon
```

Результат: `entry/build/default/outputs/default/entry-default-unsigned.hap` (или `-signed.hap`, если подпись настроена).

Если hvigor не находит SDK, задайте `DEVECO_SDK_HOME=C:\Program Files\Huawei\DevEco Studio\sdk`, а в PATH добавьте `...\DevEco Studio\tools\node`.

## 4. Подпись (debug)

1. Войдите в DevEco Studio под своим HUAWEI ID.
2. Подключите часы (раздел 5).
3. *File → Project Structure → Signing Configs* → включите **Automatically generate signature** и нажмите OK.
4. DevEco создаст ключ, сертификат и профиль, допишет `signingConfigs` в `build-profile.json5` и зарегистрирует UDID часов в профиле отладки.

Файлы ключей (`*.p12`, `*.cer`, `*.p7b`, `*.csr`) исключены в `.gitignore`. Не коммитьте их.

## 5. Запуск на реальных часах (Wi-Fi / HDC)

На часах (пункты меню зависят от прошивки, проверьте на своей модели):

1. *Настройки → О часах* → несколько раз нажмите на номер версии, пока не появятся *Параметры разработчика*.
2. В *Параметрах разработчика* включите **Отладку HDC** и **Отладку по Wi-Fi**. Часы и компьютер должны быть в одной сети Wi-Fi.
3. Часы покажут IP-адрес и порт.

На компьютере (`hdc` лежит в `DevEco Studio/sdk/default/openharmony/toolchains/`):

```bash
hdc tconn 192.168.1.50:5555
```

```bash
hdc list targets
```

После подключения часы появятся в списке устройств DevEco, и *Run ▶* соберёт, подпишет и установит приложение. Вручную:

```bash
hdc install -r entry/build/default/outputs/default/entry-default-signed.hap
```

```bash
hdc shell aa start -a EntryAbility -b com.alekfletch.sedonabreath
```

### Отладка

- Логи: `hdc hilog` с фильтром по тегам `Haptics`, `Settings`, `Session`, `HealthKit`, `EntryAbility`. В DevEco: окно *Log* → фильтр по bundle name.
- Брейкпоинты: *Debug ▶* в DevEco работает и по Wi-Fi-подключению.
- Быстрый старт с карточки без карточки:
  ```bash
  hdc shell aa start -a EntryAbility -b com.alekfletch.sedonabreath --pi quickStart 3
  ```
- Сброс данных приложения:
  ```bash
  hdc shell bm clean -n com.alekfletch.sedonabreath -d
  ```

## 6. Тесты

| Что | Как |
|---|---|
| Unit-тесты ядра (36) | DevEco: правый клик по `entry/src/test` → *Run 'Local Test'*; CLI: `hvigorw … test` (см. README); Node: `node tools/node-test/run.mjs` |
| Инструментальные (хранение, локализация) | DevEco: правый клик по `entry/src/ohosTest` → *Run* на подключённых часах или эмуляторе wearable |
| Локализация (статически) | `node tools/check-i18n.mjs` |

Сборка тестового HAP из CLI:

```bash
node "C:/Program Files/Huawei/DevEco Studio/tools/hvigor/bin/hvigorw.js" --mode module -p module=entry@ohosTest -p product=default assembleHap --no-daemon
```

## 7. Release-сборка

1. В AppGallery Connect создайте приложение (платформа HarmonyOS, устройство «Часы») с вашим `bundleName`.
2. Получите **release-сертификат** (`.cer`) по своему CSR и **release-профиль** (`.p7b`).
3. В *Project Structure → Signing Configs* снимите галочку *Automatically generate signature* и укажите `.p12`, alias, пароли, `.cer`, `.p7b`. DevEco сохранит пароли в `build-profile.json5` в зашифрованном виде.
4. Соберите пакет для публикации:
   ```bash
   node "C:/Program Files/Huawei/DevEco Studio/tools/hvigor/bin/hvigorw.js" --mode project -p product=default -p buildMode=release assembleApp --no-daemon
   ```
   Результат: `build/outputs/default/*.app`. Загрузите его в AppGallery Connect.
5. Перед публикацией увеличьте `versionCode` и `versionName` в `AppScope/app.json5`.
