import { Box, Text } from '@mantine/core';

// El paso "elegir filtro" solo existe cuando la política de filtros (plan
// settings > filtersEnabled) está activa. activeStep crudo sigue siendo
// siempre 0=filtro, 1=datos, 2=foto, 3=confirmada. El TOTAL de pasos (y la
// cantidad de segmentos de la barra) siempre cuenta el paso de filtro aunque
// esté oculto — así el "PASO X DE N" no se renumera al apagar/prender la
// política; el segmento del filtro simplemente queda marcado "done" de una
// (ya "pasado") cuando está desactivado. Compartido entre BookingForm y
// AssistedBookingForm para que ambos flujos se mantengan sincronizados.
export function StepProgress({
  activeStep,
  filtersEnabled,
  labelsWithFilter,
  labelsWithoutFilter,
  onStepClick,
  onHomeClick,
}: {
  activeStep: number;
  filtersEnabled: boolean;
  labelsWithFilter: string[];
  labelsWithoutFilter: string[];
  onStepClick: (index: number) => void;
  onHomeClick: () => void;
}) {
  const totalSteps = labelsWithFilter.length;
  const stepOffset = filtersEnabled ? 0 : 1;
  const labels = filtersEnabled ? labelsWithFilter : labelsWithoutFilter;
  const labelIndex = Math.max(0, activeStep - stepOffset);
  const isConfirmed = activeStep >= totalSteps;
  const caption = isConfirmed
    ? 'PAGO CONFIRMADO'
    : `PASO ${activeStep + 1} DE ${totalSteps} : ${labels[labelIndex]}`;
  // +1: además de los pasos reales, la barra tiene un segmento final propio
  // para el estado "confirmado" (así el total visible es siempre 5 con el
  // de Inicio, igual que en el diseño).
  const filledUpTo = Math.max(activeStep, stepOffset);

  return (
    <Box className="ledson-progress">
      <Box className="ledson-progress-bars">
        <span className="ledson-progress-seg" data-state="done" onClick={onHomeClick} />
        {Array.from({ length: totalSteps + 1 }).map((_, index) => (
          <span
            key={index}
            className="ledson-progress-seg"
            data-state={index < filledUpTo || (isConfirmed && index === activeStep) ? 'done' : index === activeStep ? 'active' : undefined}
            onClick={() => { if (index >= stepOffset && index < activeStep) onStepClick(index); }}
          />
        ))}
      </Box>
      <Text component="span" className="ledson-progress-caption">
        {caption}
      </Text>
    </Box>
  );
}
