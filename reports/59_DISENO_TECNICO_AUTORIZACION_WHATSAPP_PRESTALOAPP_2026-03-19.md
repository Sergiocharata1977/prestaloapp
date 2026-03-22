# Diseño técnico para autorización de créditos por WhatsApp en PrestaloApp

> Fecha: 2026-03-19
> Documento derivado de:
> - `58_ANALISIS_VERIFICACION_IDENTIDAD_WHATSAPP_PRESTALOAPP_2026-03-19.md`
> - análisis del repo `9001app-firebase`

## Objetivo

Definir una implementación concreta para incorporar en `prestaloapp` un flujo de autorización de operaciones de crédito por WhatsApp, con foco en:

- identidad básica del cliente por canal
- autorización transaccional
- OTP o token seguro
- trazabilidad completa
- bajo acoplamiento con el core existente

## Decisión de diseño

La solución recomendada para la primera versión es:

`WhatsApp + OTP + autorización transaccional + expiración + snapshot de operación`

No se recomienda para v1:

- depender solo de un `OK`
- biometría de voz
- usar ElevenLabs como validación de identidad

## Resultado esperado

Antes de otorgar un crédito:

1. el operador carga la operación
2. el crédito queda en estado previo de autorización
3. se dispara una solicitud por WhatsApp al cliente
4. el cliente aprueba por OTP o link seguro
5. recién entonces se permite confirmar el crédito

## Impacto en arquitectura actual

PrestaloApp ya tiene:

- `fin_clientes`
- `fin_evaluaciones`
- `fin_linea_credito`
- `fin_creditos`
- `fin_cuotas`
- `fin_cobros`

La nueva capa debe agregarse sin romper el flujo existente de originación.

## Estrategia técnica

Agregar un subdominio nuevo:

- identidad de canal
- autorizaciones transaccionales
- mensajería WhatsApp

## Colecciones Firestore nuevas

## 1. `fin_channel_identity_links`

Propósito:

Vincular un canal externo con un cliente interno validado.

### Documento sugerido

```ts
export interface FinChannelIdentityLink {
  id: string;
  organization_id: string;
  cliente_id: string;
  channel: 'whatsapp';
  external_id: string;
  external_id_normalized: string;
  status: 'pending' | 'active' | 'revoked';
  verified_method: 'otp_whatsapp' | 'manual' | 'link';
  verified_at?: string;
  verified_by?: string;
  created_at: string;
  created_by: string;
  updated_at: string;
}
```

### Índices útiles

- `organization_id + channel + external_id_normalized + status`
- `organization_id + cliente_id + status`

## 2. `fin_autorizaciones_operacion`

Propósito:

Representar la autorización puntual de una operación financiera.

### Documento sugerido

```ts
export type FinAutorizacionCanal = 'whatsapp';
export type FinAutorizacionMetodo = 'otp' | 'link';
export type FinAutorizacionEstado =
  | 'pendiente'
  | 'enviada'
  | 'entregada'
  | 'respondida'
  | 'aprobada'
  | 'rechazada'
  | 'expirada'
  | 'cancelada';

export interface FinAutorizacionOperacionSnapshot {
  cliente_id: string;
  cliente_nombre: string;
  telefono: string;
  credito_id?: string;
  sucursal_id: string;
  comercio_nombre?: string;
  articulo_descripcion: string;
  capital: number;
  cantidad_cuotas: number;
  valor_cuota_estimado: number;
  total_credito: number;
  fecha_primer_vencimiento: string;
}

export interface FinAutorizacionOperacion {
  id: string;
  organization_id: string;
  cliente_id: string;
  credito_id?: string;
  evaluacion_id?: string;
  canal: FinAutorizacionCanal;
  metodo: FinAutorizacionMetodo;
  estado: FinAutorizacionEstado;
  telefono_destino: string;
  telefono_destino_normalized: string;
  token?: string;
  otp_hash?: string;
  otp_last4?: string;
  intentos: number;
  max_intentos: number;
  requested_at: string;
  expires_at: string;
  sent_at?: string;
  delivered_at?: string;
  responded_at?: string;
  approved_at?: string;
  rejected_at?: string;
  expired_at?: string;
  cancelled_at?: string;
  approved_from_phone?: string;
  approved_ip?: string;
  approved_user_agent?: string;
  mensaje_sid?: string;
  mensaje_error?: string;
  evidencia_respuesta?: {
    inbound_text?: string;
    inbound_sid?: string;
    channel_message_id?: string;
  };
  snapshot: FinAutorizacionOperacionSnapshot;
  created_at: string;
  created_by: string;
  updated_at: string;
}
```

### Índices útiles

- `organization_id + cliente_id + estado`
- `organization_id + credito_id + estado`
- `organization_id + telefono_destino_normalized + estado`
- `organization_id + expires_at + estado`

## 3. `fin_whatsapp_conversations`

Propósito:

Persistir conversaciones ligadas a operaciones financieras.

### Documento sugerido

```ts
export interface FinWhatsAppConversation {
  id: string;
  organization_id: string;
  cliente_id?: string;
  telefono: string;
  telefono_normalized: string;
  estado: 'activa' | 'cerrada' | 'archivada';
  tipo: 'autorizacion_credito' | 'cobranzas' | 'general';
  autorizacion_id?: string;
  ultimo_mensaje?: string;
  ultimo_mensaje_at?: string;
  mensajes_no_leidos: number;
  created_at: string;
  updated_at: string;
}
```

## 4. `fin_whatsapp_messages`

Propósito:

Guardar trazabilidad de cada mensaje enviado y recibido.

### Documento sugerido

```ts
export interface FinWhatsAppMessage {
  id: string;
  organization_id: string;
  conversation_id: string;
  autorizacion_id?: string;
  direction: 'OUTBOUND' | 'INBOUND';
  from: string;
  to: string;
  body: string;
  type: 'text' | 'template' | 'media';
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  twilio_sid?: string;
  template_name?: string;
  provider: 'twilio';
  error_code?: string;
  error_message?: string;
  created_at: string;
  status_updated_at?: string;
}
```

## Cambios en tipos existentes

## 1. `src/types/fin-credito.ts`

Agregar estado previo de autorización.

### Cambio sugerido

```ts
export type FinCreditoEstado =
  | 'pendiente_autorizacion'
  | 'activo'
  | 'cancelado'
  | 'en_mora'
  | 'refinanciado'
  | 'incobrable';
```

### Campos nuevos sugeridos

```ts
autorizacion_requerida?: boolean;
autorizacion_id?: string;
autorizado_at?: string;
autorizado_por_canal?: 'whatsapp';
```

## 2. `src/types/fin-cliente.ts`

Agregar datos de canal verificado.

### Campos nuevos sugeridos

```ts
telefono_verificado?: boolean;
telefono_verificado_at?: string;
telefono_verificado_canal?: 'whatsapp';
```

## Servicios nuevos sugeridos

## 1. `ChannelIdentityService`

Archivo sugerido:

- `src/services/ChannelIdentityService.ts`

### Responsabilidades

- normalizar teléfono
- crear vínculo pendiente
- validar vínculo con OTP
- buscar vínculo activo por teléfono
- revocar vínculo

### Métodos

- `normalizePhone(phone: string): string`
- `createPendingLink(...)`
- `verifyLinkByOtp(...)`
- `getActiveLinkByPhone(...)`
- `listClienteLinks(...)`
- `revokeLink(...)`

## 2. `WhatsAppService`

Archivo sugerido:

- `src/services/WhatsAppService.ts`

### Responsabilidades

- enviar mensajes
- enviar template
- crear/buscar conversación
- persistir mensajes
- actualizar estados de entrega
- resolver inbound message

### Nota

La implementación puede adaptarse casi directamente desde `9001app-firebase`, cambiando nombres de colecciones y contexto de negocio.

## 3. `AutorizacionOperacionService`

Archivo sugerido:

- `src/services/AutorizacionOperacionService.ts`

### Responsabilidades

- crear autorización
- generar OTP/token
- armar snapshot de operación
- enviar solicitud por WhatsApp
- aprobar o rechazar
- expirar solicitudes
- validar que una autorización siga vigente

### Métodos sugeridos

- `createForCreditoDraft(...)`
- `sendViaWhatsApp(...)`
- `approveByOtp(...)`
- `approveByLinkToken(...)`
- `reject(...)`
- `expirePending(...)`
- `getActiveByCreditoId(...)`
- `assertCreditoAutorizable(...)`

## 4. `FinTwilioWebhookService`

Archivo sugerido:

- `src/services/FinTwilioWebhookService.ts`

### Responsabilidades

- validar firma Twilio
- parsear payload
- registrar inbound
- asociar respuesta a autorización activa
- disparar aprobación si corresponde

## Cambios en servicios existentes

## 1. `CreditoService`

Archivo impactado:

- `src/services/CreditoService.ts`

### Cambio recomendado

Separar dos momentos:

1. creación preliminar del crédito
2. confirmación final del otorgamiento

### Alternativa pragmática para v1

Mantener la creación actual, pero permitir:

- crear crédito con estado `pendiente_autorizacion`
- no generar asiento ni cuotas hasta aprobación

### Mejor opción

Crear primero un `credito_borrador` o usar la autorización como snapshot, y generar el `fin_credito` real recién cuando se aprueba.

### Recomendación

Para no contaminar el core, conviene:

- no crear `fin_creditos` definitivos antes de la aprobación
- generar la autorización con snapshot
- al aprobar, ejecutar el flujo actual de `CreditoService.create(...)`

Esto reduce inconsistencias contables y evita créditos “semi-creados”.

## Nueva entidad opcional: `fin_solicitudes_credito`

Si quieren una arquitectura más prolija, conviene introducir una colección previa:

- `fin_solicitudes_credito`

### Propósito

Guardar el borrador comercial previo al crédito definitivo.

### Documento sugerido

```ts
export type FinSolicitudCreditoEstado =
  | 'borrador'
  | 'pendiente_autorizacion'
  | 'autorizada'
  | 'rechazada'
  | 'vencida'
  | 'convertida';

export interface FinSolicitudCredito {
  id: string;
  organization_id: string;
  sucursal_id: string;
  cliente_id: string;
  evaluacion_id?: string;
  politica_crediticia_id?: string;
  plan_financiacion_id?: string;
  articulo_descripcion: string;
  articulo_codigo?: string;
  capital: number;
  cantidad_cuotas: number;
  sistema: 'frances' | 'aleman';
  fecha_primer_vencimiento: string;
  valor_cuota_estimado: number;
  total_credito_estimado: number;
  estado: FinSolicitudCreditoEstado;
  autorizacion_id?: string;
  created_at: string;
  created_by: string;
  updated_at: string;
}
```

### Veredicto

Esta opción es mejor que forzar estados transitorios dentro de `fin_creditos`.

## Endpoints API nuevos

## 1. Enrolamiento del teléfono

### `POST /api/fin/clientes/[id]/canales/whatsapp/enroll`

Propósito:

Iniciar validación del teléfono del cliente.

### Acción

- genera OTP
- crea `fin_channel_identity_links` en `pending`
- envía WhatsApp

### Response

```json
{
  "ok": true,
  "linkId": "..."
}
```

## 2. Confirmación del enrolamiento

### `POST /api/fin/clientes/[id]/canales/whatsapp/verify`

Body:

```json
{
  "otp": "482913"
}
```

### Acción

- valida OTP
- activa vínculo de identidad
- marca teléfono verificado en cliente

## 3. Crear solicitud de autorización

### `POST /api/fin/autorizaciones`

Body:

```json
{
  "cliente_id": "...",
  "solicitud_credito_id": "...",
  "metodo": "otp"
}
```

### Acción

- valida que el cliente tenga canal verificado
- crea autorización
- envía WhatsApp

## 4. Aprobar por OTP

### `POST /api/fin/autorizaciones/[id]/approve`

Body:

```json
{
  "otp": "482913"
}
```

### Acción

- valida OTP
- aprueba autorización
- deja operación lista para convertir a crédito

## 5. Rechazar autorización

### `POST /api/fin/autorizaciones/[id]/reject`

Body:

```json
{
  "motivo": "No reconozco la operación"
}
```

## 6. Webhook Twilio

### `POST /api/fin/whatsapp/webhook`

### Acción

- validar firma
- persistir mensaje inbound/status
- resolver autorización activa por teléfono
- si el texto coincide con OTP o patrón válido, aprobar

## 7. Link público seguro

### `GET /api/public/fin/autorizaciones/[token]`

Propósito:

Consultar datos mínimos de la autorización.

### `POST /api/public/fin/autorizaciones/[token]/approve`

Propósito:

Aprobar por link seguro.

## Pantallas nuevas sugeridas

## 1. En cliente

Ruta sugerida:

- `/clientes/[id]/canales`

### Contenido

- teléfono actual
- estado de verificación
- botón `Validar WhatsApp`
- historial de validaciones

## 2. Nueva pantalla de solicitud de crédito

Ruta sugerida:

- `/creditos/solicitudes/nueva`

### Contenido

- carga preliminar del crédito
- preview de cuota
- botón `Enviar autorización por WhatsApp`

## 3. Pantalla de detalle de autorización

Ruta sugerida:

- `/autorizaciones/[id]`

### Contenido

- estado
- expiración
- snapshot de la operación
- mensajes enviados/recibidos
- evidencia de aprobación o rechazo

## 4. Portal/link de aprobación pública

Ruta sugerida:

- `/autorizar/[token]`

### Contenido

- datos básicos del cliente
- comercio
- monto
- cuotas
- cuota estimada
- checkbox o CTA de confirmación
- ingreso de OTP si aplica

## Reglas de negocio recomendadas

## 1. Expiración corta

- OTP: 5 a 10 minutos
- link: 15 a 30 minutos

## 2. Unicidad de autorización activa

No permitir más de una autorización activa por:

- cliente
- solicitud
- crédito borrador

## 3. Snapshot inmutable

La autorización debe guardar:

- monto
- cuotas
- producto
- fecha

Si cambia algo, debe invalidarse y regenerarse.

## 4. Aprobación solo desde teléfono vinculado

El webhook debe aceptar aprobación solo si:

- el número coincide con el canal validado
- la autorización está vigente
- el token/OTP coincide

## 5. Reglas de riesgo

Escalonar controles según monto o segmento:

- monto bajo: WhatsApp + OTP
- monto medio: WhatsApp + link
- monto alto: link + documento/selfie o revisión manual

## Mensajes modelo sugeridos

## Template inicial

```text
PrestaloApp: solicitud de autorizacion de credito.
Comercio: {comercio}
Monto: ${monto}
Cuotas: {cuotas}
Cuota estimada: ${cuota}
Codigo: {otp}
Vence en {minutos} minutos.
Si no reconoce esta operacion, responda NO.
```

## Respuesta aprobada

```text
Operacion aprobada correctamente. Ya puede continuar con la firma/confirmacion.
```

## Respuesta rechazada

```text
Operacion rechazada. Si necesita ayuda, contacte al comercio o a la financiera.
```

## Seguridad mínima requerida

- hash del OTP, no guardar OTP plano
- normalización estricta de teléfono
- rate limit en endpoints de verificación
- rate limit en webhook
- validación de firma Twilio
- expiración automática
- contador de intentos
- auditoría de IP/User-Agent en flujos web

## Variables de entorno nuevas sugeridas

```bash
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=
TWILIO_CONTENT_SID_AUTORIZACION=
FIN_PUBLIC_AUTH_BASE_URL=
FIN_INTERNAL_WEBHOOK_SECRET=
```

## Plan de implementación sugerido

## Fase 1. Base técnica

- tipos nuevos `fin-channel-identity` y `fin-autorizacion-operacion`
- servicio de normalización de teléfono
- servicio WhatsApp básico
- webhook Twilio

## Fase 2. Enrolamiento

- validar teléfono del cliente por OTP
- persistir `fin_channel_identity_links`
- exponer estado en ficha de cliente

## Fase 3. Solicitud de autorización

- nueva colección `fin_solicitudes_credito` o autorización ligada a draft
- creación de autorización
- envío de mensaje
- aprobación por OTP

## Fase 4. Conversión a crédito definitivo

- cuando autorización queda `aprobada`, ejecutar `CreditoService.create`
- generar crédito, cuotas y asiento
- bloquear si autorización está vencida o rechazada

## Fase 5. Portal seguro

- agregar `/autorizar/[token]`
- registrar IP/device/evidencia

## Orden recomendado de archivos a crear

- `src/types/fin-channel-identity.ts`
- `src/types/fin-autorizacion-operacion.ts`
- `src/types/fin-solicitud-credito.ts`
- `src/services/ChannelIdentityService.ts`
- `src/services/WhatsAppService.ts`
- `src/services/AutorizacionOperacionService.ts`
- `src/app/api/fin/whatsapp/webhook/route.ts`
- `src/app/api/fin/autorizaciones/route.ts`
- `src/app/api/fin/autorizaciones/[id]/approve/route.ts`
- `src/app/api/fin/clientes/[id]/canales/whatsapp/enroll/route.ts`
- `src/app/api/fin/clientes/[id]/canales/whatsapp/verify/route.ts`

## Recomendación final de arquitectura

La mejor arquitectura para `prestaloapp` es:

- `fin_solicitudes_credito` como etapa previa
- `fin_autorizaciones_operacion` para el consentimiento
- `fin_creditos` solo para operaciones ya aprobadas

Eso mantiene limpio el core contable y evita créditos incompletos o inconsistentes.

## Conclusión

La implementación es viable y encaja bien con el stack actual.

La decisión técnica más importante es esta:

`no usar fin_creditos como borrador`

Conviene separar:

- solicitud
- autorización
- crédito definitivo

Eso permite incorporar WhatsApp de forma robusta, trazable y sin ensuciar el flujo contable actual.

