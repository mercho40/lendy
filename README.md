# GrameenBot - Microfinanzas Digitales via WhatsApp

Grameen Bank digitalizado. Un agente de WhatsApp que gestiona microcréditos con presión social grupal.

## Concepto

Los usuarios hablan con un bot de WhatsApp que:
1. **Onboarding** - Conoce al usuario, recolecta datos básicos conversacionalmente
2. **Formación de grupos** - Grupos de 5 personas co-responsables (modelo Grameen)
3. **Préstamos** - Microcréditos de $5.000-$50.000 ARS en 4 cuotas semanales
4. **Pagos** - Via MercadoPago (link de pago, CBU, alias)
5. **Presión social** - Si un miembro no paga, el grupo es notificado

## Stack

| Componente | Tecnología |
|-----------|------------|
| Runtime | Bun |
| Framework | SvelteKit |
| WhatsApp | [Kapso.ai](https://kapso.ai) |
| AI Agent | Claude API (Anthropic) |
| Database | Postgres (Neon.tech) + Drizzle ORM |
| Pagos | MercadoPago SDK |
| Deploy | Vercel |

## Setup

```bash
# Instalar dependencias
bun install

# Copiar variables de entorno
cp .env.example .env
# Completar las variables en .env

# Push schema a la DB
bun run db:push

# Dev server
bun run dev
```

## Variables de Entorno

Ver `.env.example` para todas las variables necesarias:
- `DATABASE_URL` - Postgres connection string (Neon.tech)
- `KAPSO_API_KEY` - API key de Kapso.ai
- `ANTHROPIC_API_KEY` - API key de Anthropic (Claude)
- `MP_ACCESS_TOKEN` - Access token de MercadoPago
- `BASE_URL` - URL pública (ngrok para dev)

## Estructura

```
src/
├── lib/server/
│   ├── db/          # Schema + Drizzle client
│   ├── ai/          # Claude agent (system prompt, tools, loop)
│   ├── whatsapp.ts  # Kapso client
│   └── mercadopago.ts
├── routes/
│   ├── api/
│   │   ├── whatsapp/        # Webhook WhatsApp
│   │   └── payments/webhook # Webhook MercadoPago
│   └── admin/               # Dashboard admin
│       ├── users/
│       ├── groups/
│       └── loans/
```

## Plan de Implementación

Ver [`docs/plan.md`](docs/plan.md) para el plan completo con fases, schema, y arquitectura del agente.

## Desarrollo

El proyecto está dividido en fases parallelizables:

- **Backend/Agent** (Fases 1-4): WhatsApp webhook → Claude agent → MercadoPago
- **Frontend/Dashboard** (Fase 5): Admin pages con stats y tablas

## Scripts

```bash
bun run dev          # Dev server
bun run build        # Build para producción
bun run db:push      # Push schema a Neon
bun run db:studio    # Drizzle Studio (explorar DB)
bun run db:generate  # Generar migrations
```
