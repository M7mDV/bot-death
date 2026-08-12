# Albion Death Bot

بوت ديسكورد بيتابع أعضاء جيلد في Albion Online، ولما أي عضو يموت في معركة يبعت رسالة (embed) في تشانل مخصص فيها تفاصيل الموت (القاتل، الضحية، المعدات، الفيم، إلخ).

## المتغيرات المطلوبة (Environment Variables)

انسخ `.env.example` إلى `.env` وحط القيم الحقيقية (أو اضبطها من لوحة الاستضافة مباشرة):

- `DISCORD_TOKEN` — توكن بوت الديسكورد.
- `ALBION_GUILD_ID` — الـ ID بتاع الجيلد في Albion Online.
- `DISCORD_CHANNEL_ID` — الـ ID بتاع تشانل الديسكورد اللي هيتبعتله رسائل الموت.

⚠️ **متحطش توكن حقيقي في أي ملف بترفعه على GitHub.** استخدم `.env` محلي (متجاهل من `.gitignore`) أو Environment Variables في لوحة الاستضافة.

## التشغيل محليًا

```bash
npm install
npm start
```

## النشر على ACLClouds (أو أي استضافة Pterodactyl)

1. ارفع ملفات المشروع (`index.js`, `package.json`, `.npmrc`) — أو اربط الريبو مباشرة لو الاستضافة بتدعم Git Deploy.
2. اضبط `DISCORD_TOKEN`, `ALBION_GUILD_ID`, `DISCORD_CHANNEL_ID` من قسم Environment Variables بلوحة الاستضافة.
3. اختار Node.js 18 أو أحدث.
4. Startup Command: `npm start` أو `node index.js`.
