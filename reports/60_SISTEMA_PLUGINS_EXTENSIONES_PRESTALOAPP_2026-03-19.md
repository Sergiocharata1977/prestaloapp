# Sistema de plugins/extensiones para PrestaloApp inspirado en 9001app-firebase, Gems y Skills

> Fecha: 2026-03-19
> Basado en el análisis de `9001app-firebase`

## Objetivo

Diseñar para `prestaloapp` un sistema de plugins/extensiones que combine:

- el modelo de `capabilities` ya probado en `9001app-firebase`
- la idea de paquetes de comportamiento tipo `Gems` en Gemini
- la idea de especializaciones reutilizables tipo `Skills` en Claude

La meta no es copiar nombres, sino construir una arquitectura propia para:

- habilitar módulos por organización
- empaquetar reglas, UI, servicios y reportes
- sumar asistentes o automatizaciones especializadas
- permitir instalación, activación, configuración y auditoría

## Lectura del modelo de 9001app-firebase

El proyecto `9001app-firebase` ya tiene una base sólida de extensibilidad.

## Qué ya resuelve bien

- catálogo global de capacidades: `platform_capabilities`
- instalación por organización: `installed_capabilities`
- dependencias entre capacidades
- navegación dinámica desde el manifest
- guard de seguridad por capability
- validación de payloads con Zod
- auditoría de instalación, activación y cambios
- siembra de catálogo desde código
- separación entre:
  - catálogo global
  - runtime por tenant
  - navegación
  - seguridad

## Qué además existe como segunda capa

El proyecto también tiene una capa de herramientas y asistentes:

- `tool registries`
- `agent handlers`
- `MCP plugins`
- módulos SDK con servicios desacoplados

Esa segunda capa se parece más a:

- skills
- gems
- agentes especializados
- extensiones ejecutables

## Conclusión de análisis

`9001app-firebase` ya tiene el esqueleto correcto, pero está más orientado a:

- capabilities de producto
- módulos habilitables
- navegación y permisos

Para `prestaloapp`, si se quiere algo parecido a `gems/skills`, hace falta sumar una capa nueva:

- extensiones funcionales
- extensiones de IA
- extensiones operativas
- extensiones de integración

## Propuesta conceptual para PrestaloApp

## Separar 3 niveles

### Nivel 1. Capability

Responde:

- qué módulo o paquete de producto existe
- quién puede usarlo
- qué pantallas, rutas y datasets habilita

Ejemplos:

- `credito_consumo`
- `descuento_cheques`
- `scoring_avanzado`
- `autorizacion_whatsapp`
- `contabilidad_automatica`
- `riesgo_empresas`

### Nivel 2. Extension

Responde:

- qué lógica adicional se enchufa al sistema
- qué eventos escucha
- qué acciones ejecuta
- qué UI o configuración agrega

Ejemplos:

- extensión para scoring con bureau externo
- extensión para WhatsApp OTP
- extensión para recordatorios de cobranzas
- extensión para legajo documental
- extensión para contabilidad por plugin

### Nivel 3. Skill

Responde:

- cómo se comporta un asistente o automatización ante un dominio específico
- qué herramientas puede usar
- qué prompts, políticas y acciones están disponibles

Ejemplos:

- `skill_riesgo_crediticio`
- `skill_cobranzas`
- `skill_atencion_comercio`
- `skill_auditoria_cartera`

## Modelo recomendado

Para `prestaloapp`, conviene soportar estos 3 niveles juntos:

- `capabilities` para producto
- `extensions` para runtime funcional
- `skills` para IA y automatización especializada

## Características que debe tener el sistema

## 1. Multi-tenant real

Cada organización debe poder:

- instalar una capability
- activar o desactivar una extensión
- configurar parámetros propios
- tener skills distintas según su negocio

## 2. Instalación declarativa

Cada plugin/extensión debe tener un manifest.

## 3. Dependencias explícitas

Ejemplo:

- `autorizacion_whatsapp` depende de `credito_consumo`
- `cobranzas_proactivas` depende de `cobranzas`
- `skill_riesgo_crediticio` depende de `scoring_avanzado`

## 4. Configuración por organización

Cada instalación debe poder guardar:

- API keys
- thresholds
- templates
- flags de features
- submódulos activos

## 5. Seguridad por capability/extension

El sistema debe poder proteger:

- rutas
- endpoints
- acciones
- jobs
- tools de IA

## 6. Navegación dinámica

Los plugins deben poder declarar:

- páginas nuevas
- entradas de menú
- badges
- condiciones por rol

## 7. Hooks por evento

Las extensiones deben reaccionar a eventos del core.

Ejemplos:

- `credito.solicitado`
- `credito.aprobado`
- `credito.otorgado`
- `cuota.vencida`
- `cobro.registrado`
- `cheque.rechazado`
- `cliente.creado`

## 8. Registro de tools y skills

Cada skill debe declarar:

- prompt base
- herramientas permitidas
- datasets consultables
- acciones bloqueadas
- políticas de escalamiento

## 9. Observabilidad y auditoría

Debe quedar trazabilidad de:

- instalación
- activación
- cambio de settings
- error de extensión
- ejecución de hook
- uso de skill

## 10. Versionado

Cada plugin/extension/skill debe tener:

- `id`
- `version`
- `compatibility`
- migraciones si cambia schema

## Arquitectura propuesta

## A. Catálogo global

Colección sugerida:

- `platform_capabilities`
- `platform_extensions`
- `platform_skills`

Estas colecciones viven a nivel plataforma.

## B. Runtime por organización

Subcolecciones sugeridas:

- `organizations/{orgId}/installed_capabilities`
- `organizations/{orgId}/installed_extensions`
- `organizations/{orgId}/installed_skills`
- `organizations/{orgId}/plugin_audit_log`

## C. Registro en código

Además del catálogo en Firestore, conviene tener registro local de implementación:

- resolvers
- handlers
- tools
- settings schemas
- guards

## D. Bus de eventos

El sistema debe publicar eventos internos que consuman extensiones.

## Diseño de entidades

## 1. PlatformCapability

Muy similar al modelo ya visto en `9001app-firebase`.

### Sugerencia

```ts
export interface PlatformCapability {
  id: string;
  name: string;
  description: string;
  version: string;
  system_ids: string[];
  status: 'active' | 'beta' | 'deprecated';
  tier: 'base' | 'opcional' | 'premium';
  icon: string;
  tags: string[];
  dependencies?: string[];
  manifest: {
    capability_id: string;
    navigation: PluginNavigationEntry[];
    permissions?: Record<string, unknown>;
    datasets?: string[];
    settings_schema?: Record<string, unknown>;
  };
}
```

## 2. PlatformExtension

Nueva entidad clave.

### Propósito

Definir lógica enchufable sobre eventos y módulos.

```ts
export interface PlatformExtension {
  id: string;
  name: string;
  description: string;
  version: string;
  status: 'active' | 'beta' | 'deprecated';
  category: 'workflow' | 'integration' | 'automation' | 'reporting' | 'compliance';
  capability_dependencies: string[];
  extension_dependencies?: string[];
  hooks: Array<{
    event: string;
    handler: string;
    mode: 'sync' | 'async';
  }>;
  settings_schema?: Record<string, unknown>;
  permissions?: {
    roles_allowed?: string[];
  };
}
```

## 3. PlatformSkill

Nueva entidad orientada a IA/automatización.

### Propósito

Empaquetar comportamiento especializado.

```ts
export interface PlatformSkill {
  id: string;
  name: string;
  description: string;
  version: string;
  status: 'active' | 'beta' | 'deprecated';
  domain: 'riesgo' | 'cobranzas' | 'comercial' | 'legal' | 'contable';
  capability_dependencies?: string[];
  extension_dependencies?: string[];
  prompt_template_id?: string;
  tools_allowed: string[];
  datasets_allowed: string[];
  escalation_policy?: {
    requires_human_on: string[];
  };
  settings_schema?: Record<string, unknown>;
}
```

## 4. InstalledCapability

Se puede reutilizar casi igual al modelo actual.

## 5. InstalledExtension

```ts
export interface InstalledExtension {
  id: string;
  extension_id: string;
  version_installed: string;
  enabled: boolean;
  status: 'installed' | 'enabled' | 'disabled' | 'uninstalled';
  settings: Record<string, unknown>;
  installed_by: string;
  installed_at: string;
  updated_at: string;
}
```

## 6. InstalledSkill

```ts
export interface InstalledSkill {
  id: string;
  skill_id: string;
  version_installed: string;
  enabled: boolean;
  status: 'installed' | 'enabled' | 'disabled' | 'uninstalled';
  settings: Record<string, unknown>;
  assigned_channels?: Array<'chat' | 'whatsapp' | 'voice' | 'backoffice'>;
  installed_by: string;
  installed_at: string;
  updated_at: string;
}
```

## 7. PluginAuditEntry

Debe cubrir:

- capabilities
- extensions
- skills
- hooks
- errors

## Manifiestos recomendados

## Manifest de capability

Debe declarar:

- navegación
- datasets
- permisos base
- settings
- dependencias

## Manifest de extension

Debe declarar:

- eventos soportados
- handlers
- feature flags
- schema de config
- restricciones

## Manifest de skill

Debe declarar:

- dominio
- prompt base
- tools
- datasets
- guardrails
- política de fallback

## Runtime en código

## 1. Registry de capabilities

Archivo sugerido:

- `src/plugins/capabilities/registry.ts`

### Función

Resolver implementaciones locales de una capability si hacen falta.

## 2. Registry de extensions

Archivo sugerido:

- `src/plugins/extensions/registry.ts`

### Función

Resolver handlers por extensión.

### Ejemplo

```ts
export const EXTENSION_HANDLERS = {
  autorizacion_whatsapp: AutorizacionWhatsAppExtension,
  cobranzas_recordatorios: CobranzasReminderExtension,
};
```

## 3. Registry de skills

Archivo sugerido:

- `src/plugins/skills/registry.ts`

### Función

Resolver:

- prompt
- tools permitidas
- políticas de escalamiento

## 4. Event bus

Archivo sugerido:

- `src/plugins/runtime/EventBus.ts`

### Responsabilidad

Publicar eventos y ejecutar extensiones activas.

### Ejemplo de API

```ts
await EventBus.publish({
  organizationId,
  event: 'credito.otorgado',
  payload: { creditoId, clienteId }
});
```

## 5. Security middleware

Archivo sugerido:

- `src/plugins/runtime/PluginSecurity.ts`

### Responsabilidad

- `requireCapability`
- `requireExtension`
- `requireSkill`

## 6. Navigation resolver

Archivo sugerido:

- `src/plugins/runtime/NavigationResolver.ts`

### Responsabilidad

Mergear navegación base con capabilities instaladas.

## 7. Settings resolver

Archivo sugerido:

- `src/plugins/runtime/SettingsResolver.ts`

### Responsabilidad

Resolver configuración efectiva:

- defaults del catálogo
- settings por organización
- flags runtime

## Cómo se vería en PrestaloApp

## Capabilities candidatas

- `clientes_core`
- `credito_consumo`
- `credito_empresa`
- `cobranzas`
- `descuento_cheques`
- `contabilidad_automatica`
- `reportes_avanzados`
- `portal_comercios`
- `autorizacion_whatsapp`
- `riesgo_avanzado`

## Extensions candidatas

- `extension_autorizacion_whatsapp`
- `extension_recordatorio_mora`
- `extension_scoring_nosis`
- `extension_asientos_extendidos`
- `extension_alertas_cartera`
- `extension_reportes_fondeo`
- `extension_webhooks_comercios`

## Skills candidatas

- `skill_analista_riesgo`
- `skill_gestion_cobranzas`
- `skill_asistente_comercial`
- `skill_operador_crediticio`
- `skill_auditoria_financiera`

## Diferencia con un módulo fijo

Sin este sistema:

- cada feature entra al core
- más acoplamiento
- más flags ad hoc
- más ifs por cliente
- menor capacidad de producto multi-tenant

Con este sistema:

- catálogo claro
- activación por cliente
- dependencias explícitas
- mejores upgrades
- extensiones por vertical
- skills por dominio

## Plan técnico

## Fase técnica 1. Núcleo de catálogo

### Objetivo

Replicar la parte más sólida del modelo de `9001app-firebase`.

### Entregables

- tipos `plugins.ts`
- `CapabilityService`
- `ExtensionService`
- `SkillService`
- colecciones base
- validaciones Zod
- API de catálogo e instalación

## Fase técnica 2. Runtime

### Objetivo

Habilitar uso real dentro del producto.

### Entregables

- `PluginSecurity`
- `NavigationResolver`
- `EventBus`
- `SettingsResolver`
- `registry.ts` por tipo

## Fase técnica 3. Extensiones funcionales reales

### Objetivo

Demostrar valor con casos concretos.

### Entregables

- autorización WhatsApp
- recordatorios de cobranza
- scoring avanzado

## Fase técnica 4. Skills

### Objetivo

Dar una capa estilo `gems/skills`.

### Entregables

- registro de skills
- prompts por skill
- asignación de tools
- activación por canal
- auditoría de ejecución

## Fase técnica 5. Super admin y marketplace interno

### Objetivo

Gestionar catálogo y despliegue desde UI.

### Entregables

- catálogo de capabilities
- catálogo de extensions
- catálogo de skills
- ficha de instalación por organización
- versionado y auditoría

## Plan de olas

## Ola 0. Fundaciones

### Objetivo

Definir modelo y preparar estructura sin tocar lógica de negocio crítica.

### Tareas

- crear tipos base
- definir nombres y convenciones
- diseñar colecciones Firestore
- definir manifiestos
- decidir taxonomía capability/extension/skill

### Resultado

Contrato técnico estable.

## Ola 1. Capabilities

### Objetivo

Implementar catálogo e instalación por organización.

### Tareas

- `platform_capabilities`
- `installed_capabilities`
- `CapabilityService`
- API de listar/instalar/activar/desactivar
- auditoría

### Resultado

PrestaloApp ya puede activar módulos por organización.

## Ola 2. Seguridad y navegación

### Objetivo

Que las capabilities afecten de verdad el runtime.

### Tareas

- guards por capability
- navegación dinámica
- settings por instalación
- validación de dependencias

### Resultado

Los módulos pasan a estar gobernados por capabilities reales.

## Ola 3. Extensions

### Objetivo

Agregar lógica enchufable basada en eventos.

### Tareas

- `platform_extensions`
- `installed_extensions`
- `ExtensionService`
- `EventBus`
- runtime de hooks

### Resultado

El sistema ya soporta automatizaciones e integraciones enchufables.

## Ola 4. Casos reales de negocio

### Objetivo

Probar el modelo con extensiones de alto valor.

### Tareas

- `extension_autorizacion_whatsapp`
- `extension_recordatorio_mora`
- `extension_alertas_cartera`

### Resultado

Validación funcional del modelo en escenarios financieros concretos.

## Ola 5. Skills

### Objetivo

Agregar la capa estilo Gemini Gems / Claude Skills.

### Tareas

- `platform_skills`
- `installed_skills`
- registry de skills
- prompts y tools por skill
- auditoría de ejecución

### Resultado

PrestaloApp ya puede tener asistentes especializados por dominio.

## Ola 6. Super admin / Marketplace interno

### Objetivo

Gestionar todo desde UI.

### Tareas

- dashboard de catálogo
- instalación por tenant
- ficha de dependencias
- control de versiones
- documentación interna por plugin

### Resultado

Sistema administrable y comercializable.

## Ola 7. SDK y developer experience

### Objetivo

Facilitar creación de nuevas extensiones.

### Tareas

- plantillas de manifests
- helpers para hooks
- helpers para settings schema
- testing harness
- guía de desarrollo

### Resultado

Crear extensiones nuevas deja de ser un trabajo artesanal.

## Ola 8. Marketplace de negocio

### Objetivo

Convertir extensiones en una capacidad comercial.

### Tareas

- tiers por plugin
- pricing por capability
- activación comercial
- métricas de uso por plugin

### Resultado

El sistema de extensiones pasa a ser también un motor de packaging y revenue.

## Recomendación pragmática

No intentar construir todo junto.

El mejor orden para `prestaloapp` es:

1. capabilities
2. seguridad + navegación
3. extensions por eventos
4. skills

Eso replica lo más sólido de `9001app-firebase` y recién después suma la capa estilo `gems/skills`.

## Recomendación final

La arquitectura objetivo debería llamarse internamente algo como:

- `Prestalo Plugin Platform`
- o `PPP`

Y tener este principio:

`capability habilita producto, extension enchufa comportamiento, skill especializa inteligencia`

Esa separación evita mezclar:

- permisos
- features
- workflows
- IA

y permite que `prestaloapp` evolucione como plataforma, no solo como app monolítica.

