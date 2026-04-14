# Lendy — Microfinanzas Digitales via WhatsApp

Financiera de microcréditos operada por IA. Los usuarios hablan con un bot de WhatsApp que hace onboarding, verifica identidad por voz y con 3 referencias cercanas, decide y emite el crédito, y cobra cuotas semanales por MercadoPago.

## Pipeline

1. **Onboarding** — datos básicos vía chat (nombre, DNI, ingreso, ocupación) + verificación por voz (ElevenLabs).
2. **Verificación social** — el aplicante comparte 3 códigos `REF-XXXX` con contactos; al escribir al bot con ese código, un agente les hace 4 preguntas cortas y computa un score por referencia.
3. **Decisión crediticia** — evalúa perfil + `trust_score` promedio y ofrece monto + plazo + TNA.
4. **Préstamo activo** — cuotas semanales, links de pago MercadoPago, recordatorios por cron, renegociación a demanda.
5. **Manager** — meta-agente que cada 30 min revisa el pipeline y destraba situaciones (nudges a trabados, recordatorios de mora). Tiene además una consola de chat en `/admin/manager` para el operador.

## Stack

| Componente | Tecnología |
|-----------|------------|
| Runtime | Bun |
| Framework | SvelteKit + Tailwind + shadcn-svelte |
| WhatsApp | [Kapso.ai](https://kapso.ai) |
| Voz | ElevenLabs Agents |
| LLM | Claude Sonnet 4.6 (Anthropic) |
| DB | Postgres en Neon.tech + Drizzle ORM |
| Pagos | MercadoPago SDK (mockeado en dev vía `/mock-pay/[id]`) |
| Cron + deploy | Vercel |

## Setup

```bash
bun install
cp .env.example .env
# completar variables
bun run db:push
bun run dev
```

## Env vars

Ver `.env.example`. Críticas:
- `DATABASE_URL` (Neon)
- `ANTHROPIC_API_KEY`
- `KAPSO_API_KEY`, `KAPSO_API_BASE_URL`, `KAPSO_PHONE_NUMBER_ID`, `KAPSO_VERIFY_TOKEN`
- `BASE_URL` (ngrok en dev, URL de Vercel en prod)
- `CRON_SECRET` (para auth de los cron endpoints)

## Estructura

```
src/
├── lib/server/
│   ├── db/                # schema + drizzle
│   ├── ai/
│   │   ├── agent.ts                  # loop user-facing
│   │   ├── manager.ts                # autopilot + chat del manager
│   │   ├── pipeline.ts               # orquestador (verificación, decisión, recordatorios)
│   │   ├── system-prompt.ts          # prompts por estado de conversación
│   │   ├── tools.ts
│   │   └── handlers/{onboarding,verification,credit-decision,active-loan}.ts
│   ├── whatsapp.ts        # cliente Kapso
│   └── mercadopago.ts     # mock MP
└── routes/
    ├── api/
    │   ├── whatsapp/             # webhook principal
    │   ├── payments/webhook/     # IPN MercadoPago (mock-compat)
    │   ├── elevenlabs/webhook/   # resultado de la verificación por voz
    │   └── cron/
    │       ├── reminders/        # cron de cobranza (daily)
    │       └── manager/          # cron del manager (cada 30 min)
    ├── mock-pay/[paymentId]/     # checkout falso de MP para demo
    ├── voice/                    # widget ElevenLabs
    └── admin/                    # dashboard
        ├── users/[id]
        ├── references/[id]
        ├── loans/[id]
        └── manager/              # chat con el manager + audit de runs/acciones
```

## Scripts

```bash
bun run dev          # Vite dev
bun run build        # build para Vercel
bun run db:push      # sync schema → Neon
bun run db:studio    # explorar DB
bun run test         # vitest
```
