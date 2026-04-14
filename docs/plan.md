# Grameen Bank Digital - Hackathon MVP

## Context
Hackathon MVP (~2-3 horas). Grameen Bank digitalizado: agente WhatsApp que gestiona microcréditos con presión social grupal. El agente conversa, hace onboarding, forma grupos de 5 personas co-responsables, emite préstamos y cobra vía MercadoPago.

## Stack
- **Runtime**: Bun
- **Framework**: SvelteKit
- **WhatsApp**: Kapso.ai (`@kapso/whatsapp-cloud-api`)
- **AI Agent**: Claude API (`@anthropic-ai/sdk`) - Sonnet para velocidad/costo
- **Database**: Postgres en Neon.tech + Drizzle ORM
- **Pagos**: MercadoPago SDK (`mercadopago`)
- **Deploy**: Vercel

## Project Structure
```
hackathon/
├── .env
├── package.json
├── svelte.config.js
├── vite.config.ts
├── drizzle.config.ts
├── drizzle/                          # migrations
├── src/
│   ├── lib/
│   │   ├── server/
│   │   │   ├── db/
│   │   │   │   ├── index.ts          # drizzle client (neon serverless)
│   │   │   │   └── schema.ts         # all tables
│   │   │   ├── whatsapp.ts           # Kapso client
│   │   │   ├── mercadopago.ts        # MP client + payment links
│   │   │   └── ai/
│   │   │       ├── agent.ts          # Claude tool-use loop
│   │   │       ├── system-prompt.ts  # system prompt
│   │   │       └── tools.ts          # tool definitions + handlers
│   │   └── components/
│   │       ├── StatusBadge.svelte
│   │       └── DataTable.svelte
│   ├── routes/
│   │   ├── api/
│   │   │   ├── whatsapp/+server.ts   # GET verify + POST webhook
│   │   │   └── payments/webhook/+server.ts  # MercadoPago IPN
│   │   ├── admin/
│   │   │   ├── +page.svelte          # dashboard overview
│   │   │   ├── +page.server.ts       # load stats
│   │   │   ├── users/+page.svelte
│   │   │   ├── users/+page.server.ts
│   │   │   ├── groups/+page.svelte
│   │   │   ├── groups/+page.server.ts
│   │   │   ├── loans/+page.svelte
│   │   │   └── loans/+page.server.ts
│   │   ├── +layout.svelte
│   │   └── +page.svelte              # redirect to /admin
│   └── app.html
```

## Database Schema

### users
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| phone | text unique not null | formato internacional: 5491155551234 |
| name | text | nullable, se llena en onboarding |
| dni | text | nullable |
| monthly_income | integer | nullable, en ARS |
| occupation | text | nullable |
| onboarding_complete | boolean | default false |
| group_id | integer FK groups | nullable |
| created_at | timestamp | defaultNow |

### groups
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| name | text not null | |
| invite_code | text unique not null | 6 chars, para compartir |
| max_members | integer | default 5 |
| status | enum | forming / active / defaulted |
| created_at | timestamp | defaultNow |

### loans
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| user_id | FK users | not null |
| group_id | FK groups | not null |
| amount | integer | en centavos ARS |
| total_installments | integer | ej: 4 cuotas |
| installments_paid | integer | default 0 |
| installment_amount | integer | centavos ARS |
| status | enum | active / paid / overdue |
| next_due_date | timestamp | nullable |
| created_at | timestamp | defaultNow |

### payments
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| loan_id | FK loans | not null |
| amount | integer | centavos ARS |
| mp_preference_id | text | nullable |
| mp_payment_id | text | nullable |
| status | enum | pending / approved / rejected |
| payment_link | text | nullable |
| created_at | timestamp | defaultNow |

### conversations
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| user_id | FK users | not null |
| messages | jsonb | array de {role, content} para Claude |
| state | enum | onboarding / group_formation / active / payment_pending |
| updated_at | timestamp | defaultNow |

## WhatsApp Webhook Flow
1. `GET /api/whatsapp` → verify token, return challenge
2. `POST /api/whatsapp` → parse mensaje Kapso → buscar/crear user → buscar/crear conversation → append mensaje → `agent.process()` → enviar respuesta via Kapso → guardar conversation → return 200

## Agent Design
Claude con tool_use en loop. System prompt dinámico según estado del usuario.

### Tools del agente
1. **save_user_profile** `{name, dni, monthly_income, occupation}` → guarda perfil, marca onboarding_complete
2. **create_group** `{group_name}` → crea grupo, genera invite_code
3. **join_group** `{invite_code}` → une al usuario, si llega a 5 → status=active
4. **get_group_status** `{}` → estado del grupo, quién debe, quién pagó
5. **create_loan** `{amount}` → crea préstamo con cuotas (5% fee flat)
6. **generate_payment_link** `{loan_id}` → crea preferencia MercadoPago, devuelve link
7. **notify_group** `{message}` → envía WhatsApp a todos los miembros del grupo

## MercadoPago
- Payment links via Preference API
- Webhook IPN en `/api/payments/webhook`
- Al confirmar pago: actualizar payment + loan + notificar por WhatsApp
- Sandbox mode con test credentials

## Admin Dashboard
Server-rendered, queries directas a DB. Minimal.
- **Overview**: cards con totales (users, groups, loans activos, overdue, monto total)
- **Users**: tabla con estado de onboarding
- **Groups**: tabla con miembros, estado, highlight en rojo si hay overdue
- **Loans**: tabla con filtros (active/overdue/paid), botón "enviar recordatorio"

## Fases de Implementación

### Fase 0: Scaffolding (15 min)
1. `bunx sv create hackathon-app` con TypeScript + Tailwind
2. Install deps: `@kapso/whatsapp-cloud-api @anthropic-ai/sdk mercadopago drizzle-orm @neondatabase/serverless`
3. Dev deps: `drizzle-kit`
4. `.env` con todas las keys
5. `drizzle.config.ts` + schema + `bunx drizzle-kit push`

### Fase 1: WhatsApp Echo (20 min)
1. Kapso client singleton
2. API route GET (verify) + POST (echo)
3. Configurar webhook URL en Kapso (ngrok para local)
4. Test: mensaje → echo → funciona

### Fase 2: Claude Agent (30 min)
1. System prompt con estados
2. Tool definitions (7 tools)
3. Agent loop con tool_use
4. Tool handlers (save_user_profile, create_group, join_group)
5. Wire al webhook: reemplazar echo con agent
6. Test: onboarding completo por WhatsApp

### Fase 3: Préstamos + Pagos (30 min)
1. MercadoPago client + payment link generation
2. Tool handlers: create_loan, generate_payment_link
3. IPN webhook handler
4. get_group_status handler
5. Test: pedir préstamo → recibir link → simular pago

### Fase 4: Presión Social (20 min)
1. notify_group handler → mensajes a todo el grupo
2. Lógica de overdue: comparar next_due_date con now
3. Cuando un miembro interactúa, el agente menciona overdue del grupo
4. Pago confirmado → notificación positiva al grupo
5. Test: simular mora → notificación grupal

### Fase 5: Dashboard (25 min)
1. Layout con nav simple
2. Overview con stats
3. Páginas de users, groups, loans
4. Status badges con colores
5. Test manual

### Fase 6: Polish (15 min)
1. Seed data para demo si hace falta
2. Test happy path end-to-end
3. Test social pressure path
4. Preparar script de demo

## Skip para MVP
- Auth en dashboard
- Credit scoring real (se aprueba todo dentro del rango)
- Matching de perfiles (solo crear/unirse por código)
- Cálculo de interés complejo (fee flat 5%)
- Múltiples préstamos por usuario
- Rate limiting, retries, error handling robusto
- Migrations formales (usar `drizzle-kit push`)

## Variables de Entorno
```
DATABASE_URL=postgresql://...@neon.tech/neondb?sslmode=require
KAPSO_API_KEY=kps_...
KAPSO_BASE_URL=https://api.kapso.ai/meta/whatsapp
KAPSO_APP_SECRET=...
KAPSO_PHONE_NUMBER_ID=...
ANTHROPIC_API_KEY=sk-ant-...
MP_ACCESS_TOKEN=APP_USR-...
BASE_URL=https://xxx.ngrok.io
```

## Verificación
1. Enviar "Hola" por WhatsApp → bot responde y empieza onboarding
2. Completar onboarding → datos en DB
3. Crear grupo → recibir invite_code
4. Otro usuario se une con el código
5. Pedir préstamo → recibir link de MercadoPago
6. Pagar → webhook confirma → notificación al grupo
7. Dashboard muestra todo el estado
