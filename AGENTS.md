# Arquitectura de Agentes

## Vision

4 personas pueden operar una empresa de microcréditos escalable en Argentina. La inteligencia operativa la provee una red de agentes de IA conectados por WhatsApp. Cada agente tiene un rol específico en el ciclo de vida del crédito.

---

## Agentes

### 1. Agente de Onboarding

**Rol:** Primer contacto. Conoce al usuario, recolecta datos, pide referencias.

**Flow:**
1. Usuario escribe al número de WhatsApp
2. El agente hace preguntas de onboarding (nombre, DNI, ocupación, ingresos, situación financiera)
3. Opcionalmente genera un audio de bienvenida (ElevenLabs / TTS gratuito para demo)
4. Pide al usuario que comparta el contacto de WhatsApp + su código de usuario a **3 personas cercanas** que puedan dar fe de su capacidad financiera
5. Registra todo en la DB y genera el perfil del solicitante

**Necesita:**
| Recurso | Detalle |
|---------|---------|
| WhatsApp (Kapso) | Enviar/recibir mensajes |
| Claude API | Conversación guiada |
| DB (Neon) | Guardar perfil de usuario |
| TTS (opcional) | ElevenLabs o Web Speech API para audio de bienvenida |

---

### 2. Agente de Verificación

**Rol:** Contacta a las 3 referencias y recolecta información sobre el solicitante desde su red cercana.

**Flow:**
1. Recibe los 3 contactos del Agente de Onboarding
2. Envía un mensaje a cada referencia por WhatsApp explicando el contexto
3. Hace preguntas sobre el solicitante: "¿Hace cuánto lo conocés?", "¿Sabés si tiene ingresos estables?", "¿Le prestarías plata?", "¿Cómo lo describirías financieramente?"
4. Almacena las respuestas en la DB vinculadas al user ID del solicitante
5. Genera un score de confianza basado en las respuestas de las referencias

**Necesita:**
| Recurso | Detalle |
|---------|---------|
| WhatsApp (Kapso) | Contactar referencias de forma proactiva |
| Claude API | Conversación adaptativa con cada referencia |
| DB (Neon) | Guardar respuestas de referencias vinculadas al solicitante |

---

### 3. Agente de Decisión Crediticia

**Rol:** Analiza toda la información recolectada y define los términos del crédito.

**Flow:**
1. Recibe señal de que el onboarding + verificación están completos
2. Analiza: perfil del solicitante + respuestas de las 3 referencias + score de confianza
3. Aplica reglas crediticias (monto máximo, tasa, plazo, cuotas)
4. Genera una oferta de crédito personalizada
5. Envía la oferta al solicitante por WhatsApp para aceptación

**Reglas base (MVP):**
- Monto: $5.000 - $50.000 ARS
- Plazo: 4 cuotas semanales
- Tasa: 5% flat (MVP simplificado)
- Score alto (3 referencias positivas) → monto máximo
- Score bajo (referencias dudosas) → monto mínimo o rechazo

**Necesita:**
| Recurso | Detalle |
|---------|---------|
| Claude API | Análisis de datos + aplicación de reglas |
| DB (Neon) | Leer perfil + referencias, escribir oferta/préstamo |
| WhatsApp (Kapso) | Enviar oferta al solicitante |
| MercadoPago | Generar link de desembolso (futuro) |

---

### 4. Agente de Cobranza

**Rol:** Gestiona el cobro de cuotas. Se comunica en el momento justo. Puede renegociar.

**Flow:**
1. Monitorea fechas de vencimiento de cuotas
2. Envía recordatorios pre-vencimiento (2 días antes, día del vencimiento)
3. Si no paga: escalamiento gradual de mensajes (recordatorio amigable → firme → oferta de renegociación)
4. Puede ofrecer renegociación: extender plazo, reducir cuota, reestructurar deuda
5. Genera links de pago por MercadoPago y los envía por WhatsApp
6. Confirma pagos recibidos y notifica al usuario

**Tonos de comunicación:**
- Pre-vencimiento: amigable, recordatorio casual
- Día de vencimiento: directo pero cordial
- 1-3 días de mora: firme, claro sobre consecuencias
- +3 días de mora: oferta de renegociación, tono empático

**Necesita:**
| Recurso | Detalle |
|---------|---------|
| WhatsApp (Kapso) | Mensajes proactivos y reactivos |
| Claude API | Tono adaptativo, renegociación inteligente |
| DB (Neon) | Estado de préstamos, historial de pagos |
| MercadoPago | Links de pago, webhooks de confirmación |
| Cron/Scheduler | Trigger de recordatorios por fecha |

---

## Flow Completo

```
Usuario                  Agente 1              Agente 2              Agente 3              Agente 4
  │                     (Onboarding)          (Verificación)        (Decisión)            (Cobranza)
  │                         │                      │                     │                     │
  │── "Hola" ──────────────▶│                      │                     │                     │
  │◀── Preguntas KYC ───────│                      │                     │                     │
  │── Respuestas ──────────▶│                      │                     │                     │
  │◀── "Pasame 3 contactos"─│                      │                     │                     │
  │── Contactos ───────────▶│                      │                     │                     │
  │                         │── Trigger ──────────▶│                     │                     │
  │                         │                      │── Msg a Ref 1 ─▶   │                     │
  │                         │                      │── Msg a Ref 2 ─▶   │                     │
  │                         │                      │── Msg a Ref 3 ─▶   │                     │
  │                         │                      │◀─ Respuestas ──     │                     │
  │                         │                      │── Score + Data ────▶│                     │
  │                         │                      │                     │── Evalúa ──▶        │
  │◀── Oferta de crédito ───┼──────────────────────┼─────────────────────│                     │
  │── "Acepto" ────────────▶│                      │                     │── Crea préstamo ──▶ │
  │◀── Link de pago ────────┼──────────────────────┼─────────────────────┼─────────────────────│
  │                         │                      │                     │                     │── Recordatorio
  │◀── "Tu cuota vence mañana" ───────────────────────────────────────────────────────────────│
  │── Paga ────────────────▶│                      │                     │                     │
  │◀── "Pago confirmado!" ──┼──────────────────────┼─────────────────────┼─────────────────────│
```

---

## MVP para Demo

### Qué construir (mínimo demoable)

| Componente | Esfuerzo | Prioridad | Notas |
|-----------|----------|-----------|-------|
| Agente 1: Onboarding básico | 30 min | **P0** | Preguntas → guardar en DB → pedir contactos |
| Agente 2: Verificación simplificada | 30 min | **P0** | Contactar 1-2 referencias, preguntas simples |
| Agente 3: Decisión con reglas fijas | 15 min | **P0** | If/else sobre score, no ML |
| Agente 4: Recordatorio + link de pago | 20 min | **P0** | Un recordatorio + generar link MP |
| Audio TTS en onboarding | 10 min | P1 | Nice-to-have para wow factor |
| Dashboard admin | 25 min | P1 | Ver estado de todo el pipeline |
| Renegociación de deuda | 15 min | P2 | Agente 4 ofrece nuevos términos |

### Qué NO construir

- Credit scoring con ML real
- Verificación de identidad (RENAPER, etc.)
- Compliance regulatorio
- Multi-idioma
- Desembolso real de dinero
- Recupero judicial

### Demo Script (5 minutos)

1. **"Hola"** → Onboarding completo por WhatsApp (~1 min)
2. **Referencias contactadas** → Agente escribe a un contacto real, recolecta info (~1 min)
3. **Decisión instantánea** → "Te aprobamos $20.000 en 4 cuotas" (~30 seg)
4. **Aceptación + Link de pago** → Recibe link de MercadoPago (~30 seg)
5. **Recordatorio de cobranza** → Simular vencimiento, mostrar mensaje adaptativo (~1 min)
6. **Dashboard** → Vista admin con todo el pipeline visible (~1 min)

---

## Stack por Agente

Todos los agentes comparten:
- **Runtime:** Bun + SvelteKit
- **WhatsApp:** Kapso.ai
- **LLM:** Claude API (Sonnet 4.6 — $3/$15 por M tokens, ~1-2s por response)
- **DB:** Postgres en Neon.tech + Drizzle ORM
- **Pagos:** MercadoPago SDK
- **Approach:** Raw API + tool_use loop (NO Managed Agents)

### Por qué NO Claude Managed Agents

1. **Latencia**: ~2-5s de startup de container. WhatsApp da 10s para responder.
2. **Costo**: $0.08/session-hour × 4 agentes × N usuarios. Inviable para microcréditos.
3. **Overkill**: No necesitamos container/bash/filesystem. Nuestros tools son queries a DB y calls a MP.
4. **Estado duplicado**: Ya tenemos `conversations` en Postgres. Managed Agents maneja su propio estado.
5. **Proactividad**: Agentes 2 y 4 inician conversaciones. Managed Agents es request-response.

### Motor por Agente

| Agente | Motor | Model | Tools | Trigger |
|--------|-------|-------|-------|---------|
| 1. Onboarding | Raw API + tool loop | Sonnet 4.6 | `save_profile`, `request_references` | Reactivo (usuario escribe) |
| 2. Verificación | Raw API + tool loop | Sonnet 4.6 | `contact_reference`, `save_reference_response`, `calculate_trust_score` | Proactivo (trigger del Agente 1) |
| 3. Decisión | Single API call (structured output) | Sonnet 4.6 | Ninguno — prompt con datos → JSON con términos | Automático (verificación completa) |
| 4. Cobranza | Raw API + tool loop | Sonnet 4.6 | `generate_payment_link`, `renegotiate_terms`, `send_reminder` | Proactivo (cron) + Reactivo |

### Implementación técnica

Todos los agentes corren en el mismo codebase. La diferenciación es por **estado de la conversación**:

```
conversation.state === "onboarding"        → System prompt + tools del Agente 1
conversation.state === "verification"      → System prompt + tools del Agente 2
conversation.state === "credit_decision"   → System prompt + tools del Agente 3
conversation.state === "active_loan"       → System prompt + tools del Agente 4
```

No son procesos separados — es un solo webhook que rutea al system prompt y tools correctos según el estado.
