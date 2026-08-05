# Handoff: LED'S ON — Flujo de reserva (booking)

## Overview
Flujo de reserva de 5 pantallas para la pantalla LED de la Comuna 13 (Medellín): Inicio → Elegir filtro → Datos del usuario → Subir foto/video + pago → Confirmación. Diseño destinado principalmente a una pantalla física de **576×1152px** (kiosco vertical), pero responsive.

## About the Design Files
El archivo `LedsOn Booking.dc.html` es una **referencia de diseño en HTML** (prototipo interactivo), no código de producción. La tarea es **recrear este diseño en el stack real del proyecto** (React/Vue/etc. — el mismo stack donde vive `graffiti.css`, aparentemente un frontend con Mantine, a juzgar por las clases `.mantine-*` en ese CSS) usando sus componentes y patrones existentes.

`graffiti.css` se incluye sin cambios — es el archivo real del proyecto (fondo animado compartido usado en `Home.tsx` y `BookingForm.tsx`). El nuevo diseño reutiliza exactamente esas animaciones/clases (`.graffiti-wall`, `.spray-cloud--*`, `.drip--*`, `.paint-particles`/`.particle`) como fondo — no las reinventes, aplica las clases existentes tal cual.

## Fidelity
**High-fidelity.** Colores, tipografía, espaciados e interacciones están definidos; recréalos con precisión.

## Screens / Views

### 1. Inicio
- Header fijo 64px, bg `#e9edf0`: logo "led's on" (peso 800 + 400) a la izquierda, switch de idioma ES/EN a la derecha.
- Debajo, sobre el fondo `graffiti-wall`: título "Reserva tu espacio" (26px/800/`#14151a`) + subtítulo "en la pantalla más grande de la Comuna 13, Medellín" (14px/`#6b7280`), centrados.
- Stepper: 5 barras (5px alto, radio 3px, gap 6px) — completada `#2fae4a`, activa color de acento (`#1c5cab`), pendiente `#e1e4e6`. Label debajo en mayúsculas 11px `#9aa0a6`.
- Card blanca (radio 16px, borde `#e3e6e8`, sombra sutil):
  - Imagen hero 200px alto (foto de la Comuna 13).
  - Título "Bienvenido(a) a la Experiencia LED'S ON" (21px/800/acento, centrado).
  - 2 párrafos de copy (14px/`#3a3d42`).
  - Botón "Comenzar →" full width, bg acento, texto blanco 15px/700, radio 10px.
- Footer "2026 © LED'S ON" (12px/`#9aa0a6`).

### 2. Elige tu filtro (Paso 1 de 3)
- Título "1. Elige tu filtro artístico" (18px/800) + subtítulo "Este será el estilo que se aplicará a tu fotografía." (13.5px/`#6b7280`).
- Grid 2×2 de opciones (gap 12px): thumbnail con gradiente 90px alto (radio 8px), nombre (14px/700) y "Descripción corta del filtro" (12px/`#9aa0a6`). Seleccionada: borde 2px color acento + check verde `#2fae4a` en esquina superior derecha.
  - Gradientes: Apolo (cian→índigo), Fatte One (verde-teal), Colombia Mágica (rojo→morado), Ciudad de las Flores (naranja→amarillo).
- Botón "Continuar →" deshabilitado (gris `#a9c3de`) hasta elegir filtro.

### 3. Cuéntanos de ti (Paso 2 de 3)
- Título + subtítulo iguales al patrón anterior.
- Campos (label 13px/600 arriba, asterisco rojo `#e5484d` si obligatorio; inputs 11px padding, borde 1.5px `#d8dcdf`, radio 9px):
  - Nombre completo* (texto)
  - Documento de identidad* (select Tipo 90px + input número, en fila)
  - Correo electrónico* (email)
  - Nacionalidad* (select País + select Ciudad, en fila)
  - Número de celular* (tel)
  - Método de pago* (select) + Vendedor (select, opcional), en fila
  - Factura electrónica personalizada* — dos checkboxes SI/NO
  - Checkbox de aceptación con enlaces "Política de Tratamiento de Datos Personales" y "Términos y Condiciones" (azules).
- Footer: botón atrás (outline, ← , 48×48px) + "Continuar →" (deshabilitado hasta llenar nombre+email+celular+aceptar términos).

### 4. Sube tu mejor foto o video (Paso 3 de 3)
- Título + subtítulo "Para vivir al experiencia en pantalla." (copy tal cual del PDF original).
- Antes de subir: dos cajas dashed lado a lado — "Tomar una foto" (icono cámara) y "Subir una foto / video" (icono upload + "Foto en JPG o PNG / Video max. 15 seg").
- Tras subir: preview grande (220px alto, radio 12px) + botón "Cambiar".
- Texto "Tu reserva se mostrará en pantalla entre: 10:45 - 11:00" (hora en acento/700).
- Select "¿Prefieres otro horario?" con opción "10:45 - 11:00 (actual) - 12 cupos disponibles".
- Footer: botón atrás + "Pagar COP $40.000" (icono tarjeta, deshabilitado hasta subir imagen).
- "🔒 Pago seguro procesado por Wompi" (11.5px, centrado, gris).

### 5. Confirmación (Pago confirmado)
- Ícono check verde en círculo (56px, borde 2.5px `#2fae4a`).
- "¡Reserva completada exitosamente!" (20px/800, centrado).
- "Tu horario reservado es 10:45 - 11:00" / "Vivirás tu experiencia en pantalla a las ~10:47" (horas en acento/700).
- Caja dashed con "CÓDIGO XX-XX-XX" (acento/800, letter-spacing 2px).
- Texto explicativo (13px/`#6b7280`).
- "¿Quieres una nueva Experiencia LED'S ON?" + botón "← Reserva un nuevo espacio" (full width, acento).
- Stepper: las 5 barras en verde.

## Interactions & Behavior
- Navegación lineal con botón "atrás" en pasos 2 y 3.
- Paso 1→2 requiere filtro seleccionado.
- Paso 2→3 requiere nombre + email + celular + checkbox de términos aceptado (validación completa de formato de email/teléfono queda a criterio del dev).
- Paso 3→Confirmación requiere imagen subida.
- Botones deshabilitados usan una versión clara del color de acento (`#a9c3de` en el prototipo) en vez de opacidad.
- Switch de idioma ES/EN es puramente visual en el prototipo (no traduce contenido) — implementar i18n real en el codebase.
- "Reserva un nuevo espacio" reinicia el flujo a Inicio.

## State Management
- `step`: 0 Inicio, 1 Filtro, 2 Datos, 3 Imagen, 4 Confirmación.
- `filter`: id del filtro elegido.
- `name`, `email`, `phone`, `accepted`, `facturaSi`/`facturaNo`: campos del formulario.
- `hasImage`: si ya se subió foto/video.
- `lang`: 'ES' | 'EN'.
- Data real necesaria del backend: horarios disponibles, precio, filtros artísticos (nombre + preview), código de reserva, hora estimada de proyección.

## Design Tokens
- Color de acento (azul, tweakeable): `#1c5cab` (usado en botones, links, texto destacado, borde de selección).
- Verde de éxito/completado: `#2fae4a`.
- Rojo requerido: `#e5484d`.
- Texto principal: `#14151a` / `#161419`.
- Texto secundario: `#33363b`, `#3a3d42`.
- Texto terciario/gris: `#6b7280`, `#9aa0a6`.
- Bordes: `#d8dcdf` (inputs), `#e3e6e8` (card), `#e1e4e6` (stepper pendiente).
- Fondo header: `#e9edf0`. Fondo página/card: `#f4f6f7` / `#fff`.
- Radios: 9-10px (inputs/botones), 12px (thumbnails/preview), 16-18px (cards/panel principal).
- Tipografía: **Inter** (400/500/600/700/800).
- Ancho de diseño: 576px (max-width), full-bleed en viewports más angostos.

## Assets
- Imagen hero de "Inicio": foto ilustrativa de la Comuna 13 (placeholder en el prototipo vía `<image-slot>` — reemplazar por foto real).
- Preview de imagen subida en Paso 3: placeholder — se llena con la foto/video real del usuario.
- Sin iconografía SVG compleja: los íconos (cámara, upload, tarjeta, check, flechas) están dibujados con formas CSS simples/caracteres de texto en el prototipo; en producción usar la librería de iconos del proyecto.

## Files
- `LedsOn Booking.dc.html` — prototipo HTML interactivo con las 5 pantallas y el fondo animado.
- `graffiti.css` — CSS real del proyecto (fondo animado compartido), sin modificar, incluido como referencia de las clases que el nuevo diseño reutiliza (`.graffiti-wall`, `.spray-cloud--pink/--cyan/--yellow`, `.drip--1/--2/--3`, `.paint-particles`, `.particle`, animaciones `wall-drift`, `concrete-flicker`, `cloud-float-a/b`, `cloud-pulse`, `particle-spin`, `particle-rise`).
