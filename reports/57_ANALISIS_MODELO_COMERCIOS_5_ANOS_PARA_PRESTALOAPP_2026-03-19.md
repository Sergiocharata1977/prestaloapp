# Análisis del Excel "Analisis a 5 años Modelo por comercio" para PrestaloApp

> Fecha: 2026-03-19
> Archivo fuente: `reports/excel/Analisis a 5 años Modelo por comercio.xlsx`

## Objetivo

Identificar qué partes del modelo de negocio del Excel pueden reutilizarse o transformarse en funcionalidades concretas dentro de `prestaloapp`.

## Resumen ejecutivo

El Excel no aporta demasiado a la lógica base de originación de crédito, porque `prestaloapp` ya cubre gran parte de eso: scoring, línea de crédito, originación, cuotas, mora, cobranzas y asientos automáticos.

Su mayor valor está en otra capa del negocio:

- rentabilidad por comercio o canal
- proyección financiera de cartera
- necesidad de fondeo
- simulación de crecimiento
- convenios con comercios
- análisis de mora y recupero esperado

En otras palabras, el archivo sirve más como base para un módulo de `planeamiento financiero y rentabilidad` que como base para rehacer el core crediticio.

## Qué contiene el Excel

Las hojas más relevantes detectadas son:

- `Parametros`
- `Evo. de parametros`
- `FINANCIERO`
- `Dashboard`
- `Prestamos Empresas`
- `Analisis Rentabilidad Socios`

## Variables importantes del modelo

### 1. Parámetros de cliente

El Excel modela ingresos por:

- financiación de saldos
- compras en 3 cuotas
- compras en 6 cuotas
- compras en 12 cuotas
- adelantos en efectivo
- resúmenes
- renovación anual

Esto indica un enfoque tipo tarjeta/cuenta corriente financiada.

### 2. Parámetros de comercio

El archivo incorpora variables que hoy son especialmente valiosas para `prestaloapp`:

- descuento a comercios
- tasa de pago expreso
- días promedio de financiación a comercios
- días de pago expreso
- porcentaje de comercios con pago expreso
- comercio con convenio vs sin convenio

Esta parte es la más aprovechable para una evolución del producto.

### 3. Crecimiento del negocio

El modelo proyecta:

- cantidad de comercios al inicio
- cantidad de comercios asociados por mes
- tarjetas/cuentas por comercio
- parque máximo
- cuentas con consumo
- consumo promedio por cuenta

Esto sirve como base de un simulador comercial y de cartera.

### 4. Riesgo y cobranzas

El Excel usa variables de cartera esperada:

- porcentaje de pago sobre saldos
- mora prevista
- recupero de mora
- saldo luego de mora

Esto no reemplaza la mora operativa del sistema, pero sí sirve para proyección.

### 5. Fondeo y flujo de fondos

El modelo incluye:

- costo de fondeo inversor
- inversión inicial
- gastos fijos mensuales
- flujo de fondos mensual
- equilibrio financiero

Esto es útil para reportes gerenciales y de tesorería.

## Qué ya existe en PrestaloApp

Según la documentación y el código actual, `prestaloapp` ya tiene:

- scoring configurable
- evaluación crediticia
- línea de crédito
- originación de créditos
- amortización francés/alemán
- cuotas
- cobranzas
- mora operativa
- contabilidad automática
- reportes básicos
- gestión de clientes persona y empresa

Por lo tanto, no tiene sentido usar este Excel para rehacer esos componentes.

## Qué sí conviene sacar del Excel para PrestaloApp

## 1. Módulo de convenios con comercios

El Excel diferencia claramente la economía del negocio según la relación con el comercio.

### Valor para producto

Permitir que una financiera gestione comercios adheridos, condiciones especiales y liquidaciones diferenciadas.

### Datos a modelar

- comercio adherido
- tipo de convenio
- arancel o descuento
- días de liquidación
- pago expreso sí/no
- tasa o costo de pago expreso
- estado del convenio

### Resultado

`prestaloapp` pasaría de gestionar solo créditos a gestionar también la red comercial que genera esos créditos.

## 2. Simulador financiero de cartera

Las hojas `Parametros`, `Evo. de parametros` y `FINANCIERO` ya plantean una estructura clara de proyección mensual y anual.

### Valor para producto

Permitir cargar escenarios y responder preguntas como:

- cuánta caja necesito para crecer
- en qué mes llego al equilibrio
- cuánto margen deja cada canal
- cómo impacta subir la mora
- cómo impacta acelerar pagos a comercios

### Variables del escenario

- comercios iniciales
- altas mensuales
- cuentas por comercio
- ticket promedio
- porcentaje de uso
- mix de cuotas
- adelantos
- mora esperada
- recupero esperado
- costo de fondeo
- gastos fijos

### Resultado

Un módulo tipo `escenarios` o `proyección` dentro de reportes o super admin.

## 3. Reporte de rentabilidad por comercio / canal

El Excel separa ingresos y egresos con bastante claridad:

- ingresos financieros
- ingresos por servicios
- pagos a comercios con convenio
- pagos a comercios sin convenio
- adelantos
- mora
- recupero
- gastos fijos

### Valor para producto

Poder detectar:

- qué comercios son rentables
- qué canal consume más caja
- dónde la mora destruye margen
- qué condiciones comerciales conviene renegociar

### Resultado

Reporte de `unit economics` por comercio, sucursal, analista o canal.

## 4. Reporte de fondeo y tesorería

La parte más fuerte del Excel es que no solo mide ingresos, también mide necesidad de capital.

### Valor para producto

Mostrar:

- saldo inicial
- cobranzas proyectadas
- pagos proyectados a comercios
- gasto fijo
- consumo neto de caja
- punto de equilibrio

### Resultado

Un tablero gerencial útil para financieras que trabajan con capital propio o inversores.

## 5. Modelo de mora esperada y recupero esperado

Hoy el sistema ya calcula mora real sobre cuotas vencidas. El Excel agrega otra capa: comportamiento esperado de cartera.

### Valor para producto

Poder proyectar:

- mora esperada por segmento
- recupero esperado por tramo de mora
- cartera sana vs cartera riesgosa
- rentabilidad neta ajustada por pérdida esperada

### Resultado

Mejora de reportes de riesgo, planeamiento y pricing.

## 6. Caso de uso para préstamos a empresas

La hoja `Prestamos Empresas` sugiere una posible extensión del producto hacia financiación B2B o financiación ligada a ventas del comercio.

### Posibles usos

- préstamos a comercios
- financiación de stock
- préstamos para capital de trabajo
- líneas para proveedores

### Resultado

Expansión natural del producto, aprovechando que `prestaloapp` ya maneja clientes empresa.

## Propuesta de evolución funcional

## Fase 1. Reportes y simulación

Agregar sin tocar demasiado el core:

- reporte de rentabilidad
- reporte de fondeo
- pantalla de escenarios financieros
- KPIs de mora esperada vs mora real

## Fase 2. Convenios con comercios

Agregar entidades nuevas:

- `comercios`
- `convenios_comercio`
- `liquidaciones_comercio`

Y luego:

- condiciones comerciales
- liquidación por lote o período
- seguimiento de arancel y pago expreso

## Fase 3. Expansión de negocio

Extender el producto a:

- financiación originada por comercios
- préstamos empresa-comercio
- pricing según canal

## Entidades nuevas sugeridas

### `FinComercio`

- datos fiscales
- sucursal
- estado
- condiciones vigentes

### `FinConvenioComercio`

- comercio_id
- arancel_pct
- pago_expresso_habilitado
- tasa_pago_expresso_pct
- dias_liquidacion
- dias_pago_expresso
- fecha_vigencia_desde
- fecha_vigencia_hasta

### `FinEscenarioFinanciero`

- nombre
- horizonte_meses
- comercios_iniciales
- altas_mensuales
- cuentas_por_comercio
- ticket_promedio
- pct_cuentas_con_consumo
- mix_3_cuotas
- mix_6_cuotas
- mix_12_cuotas
- mix_adelantos
- mora_esperada_pct
- recupero_esperado_pct
- costo_fondeo_pct
- gastos_fijos_mensuales

## Reportes nuevos sugeridos

- rentabilidad por comercio
- margen por canal
- mora esperada vs mora real
- recupero esperado vs recupero real
- necesidad de fondeo por mes
- proyección de caja a 12/24/60 meses
- curva de equilibrio

## Conclusión

El Excel aporta valor principalmente en la capa de negocio y planeamiento, no en la operatoria crediticia básica.

La oportunidad más clara para `prestaloapp` es convertir este modelo en:

- reportes gerenciales de rentabilidad
- simulador financiero de escenarios
- gestión de convenios con comercios
- tablero de fondeo y tesorería

Si se implementa esa línea, el sistema deja de ser solo una herramienta de operación crediticia y pasa a ser también una herramienta de dirección financiera y expansión comercial.

## Recomendación concreta

Prioridad sugerida:

1. Crear módulo de `escenarios financieros`
2. Crear reportes de `rentabilidad` y `fondeo`
3. Incorporar `convenios con comercios`
4. Evaluar expansión formal a `financiación originada por comercios`

