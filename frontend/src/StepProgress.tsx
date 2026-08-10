import { Box, Text } from '@mantine/core';

// El paso "elegir filtro" solo existe cuando la política de filtros (plan
// settings > filtersEnabled) está activa. activeStep crudo sigue siendo
// siempre 0=filtro, 1=datos, 2=foto, 3=confirmada — cuando el paso de filtro
// está desactivado simplemente nunca se pasa por el 0 y la barra/caption se
// corren un paso hacia atrás. Compartido entre BookingForm y
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
  const stepOffset = filtersEnabled ? 0 : 1;
  const totalSteps = filtersEnabled ? labelsWithFilter.length : labelsWithoutFilter.length;
  const displayStep = Math.max(0, activeStep - stepOffset);
  const labels = filtersEnabled ? labelsWithFilter : labelsWithoutFilter;
  const caption =
    displayStep < totalSteps
      ? `PASO ${displayStep + 1} DE ${totalSteps} : ${labels[displayStep]}`
      : 'RESERVA CONFIRMADA';

  return (
    <Box className="ledson-progress">
      <Box className="ledson-progress-bars">
        <span className="ledson-progress-seg" data-state="done" onClick={onHomeClick} />
        {Array.from({ length: totalSteps }).map((_, index) => (
          <span
            key={index}
            className="ledson-progress-seg"
            data-state={index < displayStep ? 'done' : index === displayStep ? 'active' : undefined}
            onClick={() => { if (index < displayStep) onStepClick(index + stepOffset); }}
          />
        ))}
      </Box>
      <Text component="span" className="ledson-progress-caption">
        {caption}
      </Text>
    </Box>
  );
}
