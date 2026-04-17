# ArtLink Project Index

Last reindexed: 2026-04-17

## 1) High-Level Architecture

This repository contains two main runtime parts:

- Frontend: Angular 19 application in [src](src)
- Backend API: Express + WebSocket server in [src/app/api](src/app/api)

Primary root config and metadata:

- Frontend package: [package.json](package.json)
- Angular workspace config: [angular.json](angular.json)
- TypeScript configs: [tsconfig.json](tsconfig.json), [tsconfig.app.json](tsconfig.app.json), [tsconfig.spec.json](tsconfig.spec.json)
- Frontend environment files: [src/environments/environment.ts](src/environments/environment.ts), [src/environments/environment.prod.ts](src/environments/environment.prod.ts)

## 2) Frontend Entry Points

- App bootstrap: [src/main.ts](src/main.ts)
- App config/providers: [src/app/app.config.ts](src/app/app.config.ts)
- Root routes: [src/app/app.routes.ts](src/app/app.routes.ts)
- Root component: [src/app/app.component.ts](src/app/app.component.ts)

Global styles/assets:

- Global CSS: [src/styles.css](src/styles.css)
- Static assets root: [public](public)

## 3) Routing Map

### Public routes

Configured in [src/app/app.routes.ts](src/app/app.routes.ts):

- Landing: /
- Legal pages: /terms, /privacy
- Auth area (with auth layout): /auth/login, /auth/register, /auth/verify-email, /auth/reset-password

### Protected user routes

Configured in [src/app/app.routes.ts](src/app/app.routes.ts), under layout + AuthGuard:

- /home
- /explore
- /inbox and /messages/:id
- /saved
- /create
- /post/:id
- /profile/:id
- Marketplace flow: /listings, /listing/:id, /edit-listing/:id, /sales

### Admin routes

- Lazy admin entry: /admin in [src/app/app.routes.ts](src/app/app.routes.ts)
- Admin route tree: [src/app/admin/admin.routes.ts](src/app/admin/admin.routes.ts)

Admin sections include:

- Dashboard, Users, Posts, Post Review
- Listings, Messages, Reports, Report Management
- Archive, Settings

## 4) Frontend Feature Areas

Feature pages live in [src/app/components/pages](src/app/components/pages):

- Core social UX: home, explore, post, profile, saved, inbox
- Creation/editing: createpost, imageedit
- Marketplace: listings, listing-details, listing-edit, purchases, sales, sales-analytics
- Utility/public pages: landing, terms, privacy, analytics, chat

Reusable UI components in [src/app/components/ui](src/app/components/ui):

- post-card
- media-preview
- admin-badge

Layout components in [src/app/components/layout](src/app/components/layout)

## 5) Frontend Services and Cross-Cutting Logic

Core services in [src/app/services](src/app/services):

- Data/API orchestration: data.service.ts
- Messaging and state: messaging.service.ts, message-state.service.ts
- Notifications and state: notification-state.service.ts
- WebSocket and online status: websocket.service.ts, online-status.service.ts
- Analytics: analytics.service.ts
- UX utility: toast.service.ts, navigation-cancel.service.ts

Auth-specific service/guard/interceptor:

- [src/app/services/_auth/auth.guard.ts](src/app/services/_auth/auth.guard.ts)
- [src/app/services/_auth/auth.interceptor.ts](src/app/services/_auth/auth.interceptor.ts)

## 6) Backend API Index

Backend root: [src/app/api](src/app/api)

Entry/server composition:

- API package: [src/app/api/package.json](src/app/api/package.json)
- Express + WebSocket server: [src/app/api/server.js](src/app/api/server.js)

Mounted REST route modules in [src/app/api/routes](src/app/api/routes):

- auth.js
- users.js
- posts.js
- listings.js
- messages.js
- notifications.js
- analytics.js
- admin.js

Server-level API mounts (from server.js):

- /api/auth
- /api/users
- /api/posts
- /api/listings
- /api/messages
- /api/notifications
- /api/analytics
- /api/admin
- Health endpoint: /api/health
- Email health endpoint: /api/email/health

Other backend areas:

- DB and config: [src/app/api/config](src/app/api/config), [src/app/api/database](src/app/api/database)
- Middleware: [src/app/api/middleware](src/app/api/middleware)
- Services: [src/app/api/services](src/app/api/services)
- Upload storage: [src/app/api/uploads](src/app/api/uploads)

## 7) Admin Frontend Index

Admin feature root: [src/app/admin](src/app/admin)

- Admin shell/layout: [src/app/admin/admin-layout](src/app/admin/admin-layout)
- Guard: [src/app/admin/guards/admin.guard.ts](src/app/admin/guards/admin.guard.ts)
- Admin services: [src/app/admin/services](src/app/admin/services)
- Admin pages: [src/app/admin/pages](src/app/admin/pages)

## 8) Data and SQL Artifacts

DB and data utility files in repository root:

- [supabase-schema.sql](supabase-schema.sql)
- [add-media-caption.sql](add-media-caption.sql)
- [test-transactions.sql](test-transactions.sql)
- CSV exports: [csv-export](csv-export)

## 9) Operational Runbook (Quick)

Frontend (root):

1. npm install
2. npm start

Backend API (separate terminal):

1. cd src/app/api
2. npm install
3. npm run dev

Notes:

- Angular dev server default: http://localhost:4200
- API default from server.js: http://localhost:3000

## 10) Existing Documentation

Implementation and operations docs already present:

- [ADMIN_PANEL_README.md](ADMIN_PANEL_README.md)
- [RECENT_CHANGES.md](RECENT_CHANGES.md)
- [IMAGE_CAPTIONS_FEATURE.md](IMAGE_CAPTIONS_FEATURE.md)
- [FORGOT_PASSWORD_IMPLEMENTATION.md](FORGOT_PASSWORD_IMPLEMENTATION.md)
- [UNVERIFIED_EMAIL_FIX.md](UNVERIFIED_EMAIL_FIX.md)
- [VERCEL_ENV_SETUP.md](VERCEL_ENV_SETUP.md)
- API docs: [src/app/api/README.md](src/app/api/README.md), [src/app/api/RENDER_DEPLOY.md](src/app/api/RENDER_DEPLOY.md)

---

If you want, the next reindex pass can include a generated endpoint matrix (method + path + handler file) and a dependency graph for frontend services/components.
