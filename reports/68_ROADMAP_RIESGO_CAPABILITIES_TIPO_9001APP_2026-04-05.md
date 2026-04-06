# Roadmap futuro — Riesgo con capabilities estilo 9001app-firebase

**Fecha:** 2026-04-05
**Estado:** diferido
**Decision:** no incorporar por ahora el modelo completo de capabilities/plugins de `9001app-firebase` al modulo de riesgo de `prestaloapp`

---

## Contexto

Se comparo el plan actual de analisis de riesgo de `prestaloapp` con la arquitectura existente en `9001app-firebase`.

Conclusion:

- `prestaloapp` debe seguir por ahora con su enfoque actual de modulo funcional de riesgo
- no se va a migrar en esta etapa a un esquema completo de capability dedicada, manifiestos, dependencias, auditoria de plugin y configuracion avanzada por tenant
- esa evolucion queda registrada como linea futura de roadmap

---

## Decision tomada

Por el momento se mantiene el enfoque definido en:

- [66_PLAN_ANALISIS_RIESGO_CLIENTE_360_2026-04-05.md](c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp\reports\66_PLAN_ANALISIS_RIESGO_CLIENTE_360_2026-04-05.md)

Eso implica:

- API consolidada de riesgo por cliente
- servicio agregador de riesgo
- metricas de comportamiento
- reglas de semaforo, alertas y recomendaciones
- integracion con originacion de credito

Sin sumar todavia:

- capability `riesgo_crediticio` o equivalente
- manifiesto de plugin para riesgo
- settings avanzados multi-tenant estilo `9001app-firebase`
- auditoria formal de lifecycle de capability
- dependencias e instalacion/desinstalacion de modulo de riesgo

---

## Motivo de la decision

Se difiere esta evolucion por razones de foco y complejidad:

- hoy el mayor valor esta en resolver el riesgo operativo y crediticio del negocio
- el sistema actual de `prestaloapp` ya soporta gates simples por `capabilities`
- incorporar el framework completo de `9001app-firebase` ampliaria mucho el alcance tecnico
- primero conviene consolidar el dominio de riesgo y su uso en originacion

---

## Roadmap futuro sugerido

Si mas adelante se decide converger hacia el modelo de `9001app-firebase`, hacerlo como una fase posterior, no mezclada con la implementacion inicial del modulo de riesgo.

Fases sugeridas:

1. Crear capability especifica de riesgo, por ejemplo `riesgo_crediticio`
2. Agregar gating formal en UI y API
3. Mover reglas y umbrales a configuracion por organizacion
4. Incorporar auditoria de decisiones y cambios de configuracion
5. Evolucionar a manifiesto/metadata de capability si el ecosistema de plugins de `prestaloapp` madura

---

## Alcance actual confirmado

Queda asentado que:

- el plan vigente sigue siendo el del reporte 66
- la inspiracion en `9001app-firebase` se toma solo a nivel conceptual
- la adopcion estructural completa del modelo de capabilities/plugins queda para roadmap futuro

---

## Proxima referencia

Cuando se retome esta linea, usar como insumos:

- `reports/66_PLAN_ANALISIS_RIESGO_CLIENTE_360_2026-04-05.md`
- `reports/60_SISTEMA_PLUGINS_EXTENSIONES_PRESTALOAPP_2026-03-19.md`
- el repo hermano `9001app-firebase`
