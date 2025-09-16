# Đông Dev – Web B + Web A + API

## Cấu trúc
- `index.html`: Web B (site)
- `editor.html`: Web A (editor)
- `server.js`: API Node/Express lưu `sections/projects.html`

## Chạy local
```bash
cp .env.example .env          # chỉnh ADMIN_TOKEN, ALLOWED_ORIGIN nếu cần
npm i
npm run dev                   # API http://localhost:$PORT (mặc định 3000)
