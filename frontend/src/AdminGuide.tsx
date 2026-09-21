import { Accordion, Text, List, Title, Box } from '@mantine/core';

// Guía de uso del panel de administración. Cada sección describe qué hace cada
// pestaña, qué significan sus opciones y si el cambio se aplica al instante o
// requiere guardar. Si se agrega/cambia una opción del panel, actualizar acá.
const SECTIONS: { id: string; title: string; intro: string; items: string[] }[] = [
  {
    id: 'bookings',
    title: 'Reservas y Pagos',
    intro: 'Listado de todas las reservas (pagadas por web y creadas en el stand). Es solo consulta y acciones puntuales.',
    items: [
      'Código: formato MES-DÍA-NÚMERO, por ejemplo AG-20-001 = agosto 20, reserva 1. El número es consecutivo dentro de cada día (001, 002…) y arranca de nuevo cada día. Es el mismo que se muestra en la pantalla gigante durante la proyección, para que cada persona sepa en qué turno va. Se asigna al crear la reserva, por lo que una reserva abandonada sin pagar deja un número sin usar. Meses: EN, FE, MR, AB, MY, JN, JL, AG, SE, OC, NO, DI.',
      'Estados: PENDING (creada, sin pagar) → APPROVED (pagada) → GENERATED (imagen lista) → SHOWN (proyectada) → COMPLETED (terminada, correo y WhatsApp enviados).',
      'Exportar ventas (Excel): descarga un archivo .xlsx con todas las reservas y TODOS sus campos, una fila por reserva. «Desde/Hasta» son opcionales y filtran por la fecha de la reserva; vacíos = todas.',
      'Ver Calendario de Reservas: vista de calendario con las reservas por día.',
    ],
  },
  {
    id: 'sellers',
    title: 'Vendedores, Beneficios y Métodos de Pago',
    intro: 'Listas que alimentan el formulario del stand físico (Reserva Asistida).',
    items: [
      'Vendedores: personas que atienden. Aparecen en el campo «Vendedor». Desactivar uno lo oculta sin borrar su historial.',
      'Beneficios/Promoción: cortesías o descuentos (ej. «Cortesía prensa»). Aparecen en «Beneficio / Promoción» y quedan registrados en la venta.',
      'Métodos de Pago: efectivo, datáfono, QR, etc. Aparecen en «Método de pago» del stand.',
      'Los cambios se guardan al confirmar cada ventana y se ven de inmediato en el formulario del stand.',
    ],
  },
  {
    id: 'filters',
    title: 'Gestión de Filtros',
    intro: 'Estilos artísticos de IA que el cliente puede elegir (solo si los filtros están activados en «Planes de Uso»).',
    items: [
      'Label y Descripción corta: lo que ve el cliente al elegir el estilo.',
      'Nombre del LoRA, Prompt, Fuerza del LoRA y Denoise: parámetros técnicos de la IA. Fuerza/Denoise van de 0.0 a 1.0; más alto = más estilizado y menos parecido a la foto original.',
      'Imágenes de referencia 1 y 2: imágenes de estilo que usa la IA como guía.',
      'Marco Decorativo (PNG con transparencia): marco que se dibuja sobre la foto proyectada con este filtro.',
      'Activar/desactivar un filtro lo muestra u oculta a los clientes.',
    ],
  },
  {
    id: 'plans',
    title: 'Planes de Uso',
    intro: 'Reglas comerciales del servicio.',
    items: [
      'Usar filtros de IA: si se apaga, el cliente no ve el paso de estilos y su foto se proyecta sin estilizar.',
      'Filtros habilitados: limita cuáles filtros ve el cliente (vacío = todos los activos).',
      'Valor del servicio (COP): precio que se cobra en el flujo de pago en línea y el que se muestra como precio de referencia en el stand.',
    ],
  },
  {
    id: 'policies',
    title: 'Políticas',
    intro: 'Cómo se asignan los turnos y con qué pasarela se cobra. Requiere pulsar «Guardar Políticas».',
    items: [
      'Sistema de Franjas: el cliente elige una franja horaria; el sistema le asigna el primer minuto libre dentro de ella.',
      'Cola Automática: la reserva es siempre para hoy y el turno se asigna después de la última reserva, por orden de pago.',
      'Franja Inmediata con Cupo: tras pagar se asigna la franja actual; si está llena, el cliente elige otra.',
      'Pasarela activa: Wompi o DLocal Go, para los pagos web.',
    ],
  },
  {
    id: 'schedules',
    title: 'Gestión de Horarios',
    intro: 'Define en qué horas se pueden proyectar experiencias.',
    items: [
      'Tiempo asignado por usuario (minutos): cada cuántos minutos se le asigna un turno a cada persona (admite decimales, 0.5 = 30 s).',
      'Duración de la franja (minutos): tamaño de cada franja en el modo de Franja Inmediata.',
      'Plantillas: horarios reutilizables (hora inicial, final e intervalo) con sus descansos.',
      'Aplicar plantilla: copia una plantilla a un rango de fechas. Los «tiempos muertos» son descansos en los que no se asignan turnos.',
    ],
  },
  {
    id: 'screen-general',
    title: 'Pantalla Gigante · Configuración general',
    intro: 'Aspecto y tiempos de la pantalla (576×1152, vertical). Se aplica con «Guardar Configuración de Standby»; la pantalla toma los cambios en unos 3 segundos.',
    items: [
      'Fondo Global, Header y Footer: imágenes fijas de fondo, franja superior y franja inferior (opcionales).',
      'Videoloop por defecto: video en bucle que se ve siempre que no haya ninguna experiencia, ni contenido de Parrilla ni Reposo que mostrar. Si no hay videoloop, la pantalla queda en negro.',
      'Imagen por defecto (respaldo): se proyecta en lugar de la foto o video de un cliente si este no se puede cargar (por ejemplo, falla de internet). Si no hay una, se usa el arte de bienvenida de la app.',
      'Sin internet: la pantalla guarda una copia local del videoloop, del video de transición y de la imagen por defecto (la primera vez que los carga con conexión) y la última configuración recibida. Si se cae la conexión, el videoloop sigue y una experiencia que no pueda cargarse se reemplaza por la imagen por defecto. Al volver el internet todo se normaliza solo.',
      'Duración Proyección Foto / Video (seg): cuánto tiempo se muestra la experiencia de un cliente; un video más largo se corta y uno más corto se repite.',
      'Ancho / Alto (px): resolución real de la pantalla; a esas proporciones se recortan las fotos y videos de los clientes.',
      'Efecto de Revelado: cómo aparece la foto (spray, fundido, video overlay o partículas). Con «Video Overlay» se reproduce un video de transición encima de la foto al entrar y al salir; «Duración del Fade» es cuántos segundos finales del video se desvanecen.',
      'Entrada/Salida del Contenedor: animación con la que entra y sale la experiencia.',
      'Marco del Correo: marco que se compone SOLO sobre la foto que se envía por correo (la pantalla no lo usa).',
    ],
  },
  {
    id: 'screen-grid',
    title: 'Pantalla Gigante · Parrilla de Contenidos',
    intro: 'Publicidad/promos programadas que se muestran entre experiencias.',
    items: [
      'Hora Global Inicio/Fin: ventana del día en que la Parrilla puede mostrarse.',
      'Por ítem: Prioridad (en choque gana la mayor), Meta de Apariciones (0 = sin límite), Intervalo (minutos mínimos entre apariciones), Duración, Efecto de transición y Ventanas de exclusión (horas en las que NO debe salir).',
      'Un ítem solo se muestra si está activo, dentro del horario global y de sus reglas. Si ninguno es elegible, se pasa al videoloop por defecto.',
    ],
  },
  {
    id: 'screen-rest',
    title: 'Pantalla Gigante · Pantalla de Reposo',
    intro: 'Ciclo de imágenes/videos para cuando el lugar está inactivo.',
    items: [
      '«Activar tras (minutos)» cuenta el tiempo que la pantalla lleva SIN proyectar nada y SIN ninguna reserva pagada esperando su turno. Al cumplirse, el Reposo reemplaza a la Parrilla y al videoloop.',
      'Se apaga solo en cuanto alguien paga o se proyecta una experiencia.',
      '0 desactiva el Reposo: entonces se ve la Parrilla y, si no hay, el videoloop por defecto.',
      'Al agregar o editar un contenido espera a que termine de subirse (el botón dice «Subiendo archivo…»). Un cambio se ve cuando el ciclo llega a ese contenido; si el Reposo no está activo en ese momento, no se ve.',
      'Orden de prioridad de la pantalla: experiencia en curso > Reposo > Parrilla > videoloop por defecto > negro.',
    ],
  },
  {
    id: 'emails',
    title: 'Correos',
    intro: 'Herramienta de pruebas.',
    items: [
      'Envía el correo de confirmación o el de recuerdo, con datos de ejemplo, a la dirección que escribas para revisarlo en una bandeja real.',
    ],
  },
];

export function AdminGuide() {
  return (
    <Box maw={900}>
      <Title order={3} mb="xs">Guía del panel de administración</Title>
      <Text c="dimmed" size="sm" mb="md">
        Qué hace cada pestaña y cada opción. Salvo donde se indica un botón «Guardar», los cambios de listas
        (vendedores, beneficios, métodos, filtros) se aplican al confirmar; la pantalla gigante los toma sola en unos 3 segundos.
      </Text>
      <Accordion variant="separated" multiple>
        {SECTIONS.map((s) => (
          <Accordion.Item key={s.id} value={s.id}>
            <Accordion.Control>{s.title}</Accordion.Control>
            <Accordion.Panel>
              <Text size="sm" mb="xs">{s.intro}</Text>
              <List size="sm" spacing="xs">
                {s.items.map((it, i) => <List.Item key={i}>{it}</List.Item>)}
              </List>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Box>
  );
}
