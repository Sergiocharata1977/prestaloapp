# Migracion Acciones de Cobranza V2

> Fecha: 2026-04-05
> Alcance: `fin_mora_acciones`, agenda operativa y filtros Firestore asociados
> Estado: listo para despliegue despues de completar Ola 2

---

## Objetivo

Evolucionar el modelo de `organizations/{orgId}/fin_mora_acciones` sin romper el circuito vigente de control de mora, incorporando agenda operativa, responsable, prioridad y trazabilidad por etapa.

La migracion es compatible hacia atras: los documentos legacy siguen siendo validos, pero se recomienda backfill para homogeneizar filtros, bandejas y ordenamientos.

---

## Campos nuevos o ampliados

El modelo V2 agrega o formaliza estos campos sobre `fin_mora_acciones`:

- `etapa`: `mora_temprana | pre_judicial | judicial`
- `categoria`: clasificacion funcional de la accion
- `estado`: `pendiente | programada | en_curso | ejecutada | cancelada | vencida`
- `prioridad`: `baja | media | alta | urgente`
- `resultado_codigo`
- `resultado_texto`
- `entidad_tipo`
- `entidad_id`
- `credito_id`
- `cuota_id`
- `cheque_id`
- `saldo_exigible_snapshot`
- `dias_mora_snapshot`
- `compromiso_pago_fecha`
- `compromiso_pago_monto`
- `compromiso_pago_cumplido`
- `proxima_accion_tipo`
- `proxima_accion_at`
- `fecha_vencimiento_accion`
- `responsable_user_id`
- `responsable_nombre`
- `sector_responsable`
- `estudio_juridico_nombre`
- `expediente_numero`
- `documento_tipo`
- `documento_url`
- `executed_at`
- `updated_at`

Compatibilidad:

- `clase` se conserva como alias temporal de `etapa`
- `resultado` puede seguir existiendo, pero V2 prioriza `resultado_codigo` + `resultado_texto`
- `created_at` y `created_by` permanecen como base de auditoria

---

## Defaults recomendados para datos existentes

Estos defaults reflejan el comportamiento actual del dominio (`MoraAgendaService.normalizeAccion`) y son los que deben usarse en el backfill:

| Campo | Default / regla de migracion |
|------|-------------------------------|
| `etapa` | usar `clase` si existe; si no, `mora_temprana` |
| `clase` | copiar desde `etapa` cuando falte |
| `categoria` | inferir por `tipo` |
| `estado` | `ejecutada` si hay `executed_at`; si no, `vencida` cuando `proxima_accion_at` o `fecha_vencimiento_accion` sea menor a hoy; si no, `programada` cuando haya fecha futura; si no, `pendiente` |
| `prioridad` | `alta` si `etapa=judicial`; `media` para `pre_judicial` y `mora_temprana`; conservar valor si ya existe |
| `resultado_texto` | copiar `resultado` cuando falte |
| `fecha_vencimiento_accion` | copiar `proxima_accion_at` cuando falte |
| `responsable_user_id` | copiar `created_by.user_id` cuando falte |
| `responsable_nombre` | copiar `created_by.nombre` cuando falte |
| `updated_at` | copiar `created_at` cuando falte |
| `compromiso_pago_cumplido` | dejar ausente salvo que exista evidencia operativa para marcarlo |

Mapa recomendado de `tipo -> categoria`:

- `llamado`, `whatsapp`, `email`, `sms` -> `contacto`
- `visita` -> `seguimiento`
- `acuerdo` -> `negociacion`
- `carta_documento` -> `intimacion`
- `derivacion_estudio` -> `derivacion`
- `demanda`, `audiencia`, `presentacion_judicial` -> `judicial`
- `gestion_documental` -> `documental`
- `tarea`, `recordatorio` -> `agenda`
- `nota_interna` -> `interna`
- `actualizacion_estado` -> `administrativa`

---

## Indices Firestore requeridos

Agregar en `firestore.indexes.json` los indices compuestos para `fin_mora_acciones`:

- `cliente_id + created_at`
- `etapa + estado + proxima_accion_at`
- `responsable_user_id + estado + proxima_accion_at`
- `etapa + prioridad + proxima_accion_at`

Objetivo operativo:

- historial por cliente ordenado descendente
- bandeja de agenda por etapa y estado
- agenda por responsable
- priorizacion de acciones por etapa

---

## Pasos de despliegue

1. Confirmar que Ola 2 este integrada en `main` y que el modelo V2 ya sea el consumido por backend/UI.
2. Desplegar indices:

```bash
firebase deploy --only firestore:indexes
```

3. Esperar a que Firestore termine de construir los indices antes de habilitar filtros nuevos en operacion.
4. Ejecutar backfill sobre `organizations/*/fin_mora_acciones` para completar campos V2 faltantes con los defaults de este documento.
5. Validar muestra de documentos migrados:
   - acciones con `clase` legacy
   - acciones con `proxima_accion_at`
   - acciones judiciales
   - acciones sin responsable explicito
6. Verificar desde API o consola que las consultas por cliente, agenda y responsable devuelvan resultados consistentes.
7. Publicar el cambio operativo al equipo de cobranzas, aclarando nueva etapa `mora_temprana`, estados formales y agenda.

---

## Backfill operativo sugerido

Aplicar solo sobre documentos que no tengan campos V2 completos. Orden recomendado:

1. Completar `etapa` y `clase`
2. Completar `estado`, `prioridad`, `categoria`
3. Completar `fecha_vencimiento_accion`, `responsable_user_id`, `responsable_nombre`, `updated_at`
4. Revisar manualmente acciones con `resultado` legacy para derivar `resultado_codigo` cuando sea posible

Regla importante:

- no eliminar `resultado` ni `clase` en esta migracion
- no reescribir `created_at` ni `created_by`
- no marcar `compromiso_pago_cumplido=true` sin evidencia

---

## Riesgos

- indices en construccion: las consultas nuevas pueden fallar o degradarse hasta que Firestore termine el build
- datos legacy heterogeneos: acciones sin fecha, sin responsable o con `tipo` poco consistente pueden quedar con defaults demasiado genericos
- sobreescritura de auditoria: un backfill mal implementado puede modificar `created_at`, `created_by` o resultados historicos
- cambio operativo: el equipo puede interpretar `mora_temprana` como un estado equivalente a `pre_judicial` si no se comunica bien

---

## Rollback

Rollback recomendado en dos capas:

1. Operativo
   - volver a usar la bandeja previa sin filtros/agendas V2
   - pausar el uso de estados y responsable como criterio de trabajo

2. Tecnico
   - mantener `clase` y `resultado` legacy como fuente de compatibilidad
   - si el backfill genero datos incorrectos, restaurar desde export Firestore o aplicar script inverso solo sobre campos V2 agregados
   - los indices nuevos pueden quedar desplegados; no es necesario retirarlos para restaurar compatibilidad funcional

No hacer rollback destructivo borrando documentos de `fin_mora_acciones`.

---

## Checklist de validacion post-migracion

- [ ] existen los 4 indices nuevos en Firestore
- [ ] las acciones legacy pueden listarse por `cliente_id`
- [ ] la agenda devuelve acciones `pendiente`, `programada` o `vencida`
- [ ] las acciones ejecutadas no aparecen en agenda
- [ ] `responsable_user_id` y `responsable_nombre` quedan completos en la mayoria de los casos
- [ ] `mora_temprana` aparece como etapa valida sin romper `pre_judicial` y `judicial`
- [ ] timeline por cliente ordena por `executed_at` o `created_at` descendente
