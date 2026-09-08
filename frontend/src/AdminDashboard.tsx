import { useState, useEffect } from 'react';
import { Container, Title, Tabs, Table, Button, Badge, Group, Text, Image, Box, TextInput, Textarea, Modal, Grid, FileButton, ActionIcon, Loader, Select, NumberInput, Radio, Switch, MultiSelect, CloseButton } from '@mantine/core';
import { IconUsers, IconFilter, IconDeviceTv, IconCheck, IconLink, IconExternalLink, IconUpload, IconCalendar, IconShieldLock, IconCoin, IconUserPlus } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from './config';
import { ImageCropModal } from './ImageCropModal';
import { VideoTrimModal } from './VideoTrimModal';

// Proporción real de la pantalla de proyección — configurable desde este
// panel (ver cropWidth/cropHeight) para que el recorte de fotos/videos del
// admin y de los clientes coincida exactamente con lo que se ve en pantalla.
// Estos son solo los valores por defecto antes de cargar la configuración.
const DEFAULT_CROP_WIDTH = 576;
const DEFAULT_CROP_HEIGHT = 1152;

interface ScreenUploadTarget {
  setUrlCallback: (url: string) => void;
  setTypeCallback?: (type: string) => void;
  setDurationCallback?: (duration: number) => void;
  setTrimCallback?: (trimStart: number, trimEnd: number) => void;
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);
  const [filters, setFilters] = useState<any[]>([]);
  const [opened, { open, close }] = useDisclosure(false);
  const [newFilter, setNewFilter] = useState<any>({
    label: '', description: '', value: '', imageUrl: '', lora: '', prompt: '', lora_strength: 0.8, denoise: 0.6, frameUrl: '', referenceImageUrl1: '', referenceImageUrl2: ''
  });
  const [sellers, setSellers] = useState<any[]>([]);
  const [sellerModalOpened, { open: openSellerModal, close: closeSellerModal }] = useDisclosure(false);
  const [newSeller, setNewSeller] = useState<any>({ name: '' });
  const [benefits, setBenefits] = useState<any[]>([]);
  const [benefitModalOpened, { open: openBenefitModal, close: closeBenefitModal }] = useDisclosure(false);
  const [newBenefit, setNewBenefit] = useState<any>({ name: '' });
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [paymentMethodModalOpened, { open: openPaymentMethodModal, close: closePaymentMethodModal }] = useDisclosure(false);
  const [newPaymentMethod, setNewPaymentMethod] = useState<any>({ name: '' });
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [screenBgUrl, setScreenBgUrl] = useState('');
  const [headerUrl, setHeaderUrl] = useState('');
  const [footerUrl, setFooterUrl] = useState('');
  // Los campos numéricos de abajo usan '' como estado intermedio válido
  // (campo vacío mientras se escribe). Forzar a un número en cada tecla (ej.
  // `Number(val) || 15`) rompe el cursor al borrar el campo: el valor salta
  // al fallback y el siguiente dígito se inserta en el lugar equivocado.
  const [projectionDuration, setProjectionDuration] = useState<number | ''>(15);
  const [videoProjectionDuration, setVideoProjectionDuration] = useState<number | ''>(15);
  const [globalGridStartTime, setGlobalGridStartTime] = useState('08:00:00');
  const [globalGridEndTime, setGlobalGridEndTime] = useState('17:00:00');
  const [cropWidth, setCropWidth] = useState<number | ''>(DEFAULT_CROP_WIDTH);
  const [cropHeight, setCropHeight] = useState<number | ''>(DEFAULT_CROP_HEIGHT);

  // Efecto de Revelado de Proyección: global, con o sin filtros activos (antes
  // vivía en cada filtro, pero sin filtro seleccionado no había de dónde
  // sacarlo). "spray" = lata 3D (como hoy); "fade" = fundido simple + marco;
  // "video-overlay" = un video se reproduce encima y se desvanece al final,
  // revelando la foto/video real que ya está debajo.
  const [revealEffect, setRevealEffect] = useState('spray');
  const [revealOverlayVideoUrl, setRevealOverlayVideoUrl] = useState('');
  const [revealOverlayFadeSeconds, setRevealOverlayFadeSeconds] = useState<number | ''>(2);
  const [containerTransition, setContainerTransition] = useState('fade');

  // Marco global compuesto SOLO en la foto que se envía por correo (la
  // proyección en pantalla no lo usa). Reemplaza al marco por filtro para
  // este propósito, ya que este evento tiene los filtros desactivados.
  const [emailFrameUrl, setEmailFrameUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [pendingUploadTarget, setPendingUploadTarget] = useState<ScreenUploadTarget | null>(null);
  const [rawImageForCrop, setRawImageForCrop] = useState<string | null>(null);
  const [imageCropModalOpened, setImageCropModalOpened] = useState(false);
  const [rawVideoFile, setRawVideoFile] = useState<File | null>(null);
  const [videoTrimModalOpened, setVideoTrimModalOpened] = useState(false);
  const [contentGrid, setContentGrid] = useState<any[]>([]);
  const [deadTimes, setDeadTimes] = useState<any[]>([]);
  const [gridModalOpened, { open: openGridModal, close: closeGridModal }] = useDisclosure(false);
  const [newGridItem, setNewGridItem] = useState<any>({
    name: '', url: '', type: 'image', duration: 10, priority: 1, active: true,
    targetAppearances: 100, currentAppearances: 0, cooldownPeriod: 30, noConsecutive: true, exclusionWindows: [], transition: 'fade'
  });

  // Pantalla de Reposo: independiente de la Parrilla de Contenidos. Solo se
  // activa tras N minutos sin proyecciones NI reservas pendientes (ver
  // hasPendingQueue en screen-settings) — mientras tanto la Parrilla sigue
  // funcionando exactamente igual que hoy.
  // '' = campo momentáneamente vacío mientras se escribe. Forzar a un número
  // en cada tecla (como antes) rompía el cursor: al borrar, el valor saltaba
  // a 0 y el siguiente dígito se insertaba ANTES del "0" en vez de después
  // (ej. escribir "45" terminaba en "450").
  const [restScreenIdleMinutes, setRestScreenIdleMinutes] = useState<number | ''>(5);
  const [restScreenItems, setRestScreenItems] = useState<any[]>([]);
  const [restItemModalOpened, { open: openRestItemModal, close: closeRestItemModal }] = useDisclosure(false);
  const [newRestItem, setNewRestItem] = useState<any>({ name: '', url: '', type: 'image', duration: 10 });

  // Remove unused addSecondsToTime if it's there but actually used inside useEffect.
  // Actually wait, let's keep it but suppress the TS warning by removing if not used. 
  // Let's replace the whole unused declaration.

  // Schedules states
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateModalOpened, { open: openTemplateModal, close: closeTemplateModal }] = useDisclosure(false);
  const [newTemplate, setNewTemplate] = useState<any>({ name: '', slots: [], deadTimes: [] });
  const [applyModalOpened, { open: openApplyModal, close: closeApplyModal }] = useDisclosure(false);
  const [selectedTemplateToApply, setSelectedTemplateToApply] = useState('');
  const [startDateToApply, setStartDateToApply] = useState('');
  const [endDateToApply, setEndDateToApply] = useState('');
  
  const [autoSlotStart, setAutoSlotStart] = useState('20:00');
  const [autoSlotEnd, setAutoSlotEnd] = useState('23:00');
  const [autoSlotInterval, setAutoSlotInterval] = useState<string | null>('60');
  
  // '' = campo momentáneamente vacío mientras se escribe (ej. al teclear
  // "0.5" para pedir 30s, pasa por "0" antes de llegar al punto decimal).
  const [slotDuration, setSlotDuration] = useState<number | ''>(1);
  const [franjaDuration, setFranjaDuration] = useState<number | ''>(15);
  const [bookingSystemType, setBookingSystemType] = useState('slots');
  const [paymentGateway, setPaymentGateway] = useState('wompi');

  // Plan de uso
  const [planFiltersEnabled, setPlanFiltersEnabled] = useState(true);
  const [planAllowedFilterIds, setPlanAllowedFilterIds] = useState<string[]>([]);
  const [planPrice, setPlanPrice] = useState<number | ''>(15000);

  const fetchData = async () => {
    try {
      const [resBookings, resFilters, resScreen, resTemplates, resScheduleSettings, resPlanSettings, resSellers, resBenefits, resPaymentMethods] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/bookings`),
        axios.get(`${API_BASE_URL}/api/images/admin`),
        axios.get(`${API_BASE_URL}/api/bookings/screen-settings`),
        axios.get(`${API_BASE_URL}/api/schedules/templates`),
        axios.get(`${API_BASE_URL}/api/schedules/settings`),
        axios.get(`${API_BASE_URL}/api/plans/settings`),
        axios.get(`${API_BASE_URL}/api/sellers/admin`),
        axios.get(`${API_BASE_URL}/api/benefits/admin`),
        axios.get(`${API_BASE_URL}/api/payment-methods/admin`)
      ]);
      setBookings(resBookings.data);
      setFilters(resFilters.data);
      setSellers(resSellers.data);
      setBenefits(resBenefits.data);
      setPaymentMethods(resPaymentMethods.data);
      setTemplates(resTemplates.data || []);
      setSlotDuration(resScheduleSettings.data?.slotDuration || 1);
      setFranjaDuration(resScheduleSettings.data?.franjaDuration || 15);
      setBookingSystemType(resScheduleSettings.data?.bookingSystemType || 'slots');
      setPaymentGateway(resScheduleSettings.data?.paymentGateway || 'wompi');
      setPlanFiltersEnabled(resPlanSettings.data?.filtersEnabled ?? true);
      setPlanAllowedFilterIds(resPlanSettings.data?.allowedFilterIds || []);
      setPlanPrice(resPlanSettings.data?.price ?? 15000);
      if (resScreen.data) {
        setScreenBgUrl(resScreen.data.backgroundUrl || '');
        setHeaderUrl(resScreen.data.headerUrl || '');
        setFooterUrl(resScreen.data.footerUrl || '');
        setProjectionDuration(resScreen.data.projectionDuration || 15);
        setVideoProjectionDuration(resScreen.data.videoProjectionDuration || 15);
        setGlobalGridStartTime(resScreen.data.globalGridStartTime || '08:00:00');
        setGlobalGridEndTime(resScreen.data.globalGridEndTime || '17:00:00');
        setCropWidth(resScreen.data.cropWidth || DEFAULT_CROP_WIDTH);
        setCropHeight(resScreen.data.cropHeight || DEFAULT_CROP_HEIGHT);
        setContentGrid(resScreen.data.contentGrid || []);
        setDeadTimes(resScreen.data.deadTimes || []);
        setRestScreenIdleMinutes(resScreen.data.restScreenIdleMinutes ?? 5);
        setRestScreenItems(resScreen.data.restScreenItems || []);
        setRevealEffect(resScreen.data.revealEffect || 'spray');
        setRevealOverlayVideoUrl(resScreen.data.revealOverlayVideoUrl || '');
        setRevealOverlayFadeSeconds(resScreen.data.revealOverlayFadeSeconds ?? 2);
        setContainerTransition(resScreen.data.containerTransition || 'fade');
        setEmailFrameUrl(resScreen.data.emailFrameUrl || '');
      }
    } catch (e) {
      console.error('Error fetching admin data', e);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh bookings every 5 seconds without reloading the page
    const intervalId = setInterval(async () => {
      try {
        const resBookings = await axios.get(`${API_BASE_URL}/api/bookings`);
        setBookings(resBookings.data);
      } catch (e) {
        console.error('Error auto-refreshing bookings', e);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, []);

  /* const handleUpdateBookingStatus = async (id: string, status: string) => {
    await axios.put(`${API_BASE_URL}/api/bookings/${id}/status`, { status });
    fetchData();
  }; */

  const handleAddFilter = async () => {
    if (newFilter._id) {
      // Editar
      const { _id, ...updateData } = newFilter;
      await axios.put(`${API_BASE_URL}/api/images/${_id}`, updateData);
    } else {
      // Crear
      await axios.post(`${API_BASE_URL}/api/images`, newFilter);
    }
    
    setNewFilter({ label: '', value: '', imageUrl: '', lora: '', prompt: '', lora_strength: 0.8, denoise: 0.6, frameUrl: '', referenceImageUrl1: '', referenceImageUrl2: '' });
    close();
    fetchData();
  };

  const handleEditFilter = (f: any) => {
    setNewFilter(f);
    open();
  };

  const handleToggleFilterStatus = async (id: string, active: boolean) => {
    await axios.put(`${API_BASE_URL}/api/images/${id}`, { active });
    fetchData();
  };

  const handleAddSeller = async () => {
    if (newSeller._id) {
      const { _id, ...updateData } = newSeller;
      await axios.put(`${API_BASE_URL}/api/sellers/${_id}`, updateData);
    } else {
      await axios.post(`${API_BASE_URL}/api/sellers`, newSeller);
    }

    setNewSeller({ name: '' });
    closeSellerModal();
    fetchData();
  };

  const handleEditSeller = (s: any) => {
    setNewSeller(s);
    openSellerModal();
  };

  const handleToggleSellerStatus = async (id: string, active: boolean) => {
    await axios.put(`${API_BASE_URL}/api/sellers/${id}`, { active });
    fetchData();
  };

  const handleAddBenefit = async () => {
    if (newBenefit._id) {
      const { _id, ...updateData } = newBenefit;
      await axios.put(`${API_BASE_URL}/api/benefits/${_id}`, updateData);
    } else {
      await axios.post(`${API_BASE_URL}/api/benefits`, newBenefit);
    }

    setNewBenefit({ name: '' });
    closeBenefitModal();
    fetchData();
  };

  const handleEditBenefit = (b: any) => {
    setNewBenefit(b);
    openBenefitModal();
  };

  const handleToggleBenefitStatus = async (id: string, active: boolean) => {
    await axios.put(`${API_BASE_URL}/api/benefits/${id}`, { active });
    fetchData();
  };

  const handleAddPaymentMethod = async () => {
    if (newPaymentMethod._id) {
      const { _id, ...updateData } = newPaymentMethod;
      await axios.put(`${API_BASE_URL}/api/payment-methods/${_id}`, updateData);
    } else {
      await axios.post(`${API_BASE_URL}/api/payment-methods`, newPaymentMethod);
    }

    setNewPaymentMethod({ name: '' });
    closePaymentMethodModal();
    fetchData();
  };

  const handleEditPaymentMethod = (m: any) => {
    setNewPaymentMethod(m);
    openPaymentMethodModal();
  };

  const handleTogglePaymentMethodStatus = async (id: string, active: boolean) => {
    await axios.put(`${API_BASE_URL}/api/payment-methods/${id}`, { active });
    fetchData();
  };

  const handleGenerateImage = async (id: string) => {
    setGeneratingId(id);
    try {
      await axios.post(`${API_BASE_URL}/api/bookings/${id}/generate`);
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Error contactando a la API de generación de imágenes.');
    } finally {
      setGeneratingId(null);
    }
  };

  const handleUpdateSettings = async (overrideGrid?: any[], overrideRestItems?: any[]) => {
    await axios.put(`${API_BASE_URL}/api/bookings/screen-settings`, {
      backgroundUrl: screenBgUrl,
      headerUrl,
      footerUrl,
      projectionDuration: Number(projectionDuration) || 15,
      videoProjectionDuration: Number(videoProjectionDuration) || 15,
      globalGridStartTime,
      globalGridEndTime,
      cropWidth: Number(cropWidth) || DEFAULT_CROP_WIDTH,
      cropHeight: Number(cropHeight) || DEFAULT_CROP_HEIGHT,
      contentGrid: overrideGrid || contentGrid,
      deadTimes,
      restScreenIdleMinutes: Number(restScreenIdleMinutes) || 0,
      restScreenItems: overrideRestItems || restScreenItems,
      revealEffect,
      revealOverlayVideoUrl,
      revealOverlayFadeSeconds: Number(revealOverlayFadeSeconds) || 2,
      containerTransition,
      emailFrameUrl,
    });
    alert('Configuración de la Pantalla Gigante actualizada');
  };

  const MAX_SCREEN_UPLOAD_MB = 300;

  // Subida multipart real (FormData), no base64+JSON: un video de 300MB en
  // base64 son ~400MB de string y el navegador revienta al hacer
  // JSON.stringify ("allocation size overflow") antes de que el archivo
  // llegue siquiera al backend.
  const handleUploadFile = async (
    file: File | null,
    setUrlCallback: (url: string) => void,
    setTypeCallback?: (type: string) => void,
    setDurationCallback?: (duration: number) => void
  ) => {
    if (!file) return;
    if (file.size > MAX_SCREEN_UPLOAD_MB * 1024 * 1024) {
      alert(`El archivo pesa demasiado (máximo ${MAX_SCREEN_UPLOAD_MB}MB).`);
      return;
    }
    setIsUploading(true);
    const isVideo = file.type.startsWith('video/');
    if (setTypeCallback) setTypeCallback(isVideo ? 'video' : 'image');

    if (isVideo && setDurationCallback) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        setDurationCallback(Math.round(video.duration));
      };
      video.src = URL.createObjectURL(file);
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'screen-assets');
    try {
      const res = await axios.post(`${API_BASE_URL}/api/images/upload-file`, formData);
      setUrlCallback(res.data.url);
    } catch (e) {
      console.error(e);
      alert('Error subiendo archivo a Firebase');
    } finally {
      setIsUploading(false);
    }
  };

  // Reemplaza la llamada directa a handleUploadFile para las 4 imágenes/videos
  // de la pantalla gigante (fondo, header, footer, ítems de la parrilla): si
  // es una imagen, abre el recorte interactivo a la proporción real de la
  // pantalla (576:1152) antes de subirla; si es un video CON callback de
  // tramo (solo los ítems de la parrilla, que sí se proyectan como video),
  // abre el selector de tramo (máx. 15s). El fondo en video no tiene dónde
  // guardar el tramo (no se renderiza como video en la pantalla hoy) y se
  // sube tal cual, igual que antes.
  const handleScreenAssetSelect = (file: File | null, target: ScreenUploadTarget) => {
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    if (isVideo) {
      if (!target.setTrimCallback) {
        handleUploadFile(file, target.setUrlCallback, target.setTypeCallback, target.setDurationCallback);
        return;
      }
      setPendingUploadTarget(target);
      setRawVideoFile(file);
      setVideoTrimModalOpened(true);
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPendingUploadTarget(target);
        setRawImageForCrop(reader.result as string);
        setImageCropModalOpened(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScreenImageCropConfirm = (croppedBase64: string) => {
    if (pendingUploadTarget) {
      const file = dataUrlToFile(croppedBase64, 'screen-asset.jpg');
      handleUploadFile(file, pendingUploadTarget.setUrlCallback, pendingUploadTarget.setTypeCallback, pendingUploadTarget.setDurationCallback);
    }
    setImageCropModalOpened(false);
    setRawImageForCrop(null);
    setPendingUploadTarget(null);
  };

  const handleScreenImageCropCancel = () => {
    setImageCropModalOpened(false);
    setRawImageForCrop(null);
    setPendingUploadTarget(null);
  };

  const handleScreenVideoTrimConfirm = (trim: { trimStart: number; trimEnd: number }) => {
    if (pendingUploadTarget && rawVideoFile) {
      handleUploadFile(rawVideoFile, pendingUploadTarget.setUrlCallback, pendingUploadTarget.setTypeCallback, pendingUploadTarget.setDurationCallback);
      pendingUploadTarget.setTrimCallback?.(trim.trimStart, trim.trimEnd);
    }
    setVideoTrimModalOpened(false);
    setRawVideoFile(null);
    setPendingUploadTarget(null);
  };

  const handleScreenVideoTrimCancel = () => {
    setVideoTrimModalOpened(false);
    setRawVideoFile(null);
    setPendingUploadTarget(null);
  };

  const handleClearScreen = async () => {
    await axios.post(`${API_BASE_URL}/api/bookings/screen-settings/clear`);
    alert('Pantalla gigante despejada');
  };

  const handleProject = async (id: string) => {
    await axios.post(`${API_BASE_URL}/api/bookings/${id}/project`);
    fetchData();
  };

  const handleSaveTemplate = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/schedules/templates`, newTemplate);
      setNewTemplate({ name: '', slots: [], deadTimes: [] });
      closeTemplateModal();
      fetchData();
    } catch (e) {
      alert('Error guardando plantilla');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (confirm('¿Eliminar plantilla?')) {
      await axios.delete(`${API_BASE_URL}/api/schedules/templates/${id}`);
      fetchData();
    }
  };

  const handleEditTemplate = (t: any) => {
    setNewTemplate({ ...t });
    openTemplateModal();
  };

  const handleAutoGenerateSlots = () => {
    if (!autoSlotStart || !autoSlotEnd || !autoSlotInterval) return;
    
    const slots = [];
    let current = new Date(`2000-01-01T${autoSlotStart}:00`);
    const end = new Date(`2000-01-01T${autoSlotEnd}:00`);
    const intervalMs = parseInt(autoSlotInterval) * 60000;

    if (end <= current) {
      end.setDate(end.getDate() + 1);
    }

    while (current < end) {
      const startStr = current.toTimeString().slice(0, 5);
      const next = new Date(current.getTime() + intervalMs);
      if (next > end) break; // Evitar que se pase de la hora final
      const nextStr = next.toTimeString().slice(0, 5);
      slots.push({ startTime: startStr, endTime: nextStr });
      current = next;
    }

    setNewTemplate({...newTemplate, slots: [...newTemplate.slots, ...slots]});
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplateToApply || !startDateToApply || !endDateToApply) {
      return alert('Selecciona una plantilla y un rango de fechas');
    }
    
    const start = new Date(`${startDateToApply}T12:00:00`);
    const end = new Date(`${endDateToApply}T12:00:00`);

    if (start > end) {
      return alert('La fecha inicial no puede ser posterior a la fecha final');
    }

    const dates = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    try {
      await axios.post(`${API_BASE_URL}/api/schedules/apply-template`, {
        templateId: selectedTemplateToApply,
        dates
      });
      alert(`Plantilla aplicada exitosamente desde ${startDateToApply} hasta ${endDateToApply}`);
      closeApplyModal();
    } catch (e) {
      alert('Error aplicando plantilla');
    }
  };

  const handleUpdateScheduleSettings = async () => {
    try {
      await axios.put(`${API_BASE_URL}/api/schedules/settings`, { slotDuration: Number(slotDuration) || 1, franjaDuration: Number(franjaDuration) || 15, bookingSystemType, paymentGateway });
      alert('Ajustes guardados correctamente');
    } catch (e) {
      alert('Error guardando ajustes');
    }
  };

  const handleUpdatePlanSettings = async () => {
    try {
      await axios.put(`${API_BASE_URL}/api/plans/settings`, {
        filtersEnabled: planFiltersEnabled,
        allowedFilterIds: planAllowedFilterIds,
        price: planPrice
      });
      alert('Plan de uso guardado correctamente');
    } catch (e) {
      alert('Error guardando el plan de uso');
    }
  };

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" align="center" mb="xl">
        <Title order={2}>Panel de Administración</Title>
        <Group>
          <Button variant="light" leftSection={<IconLink size={16} />} onClick={() => navigate('/booking')}>
            Enlace Reserva (Wompi)
          </Button>
          <Button variant="light" color="grape" leftSection={<IconLink size={16} />} onClick={() => navigate('/assisted-booking')}>
            Terminal de Stand (Físico)
          </Button>
          <Button variant="filled" color="dark" leftSection={<IconExternalLink size={16} />} onClick={() => window.open('/screen', '_blank')}>
            Abrir Pantalla Gigante
          </Button>
          <Button variant="filled" color="indigo" leftSection={<IconCalendar size={16} />} onClick={() => navigate('/admin/grid')}>
            Parrilla de Contenidos
          </Button>
        </Group>
      </Group>

      <Tabs defaultValue="bookings">
        <Tabs.List mb="md">
          <Tabs.Tab value="bookings" leftSection={<IconUsers size={16} />}>Reservas y Pagos</Tabs.Tab>
          <Tabs.Tab value="sellers" leftSection={<IconUserPlus size={16} />}>Vendedores</Tabs.Tab>
          <Tabs.Tab value="benefits" leftSection={<IconCoin size={16} />}>Beneficios/Promoción</Tabs.Tab>
          <Tabs.Tab value="paymentMethods" leftSection={<IconCoin size={16} />}>Métodos de Pago</Tabs.Tab>
          <Tabs.Tab value="filters" leftSection={<IconFilter size={16} />}>Gestión de Filtros</Tabs.Tab>
          <Tabs.Tab value="plans" leftSection={<IconCoin size={16} />}>Planes de Uso</Tabs.Tab>
          <Tabs.Tab value="schedules" leftSection={<IconCalendar size={16} />}>Gestión de Horarios</Tabs.Tab>
          <Tabs.Tab value="screen" leftSection={<IconDeviceTv size={16} />}>Pantalla Gigante</Tabs.Tab>
          <Tabs.Tab value="policies" leftSection={<IconShieldLock size={16} />}>Políticas</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="bookings">
          <Group justify="space-between" mb="md" align="center">
            <Text fw={500} size="lg">Listado de Reservas</Text>
            <Button leftSection={<IconCalendar size={16} />} onClick={() => navigate('/admin/bookings-calendar')} variant="light" color="indigo">
              Ver Calendario de Reservas
            </Button>
          </Group>
          <Box style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nombre</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Filtro</Table.Th>
                  <Table.Th>Horario Asignado</Table.Th>
                  <Table.Th>Método Pago</Table.Th>
                  <Table.Th>Factura Electrónica</Table.Th>
                  <Table.Th>Vendedor</Table.Th>
                  <Table.Th>Beneficio</Table.Th>
                  <Table.Th>Valor Pagado</Table.Th>
                  <Table.Th>Estado</Table.Th>
                  <Table.Th>Foto</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {bookings.map((b) => (
                  <Table.Tr key={b.id}>
                    <Table.Td>{b.name}</Table.Td>
                    <Table.Td>{b.email}</Table.Td>
                    <Table.Td>
                      <Badge color="grape" variant="light">{filters.find(f => f._id === b.selectedFilter)?.label || b.selectedFilter}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color="gray">{b.timeSlot}</Badge>
                      <br/>
                      <Text size="xs" fw={700} c="dimmed">Exacto: {b.exactTime || 'N/A'}</Text>
                    </Table.Td>
                    <Table.Td>{b.paymentMethod}</Table.Td>
                    <Table.Td>
                      <Badge color={b.requiresInvoice ? 'yellow' : 'gray'} variant="light">{b.requiresInvoice ? 'Sí' : 'No'}</Badge>
                    </Table.Td>
                    <Table.Td>{sellers.find(s => s._id === b.sellerId)?.name || '—'}</Table.Td>
                    <Table.Td>{benefits.find(ben => ben._id === b.benefitId)?.name || '—'}</Table.Td>
                    <Table.Td>{b.paidAmount != null ? `$${Number(b.paidAmount).toLocaleString('es-CO')}` : '—'}</Table.Td>
                    <Table.Td>
                      <Badge color={b.status === 'SHOWN' ? 'blue' : b.status === 'COMPLETED' ? 'grape' : b.status === 'GENERATED' ? 'teal' : 'orange'}>
                        {b.status === 'SHOWN' ? 'PROYECTADA' : b.status === 'COMPLETED' ? 'FINALIZADA' : b.status === 'GENERATED' ? 'GENERADA' : 'EN COLA'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {b.status === 'COMPLETED' || b.status === 'SHOWN' || b.status === 'GENERATED' ? (
                        <a href={b.generatedImageUrl || b.imageUrl} target="_blank" rel="noreferrer" style={{color: 'blue'}}>Ver Imagen IA</a>
                      ) : (
                        <a href={b.imageUrl} target="_blank" rel="noreferrer" style={{color: 'blue'}}>Ver Original</a>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="sellers">
          <Group justify="space-between" mb="sm">
            <Text fw={500}>Vendedores</Text>
            <Button onClick={openSellerModal}>+ Añadir Vendedor</Button>
          </Group>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nombre</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sellers.map((s) => (
                <Table.Tr key={s._id}>
                  <Table.Td>{s.name}</Table.Td>
                  <Table.Td>
                    <Badge color={s.active ? 'green' : 'red'}>{s.active ? 'Activo' : 'Inactivo'}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Button size="xs" color="blue" variant="subtle" onClick={() => handleEditSeller(s)}>Editar</Button>
                      <Button
                        size="xs"
                        variant="light"
                        color={s.active ? 'red' : 'green'}
                        onClick={() => handleToggleSellerStatus(s._id, !s.active)}
                      >
                        {s.active ? 'Desactivar' : 'Activar'}
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Modal opened={sellerModalOpened} onClose={() => {
            setNewSeller({ name: '' });
            closeSellerModal();
          }} title={newSeller._id ? 'Editar Vendedor' : 'Añadir Nuevo Vendedor'}>
            <TextInput label="Nombre del vendedor" value={newSeller.name} onChange={e => setNewSeller({ ...newSeller, name: e.currentTarget.value })} mb="md" />
            <Button fullWidth onClick={handleAddSeller}>Guardar Vendedor</Button>
          </Modal>
        </Tabs.Panel>

        <Tabs.Panel value="benefits">
          <Text size="xs" c="dimmed" mb="sm">
            Opciones que el vendedor puede elegir en el formulario de reserva asistida (estand físico) para registrar cortesías o promociones. No afectan el precio general de la experiencia.
          </Text>
          <Group justify="space-between" mb="sm">
            <Text fw={500}>Beneficios/Promoción</Text>
            <Button onClick={openBenefitModal}>+ Añadir Beneficio</Button>
          </Group>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nombre</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {benefits.map((b) => (
                <Table.Tr key={b._id}>
                  <Table.Td>{b.name}</Table.Td>
                  <Table.Td>
                    <Badge color={b.active ? 'green' : 'red'}>{b.active ? 'Activo' : 'Inactivo'}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Button size="xs" color="blue" variant="subtle" onClick={() => handleEditBenefit(b)}>Editar</Button>
                      <Button
                        size="xs"
                        variant="light"
                        color={b.active ? 'red' : 'green'}
                        onClick={() => handleToggleBenefitStatus(b._id, !b.active)}
                      >
                        {b.active ? 'Desactivar' : 'Activar'}
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Modal opened={benefitModalOpened} onClose={() => {
            setNewBenefit({ name: '' });
            closeBenefitModal();
          }} title={newBenefit._id ? 'Editar Beneficio' : 'Añadir Nuevo Beneficio'}>
            <TextInput label="Nombre del beneficio/promoción" placeholder="Ej. Cortesía prensa" value={newBenefit.name} onChange={e => setNewBenefit({ ...newBenefit, name: e.currentTarget.value })} mb="md" />
            <Button fullWidth onClick={handleAddBenefit}>Guardar Beneficio</Button>
          </Modal>
        </Tabs.Panel>

        <Tabs.Panel value="paymentMethods">
          <Text size="xs" c="dimmed" mb="sm">
            Métodos de pago disponibles en el formulario de reserva asistida (estand físico).
          </Text>
          <Group justify="space-between" mb="sm">
            <Text fw={500}>Métodos de Pago</Text>
            <Button onClick={openPaymentMethodModal}>+ Añadir Método de Pago</Button>
          </Group>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nombre</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paymentMethods.map((m) => (
                <Table.Tr key={m._id}>
                  <Table.Td>{m.name}</Table.Td>
                  <Table.Td>
                    <Badge color={m.active ? 'green' : 'red'}>{m.active ? 'Activo' : 'Inactivo'}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Button size="xs" color="blue" variant="subtle" onClick={() => handleEditPaymentMethod(m)}>Editar</Button>
                      <Button
                        size="xs"
                        variant="light"
                        color={m.active ? 'red' : 'green'}
                        onClick={() => handleTogglePaymentMethodStatus(m._id, !m.active)}
                      >
                        {m.active ? 'Desactivar' : 'Activar'}
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Modal opened={paymentMethodModalOpened} onClose={() => {
            setNewPaymentMethod({ name: '' });
            closePaymentMethodModal();
          }} title={newPaymentMethod._id ? 'Editar Método de Pago' : 'Añadir Nuevo Método de Pago'}>
            <TextInput label="Nombre del método de pago" placeholder="Ej. Efectivo COP" value={newPaymentMethod.name} onChange={e => setNewPaymentMethod({ ...newPaymentMethod, name: e.currentTarget.value })} mb="md" />
            <Button fullWidth onClick={handleAddPaymentMethod}>Guardar Método de Pago</Button>
          </Modal>
        </Tabs.Panel>

        <Tabs.Panel value="filters">
          <Group justify="space-between" mb="sm">
            <Text fw={500}>Filtros Disponibles</Text>
            <Button onClick={open}>+ Añadir Filtro</Button>
          </Group>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Miniatura</Table.Th>
                <Table.Th>Label (Visual)</Table.Th>
                <Table.Th>Value (API Backend)</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filters.map((f) => (
                <Table.Tr key={f._id}>
                  <Table.Td><Image src={f.imageUrl} w={50} radius="sm" /></Table.Td>
                  <Table.Td>{f.label}</Table.Td>
                  <Table.Td><code>{f.value}</code></Table.Td>
                  <Table.Td>
                    <Badge color={f.active ? 'green' : 'red'}>{f.active ? 'Activo' : 'Inactivo'}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Button size="xs" color="blue" variant="subtle" onClick={() => handleEditFilter(f)}>Editar</Button>
                      <Button 
                        size="xs" 
                        variant="light" 
                        color={f.active ? 'red' : 'green'}
                        onClick={() => handleToggleFilterStatus(f._id, !f.active)}
                      >
                        {f.active ? 'Desactivar' : 'Activar'}
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Modal opened={opened} onClose={() => {
            setNewFilter({ label: '', value: '', imageUrl: '', lora: '', prompt: '', lora_strength: 0.8, denoise: 0.6, frameUrl: '', referenceImageUrl1: '', referenceImageUrl2: '' });
            close();
          }} title={newFilter._id ? "Editar Filtro" : "Añadir Nuevo Filtro"}>
            <TextInput label="Label (Ej: Estilo Acuarela)" value={newFilter.label} onChange={e => setNewFilter({...newFilter, label: e.currentTarget.value})} mb="sm" />
            <Textarea
              label="Descripción corta (se muestra al cliente bajo el nombre)"
              placeholder="Ej: Colores vivos inspirados en los murales de la Comuna 13"
              autosize
              minRows={2}
              value={newFilter.description}
              onChange={e => setNewFilter({...newFilter, description: e.currentTarget.value})}
              mb="sm"
            />
            <TextInput label="Valor API (Para UI)" value={newFilter.value} onChange={e => setNewFilter({...newFilter, value: e.currentTarget.value})} mb="sm" />
            <TextInput label="URL de Imagen (Ejemplo Visual)" value={newFilter.imageUrl} onChange={e => setNewFilter({...newFilter, imageUrl: e.currentTarget.value})} mb="sm" />
            
            <Text fw={500} mt="md" mb="xs">Parámetros de IA (Generación)</Text>
            <TextInput label="Nombre del LoRA" value={newFilter.lora} onChange={e => setNewFilter({...newFilter, lora: e.currentTarget.value})} mb="sm" required />
            <TextInput label="Prompt" value={newFilter.prompt} onChange={e => setNewFilter({...newFilter, prompt: e.currentTarget.value})} mb="sm" required />
            <TextInput type="number" step="0.1" label="Fuerza del LoRA (0.0 a 1.0)" value={newFilter.lora_strength} onChange={e => setNewFilter({...newFilter, lora_strength: Number(e.currentTarget.value)})} mb="sm" />
            <TextInput type="number" step="0.1" label="Denoise (0.0 a 1.0)" value={newFilter.denoise} onChange={e => setNewFilter({...newFilter, denoise: Number(e.currentTarget.value)})} mb="md" />

            <Text fw={500} mt="md" mb="xs">Alternativa con Gemini (si falla la API principal)</Text>
            <Text size="xs" c="dimmed" mb="sm">Imágenes de referencia del estilo de arte. Se usan junto con la foto de la persona para que Gemini genere una imagen siguiendo ese arte.</Text>
            <TextInput
              label="Imagen de Referencia 1"
              placeholder="URL o subir archivo..."
              value={newFilter.referenceImageUrl1}
              onChange={e => setNewFilter({...newFilter, referenceImageUrl1: e.currentTarget.value})}
              mb="sm"
              rightSection={
                <FileButton onChange={(f) => handleUploadFile(f, (url) => setNewFilter({...newFilter, referenceImageUrl1: url}))} accept="image/*">
                  {(props) => <ActionIcon {...props} variant="light" color="blue"><IconUpload size={16}/></ActionIcon>}
                </FileButton>
              }
            />
            <TextInput
              label="Imagen de Referencia 2"
              placeholder="URL o subir archivo..."
              value={newFilter.referenceImageUrl2}
              onChange={e => setNewFilter({...newFilter, referenceImageUrl2: e.currentTarget.value})}
              mb="md"
              rightSection={
                <FileButton onChange={(f) => handleUploadFile(f, (url) => setNewFilter({...newFilter, referenceImageUrl2: url}))} accept="image/*">
                  {(props) => <ActionIcon {...props} variant="light" color="blue"><IconUpload size={16}/></ActionIcon>}
                </FileButton>
              }
            />

            <Text fw={500} mt="md" mb="xs">Visualización en Pantalla Gigante</Text>
            <Text size="xs" c="dimmed" mb="xs">
              El efecto de revelado y la transición de entrada/salida ahora se configuran de forma global
              en la pestaña Pantalla → "Efecto de Revelado de Proyección" (aplica con o sin filtros activos).
            </Text>
            <TextInput
              label="Marco Decorativo (PNG con transparencia)"
              placeholder="URL o subir archivo..." 
              value={newFilter.frameUrl} 
              onChange={e => setNewFilter({...newFilter, frameUrl: e.currentTarget.value})}
              mb="md"
              rightSection={
                <FileButton onChange={(f) => handleUploadFile(f, (url) => setNewFilter({...newFilter, frameUrl: url}))} accept="image/png">
                  {(props) => <ActionIcon {...props} variant="light" color="blue"><IconUpload size={16}/></ActionIcon>}
                </FileButton>
              }
            />

            <Button fullWidth onClick={handleAddFilter}>Guardar Filtro</Button>
          </Modal>
        </Tabs.Panel>

        <Tabs.Panel value="plans">
          <Box mb="xl" p="md" style={{ border: '1px solid #eee', borderRadius: '8px', maxWidth: '600px' }}>
            <Title order={4} mb="sm">Configuración del Servicio</Title>
            <Switch
              label="Usar filtros de IA en las reservas"
              description="Si se desactiva, los clientes no verán el paso de selección de estilo y la foto se proyectará sin estilizar."
              checked={planFiltersEnabled}
              onChange={(e) => setPlanFiltersEnabled(e.currentTarget.checked)}
              mb="lg"
            />
            <MultiSelect
              label="Filtros habilitados para los clientes"
              description="Deja vacío para permitir todos los filtros activos de la pestaña 'Gestión de Filtros'"
              placeholder={planFiltersEnabled ? "Todos los filtros activos (opcional restringir)" : "Filtros desactivados"}
              data={filters.map(f => ({ value: f._id, label: f.label }))}
              value={planAllowedFilterIds}
              onChange={setPlanAllowedFilterIds}
              disabled={!planFiltersEnabled}
              searchable
              clearable
              mb="lg"
            />
            <NumberInput
              label="Valor del servicio (COP)"
              description="Precio cobrado por cada reserva en el flujo de pago en línea (Wompi / DLocal Go)"
              value={planPrice}
              onChange={(val) => setPlanPrice(val === '' ? '' : Number(val))}
              min={0}
              step={1000}
              thousandSeparator="."
              decimalSeparator=","
              mb="lg"
            />
            <Button onClick={handleUpdatePlanSettings} color="blue">Guardar Plan de Uso</Button>
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="policies">
          <Box mb="xl" p="md" style={{ border: '1px solid #eee', borderRadius: '8px', maxWidth: '600px' }}>
            <Title order={4} mb="sm">Sistema de Reservas</Title>
            <Radio.Group
              name="bookingSystem"
              label="Modalidad de gestión de turnos"
              description="Define si los clientes seleccionarán una franja de horario específica al reservar, o si entrarán automáticamente a una cola por orden de llegada."
              value={bookingSystemType}
              onChange={setBookingSystemType}
              mb="xl"
            >
              <Group mt="xs" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                <Radio value="slots" label="Sistema de Franjas (Slots de horario manual)" />
                <Radio value="queue" label="Sistema de Cola Automática (Por orden de llegada / Pago)" />
                <Radio value="franjas" label="Franja Inmediata con Cupo (Asigna la franja actual tras el pago; si está llena, el cliente elige otra)" />
              </Group>
            </Radio.Group>
            <Title order={4} mb="sm">Pasarela de Pagos</Title>
            <Radio.Group
              name="paymentGateway"
              label="Pasarela activa para cobros web"
              description="Selecciona la pasarela con la que procesarás los pagos desde la página de reservas."
              value={paymentGateway}
              onChange={setPaymentGateway}
              mb="xl"
            >
              <Group mt="xs" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                <Radio value="wompi" label="Wompi" />
                <Radio value="dlocalgo" label="DLocal Go" />
              </Group>
            </Radio.Group>
            <Button onClick={handleUpdateScheduleSettings} color="blue">Guardar Políticas</Button>
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="schedules">
          <Box mb="xl" p="md" style={{ border: '1px solid #eee', borderRadius: '8px' }}>
            <Title order={4} mb="sm">Configuración General de Asignación</Title>
            <Grid align="flex-end">
              <Grid.Col span={{ base: 12, md: 4 }}>
                <NumberInput
                  label="Tiempo asignado por usuario (Minutos)"
                  description={
                    `Intervalo exacto de tiempo asignado para cada proyección. Admite segundos como decimales de minuto (ej. 0.5 = 30s)` +
                    (typeof slotDuration === 'number' && slotDuration > 0 ? ` — equivale a ${Math.round(slotDuration * 60)}s` : '')
                  }
                  value={slotDuration}
                  onChange={(val) => setSlotDuration(val === '' ? '' : Number(val))}
                  min={1 / 60}
                  max={60}
                  step={0.5}
                  decimalScale={2}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <NumberInput
                  label="Duración de la franja (Minutos)"
                  description={`Solo para "Franja Inmediata con Cupo". Capacidad resultante: ${Math.max(1, Math.floor((Number(franjaDuration) || 1) / (Number(slotDuration) || 1)))} personas por franja`}
                  value={franjaDuration}
                  onChange={(val) => setFranjaDuration(val === '' ? '' : Number(val))}
                  min={2}
                  max={120}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Button onClick={handleUpdateScheduleSettings}>Guardar Ajuste</Button>
              </Grid.Col>
            </Grid>
          </Box>

          <Group justify="space-between" mb="sm" mt="md">
            <Text fw={500}>Plantillas de Horarios</Text>
            <Group>
              <Button onClick={() => { setNewTemplate({ name: '', slots: [], deadTimes: [] }); openTemplateModal(); }}>+ Nueva Plantilla</Button>
              <Button onClick={openApplyModal} color="teal">Aplicar Plantilla a Fechas</Button>
            </Group>
          </Group>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nombre</Table.Th>
                <Table.Th>Franjas (Slots)</Table.Th>
                <Table.Th>Descansos (Dead Times)</Table.Th>
                <Table.Th>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {templates.map((t) => (
                <Table.Tr key={t.id}>
                  <Table.Td>{t.name}</Table.Td>
                  <Table.Td>{t.slots?.map((s: any) => `${s.startTime}-${s.endTime}`).join(', ') || 'Ninguno'}</Table.Td>
                  <Table.Td>{t.deadTimes?.map((d: any) => `${d.startTime}-${d.endTime}`).join(', ') || 'Ninguno'}</Table.Td>
                  <Table.Td>
                    <Button size="xs" color="blue" variant="subtle" onClick={() => handleEditTemplate(t)}>Editar</Button>
                    <Button size="xs" color="red" variant="subtle" onClick={() => handleDeleteTemplate(t.id)}>Eliminar</Button>
                  </Table.Td>
                </Table.Tr>
              ))}
              {templates.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={4} ta="center" c="dimmed">No hay plantillas creadas</Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>

          <Modal opened={templateModalOpened} onClose={closeTemplateModal} title={newTemplate.id ? "Editar Plantilla" : "Crear Plantilla"} size="lg">
            <TextInput label="Nombre de la Plantilla" placeholder="Ej: Fin de semana" value={newTemplate.name} onChange={(e) => setNewTemplate({...newTemplate, name: e.currentTarget.value})} mb="sm" required />
            
            <Box mt="md" p="sm" style={{ backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <Text fw={500} size="sm" mb="xs">Generación Automática de Franjas</Text>
              <Group grow align="flex-end">
                <TextInput type="time" label="Hora Inicial" value={autoSlotStart} onChange={(e) => setAutoSlotStart(e.currentTarget.value)} />
                <TextInput type="time" label="Hora Final" value={autoSlotEnd} onChange={(e) => setAutoSlotEnd(e.currentTarget.value)} />
                <Select label="Intervalo" data={[{value: '15', label: '15 min'}, {value: '30', label: '30 min'}, {value: '60', label: '1 hora'}]} value={autoSlotInterval} onChange={setAutoSlotInterval} />
                <Button variant="light" color="blue" onClick={handleAutoGenerateSlots}>Generar</Button>
              </Group>
            </Box>

            <Text fw={500} size="sm" mt="md" mb="xs">Franjas de Atención (Slots)</Text>
            <Text size="xs" c="dimmed" mb="sm">Ejemplo: 20:00 a 21:00, 21:00 a 22:00.</Text>
            {newTemplate.slots.map((s: any, idx: number) => (
              <Group key={idx} mb="xs">
                <TextInput type="time" value={s.startTime} onChange={(e) => {
                  const arr = [...newTemplate.slots];
                  arr[idx].startTime = e.currentTarget.value;
                  setNewTemplate({...newTemplate, slots: arr});
                }} />
                <Text>-</Text>
                <TextInput type="time" value={s.endTime} onChange={(e) => {
                  const arr = [...newTemplate.slots];
                  arr[idx].endTime = e.currentTarget.value;
                  setNewTemplate({...newTemplate, slots: arr});
                }} />
                <Button size="xs" color="red" variant="subtle" onClick={() => {
                  const arr = [...newTemplate.slots];
                  arr.splice(idx, 1);
                  setNewTemplate({...newTemplate, slots: arr});
                }}>X</Button>
              </Group>
            ))}
            <Button size="xs" variant="light" mb="md" onClick={() => setNewTemplate({...newTemplate, slots: [...newTemplate.slots, { startTime: '', endTime: '' }]})}>+ Añadir Franja</Button>

            <Text fw={500} size="sm" mt="md" mb="xs">Descansos (Tiempos Muertos)</Text>
            {newTemplate.deadTimes.map((d: any, idx: number) => (
              <Group key={idx} mb="xs">
                <TextInput type="time" value={d.startTime} onChange={(e) => {
                  const arr = [...newTemplate.deadTimes];
                  arr[idx].startTime = e.currentTarget.value;
                  setNewTemplate({...newTemplate, deadTimes: arr});
                }} />
                <Text>-</Text>
                <TextInput type="time" value={d.endTime} onChange={(e) => {
                  const arr = [...newTemplate.deadTimes];
                  arr[idx].endTime = e.currentTarget.value;
                  setNewTemplate({...newTemplate, deadTimes: arr});
                }} />
                <Button size="xs" color="red" variant="subtle" onClick={() => {
                  const arr = [...newTemplate.deadTimes];
                  arr.splice(idx, 1);
                  setNewTemplate({...newTemplate, deadTimes: arr});
                }}>X</Button>
              </Group>
            ))}
            <Button size="xs" variant="light" mb="md" color="orange" onClick={() => setNewTemplate({...newTemplate, deadTimes: [...newTemplate.deadTimes, { startTime: '', endTime: '' }]})}>+ Añadir Descanso</Button>

            <Button fullWidth mt="md" onClick={handleSaveTemplate}>Guardar Plantilla</Button>
          </Modal>

          <Modal opened={applyModalOpened} onClose={closeApplyModal} title="Aplicar Plantilla a Rango de Fechas">
            <Select 
              label="Selecciona la Plantilla" 
              data={templates.map(t => ({ value: t.id, label: t.name }))}
              value={selectedTemplateToApply}
              onChange={(val) => setSelectedTemplateToApply(val || '')}
              mb="sm"
            />
            <Group grow mb="md">
              <TextInput 
                type="date" 
                label="Fecha Inicial" 
                value={startDateToApply}
                onChange={(e) => setStartDateToApply(e.currentTarget.value)}
              />
              <TextInput 
                type="date" 
                label="Fecha Final" 
                value={endDateToApply}
                onChange={(e) => setEndDateToApply(e.currentTarget.value)}
              />
            </Group>
            <Button fullWidth onClick={handleApplyTemplate} color="teal">Aplicar a estas fechas</Button>
          </Modal>
        </Tabs.Panel>

        <Tabs.Panel value="screen">
          <Box mb="xl" p="md" style={{ border: '1px solid #eee', borderRadius: '8px', position: 'relative' }}>
            {isUploading && (
              <Box style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.7)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader /> <Text ml="sm" fw={500}>Subiendo imagen a Firebase...</Text>
              </Box>
            )}
            <Title order={4} mb="sm">Configuración de Pantalla (En Espera / Carrusel)</Title>
            <Grid mb="sm">
              <Grid.Col span={{ base: 12, md: 4 }}>
                <TextInput
                  label="Fondo Global (Opcional)"
                  description="Si se deja vacía, la pantalla no muestra fondo personalizado."
                  placeholder="URL o subir archivo..."
                  value={screenBgUrl}
                  onChange={e => setScreenBgUrl(e.currentTarget.value)}
                  rightSectionWidth={screenBgUrl ? 68 : 36}
                  rightSection={
                    <Group gap={4} wrap="nowrap">
                      {screenBgUrl && (
                        <CloseButton size="sm" title="Quitar imagen de fondo" onClick={() => setScreenBgUrl('')} />
                      )}
                      <FileButton onChange={(f) => handleScreenAssetSelect(f, { setUrlCallback: setScreenBgUrl })} accept="image/*,video/*">
                        {(props) => <ActionIcon {...props} variant="light" color="blue"><IconUpload size={16}/></ActionIcon>}
                      </FileButton>
                    </Group>
                  }
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <TextInput
                  label="Imagen Header (Arriba)"
                  description="Si se deja vacía, la pantalla no muestra header."
                  placeholder="URL o subir archivo..."
                  value={headerUrl}
                  onChange={e => setHeaderUrl(e.currentTarget.value)}
                  rightSectionWidth={headerUrl ? 68 : 36}
                  rightSection={
                    <Group gap={4} wrap="nowrap">
                      {headerUrl && (
                        <CloseButton size="sm" title="Quitar imagen header" onClick={() => setHeaderUrl('')} />
                      )}
                      <FileButton onChange={(f) => handleScreenAssetSelect(f, { setUrlCallback: setHeaderUrl })} accept="image/*">
                        {(props) => <ActionIcon {...props} variant="light" color="blue"><IconUpload size={16}/></ActionIcon>}
                      </FileButton>
                    </Group>
                  }
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <TextInput
                  label="Imagen Footer (Abajo)"
                  description="Si se deja vacía, la pantalla no muestra footer."
                  placeholder="URL o subir archivo..."
                  value={footerUrl}
                  onChange={e => setFooterUrl(e.currentTarget.value)}
                  rightSectionWidth={footerUrl ? 68 : 36}
                  rightSection={
                    <Group gap={4} wrap="nowrap">
                      {footerUrl && (
                        <CloseButton size="sm" title="Quitar imagen footer" onClick={() => setFooterUrl('')} />
                      )}
                      <FileButton onChange={(f) => handleScreenAssetSelect(f, { setUrlCallback: setFooterUrl })} accept="image/*">
                        {(props) => <ActionIcon {...props} variant="light" color="blue"><IconUpload size={16}/></ActionIcon>}
                      </FileButton>
                    </Group>
                  }
                />
              </Grid.Col>
            </Grid>

            <Grid mb="xl" mt="md">
              <Grid.Col span={{ base: 12, md: 3 }}>
                <NumberInput
                  label="Duración Proyección Foto (seg)"
                  value={projectionDuration}
                  onChange={(val) => setProjectionDuration(val === '' ? '' : Number(val))}
                  min={5}
                  max={300}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 3 }}>
                <NumberInput
                  label="Duración Proyección Video (seg)"
                  description="Si el video dura más, se corta a este tiempo"
                  value={videoProjectionDuration}
                  onChange={(val) => setVideoProjectionDuration(val === '' ? '' : Number(val))}
                  min={5}
                  max={300}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 3 }}>
                <TextInput
                  type="time" step={1}
                  label="Hora Global Inicio Parrilla"
                  value={globalGridStartTime}
                  onChange={(e) => setGlobalGridStartTime(e.currentTarget.value)}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 3 }}>
                <TextInput
                  type="time" step={1}
                  label="Hora Global Fin Parrilla"
                  value={globalGridEndTime}
                  onChange={(e) => setGlobalGridEndTime(e.currentTarget.value)}
                />
              </Grid.Col>
            </Grid>

            <Grid mb="xl">
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Text size="sm" fw={500} mb={2}>Proporción de Recorte (Foto/Video del cliente)</Text>
                <Text size="xs" c="dimmed" mb="xs">Debe coincidir con la proporción real de la pantalla/proyector. Se usa para recortar la foto del cliente (incluida la que se envía a la IA), su video, y las imágenes/videos que subas aquí para fondo/header/footer.</Text>
                <Group gap="xs" wrap="nowrap">
                  <NumberInput
                    label="Ancho (px)"
                    value={cropWidth}
                    onChange={(val) => setCropWidth(val === '' ? '' : Number(val))}
                    min={64}
                    max={4000}
                    style={{ flex: 1 }}
                  />
                  <Text mt={24}>×</Text>
                  <NumberInput
                    label="Alto (px)"
                    value={cropHeight}
                    onChange={(val) => setCropHeight(val === '' ? '' : Number(val))}
                    min={64}
                    max={4000}
                    style={{ flex: 1 }}
                  />
                </Group>
              </Grid.Col>
            </Grid>

            <Box mb="xl" pt="md" style={{ borderTop: '1px solid #eee' }}>
              <Title order={5} mb={2}>Efecto de Revelado de Proyección</Title>
              <Text size="xs" c="dimmed" mb="sm">
                Cómo se revela la foto/video de cada cliente al proyectarse — global, aplica con o sin filtros activos.
              </Text>
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Select
                    label="Efecto de Revelado"
                    value={revealEffect}
                    onChange={(val) => setRevealEffect(val || 'spray')}
                    data={[
                      { value: 'spray', label: 'Spray 3D (lata pintando)' },
                      { value: 'fade', label: 'Fade simple + marco' },
                      { value: 'video-overlay', label: 'Overlay de Video (se desvanece al final)' },
                    ]}
                    mb="sm"
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Select
                    label="Entrada/Salida del Contenedor"
                    value={containerTransition}
                    onChange={(val) => setContainerTransition(val || 'fade')}
                    data={[
                      { value: 'fade', label: 'Desvanecimiento (Fade)' },
                      { value: 'slide-up', label: 'Deslizar hacia arriba' },
                      { value: 'slide-down', label: 'Deslizar hacia abajo' },
                      { value: 'slide-right', label: 'Deslizar a la derecha' },
                      { value: 'slide-left', label: 'Deslizar a la izquierda' },
                      { value: 'particles', label: 'Partículas' },
                    ]}
                    mb="sm"
                  />
                </Grid.Col>
              </Grid>
              {revealEffect === 'video-overlay' && (
                <Grid>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <TextInput
                      label="Video Overlay"
                      description="Se reproduce encima de la foto/video real y se desvanece en los últimos segundos configurados."
                      placeholder="URL o subir archivo..."
                      value={revealOverlayVideoUrl}
                      onChange={(e) => setRevealOverlayVideoUrl(e.currentTarget.value)}
                      rightSectionWidth={revealOverlayVideoUrl ? 68 : 36}
                      rightSection={
                        <Group gap={4} wrap="nowrap">
                          {revealOverlayVideoUrl && (
                            <CloseButton size="sm" title="Quitar video overlay" onClick={() => setRevealOverlayVideoUrl('')} />
                          )}
                          <FileButton onChange={(f) => handleScreenAssetSelect(f, { setUrlCallback: setRevealOverlayVideoUrl })} accept="video/*">
                            {(props) => <ActionIcon {...props} variant="light" color="blue"><IconUpload size={16} /></ActionIcon>}
                          </FileButton>
                        </Group>
                      }
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <NumberInput
                      label="Duración del Fade (segundos)"
                      description="En los últimos N segundos del video overlay, se desvanece revelando lo real"
                      value={revealOverlayFadeSeconds}
                      onChange={(val) => setRevealOverlayFadeSeconds(val === '' ? '' : Number(val))}
                      min={0.5}
                      max={15}
                      step={0.5}
                    />
                  </Grid.Col>
                </Grid>
              )}
            </Box>

            <Box mb="xl" pt="md" style={{ borderTop: '1px solid #eee' }}>
              <Title order={5} mb={2}>Marco para el Correo</Title>
              <Text size="xs" c="dimmed" mb="sm">
                PNG con transparencia que se compone SOLO sobre la foto que se envía por correo al cliente
                (no aplica a la proyección en pantalla ni a video). Se ajusta automáticamente al tamaño de la foto.
              </Text>
              <TextInput
                label="Marco del Correo"
                placeholder="URL o subir archivo..."
                value={emailFrameUrl}
                onChange={(e) => setEmailFrameUrl(e.currentTarget.value)}
                maw={420}
                rightSectionWidth={emailFrameUrl ? 68 : 36}
                rightSection={
                  <Group gap={4} wrap="nowrap">
                    {emailFrameUrl && (
                      <CloseButton size="sm" title="Quitar marco del correo" onClick={() => setEmailFrameUrl('')} />
                    )}
                    <FileButton onChange={(f) => handleUploadFile(f, setEmailFrameUrl)} accept="image/png">
                      {(props) => <ActionIcon {...props} variant="light" color="blue"><IconUpload size={16} /></ActionIcon>}
                    </FileButton>
                  </Group>
                }
              />
            </Box>

            <Group align="flex-end" justify="space-between" mt="md">
              <Button color="teal" onClick={() => handleUpdateSettings()}>Guardar Configuración de Standby</Button>
              <Button color="red" variant="light" onClick={handleClearScreen}>Forzar Limpieza de Pantalla (Quitar proyección actual)</Button>
            </Group>

            <Box mt="xl" pt="xl" style={{ borderTop: '1px solid #eee' }}>
              <Title order={4} mb="sm">Parrilla de Contenidos Programados (Ads/Promos)</Title>
              <Text c="dimmed" size="sm" mb="sm">
                Las imágenes de esta parrilla sobrescribirán el carrusel normal si la hora actual coincide y están activas. 
                Si varias coinciden, rotarán únicamente las que tengan la prioridad más alta.
              </Text>
              <Group mb="sm">
                <Button onClick={() => {
                  setNewGridItem({ 
                    name: '', url: '', type: 'image', duration: 10, priority: 1, active: true,
                    targetAppearances: 100, currentAppearances: 0, cooldownPeriod: 30, noConsecutive: true, exclusionWindows: []
                  });
                  openGridModal();
                }} variant="light" color="blue">+ Añadir a la Parrilla</Button>
              </Group>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nombre</Table.Th>
                    <Table.Th>Miniatura</Table.Th>
                    <Table.Th>Tipo</Table.Th>
                    <Table.Th>Apariciones</Table.Th>
                    <Table.Th>Prioridad</Table.Th>
                    <Table.Th>Intervalo</Table.Th>
                    <Table.Th>Estado</Table.Th>
                    <Table.Th>Acciones</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {contentGrid.map((item, idx) => (
                    <Table.Tr key={idx}>
                      <Table.Td>{item.name}</Table.Td>
                      <Table.Td>
                        {item.type === 'video' ? (
                          <video src={item.url} style={{width: 40, height: 40, objectFit: 'cover'}} muted />
                        ) : (
                          <Image src={item.url} w={40} h={40} radius="sm" style={{objectFit: 'cover'}}/>
                        )}
                      </Table.Td>
                      <Table.Td><Badge color={item.type === 'video' ? 'red' : 'blue'}>{item.type}</Badge></Table.Td>
                      <Table.Td>{item.currentAppearances || 0} / {item.targetAppearances}</Table.Td>
                      <Table.Td>{item.priority}</Table.Td>
                      <Table.Td>{item.cooldownPeriod} min</Table.Td>
                      <Table.Td><Badge color={item.active ? 'green' : 'gray'}>{item.active ? 'Activo' : 'Inactivo'}</Badge></Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Button size="xs" color="blue" variant="subtle" onClick={() => {
                            setNewGridItem(item);
                            openGridModal();
                          }}>Editar</Button>
                          <Button size="xs" color="red" variant="subtle" onClick={() => {
                            const grid = [...contentGrid];
                            grid.splice(idx, 1);
                            setContentGrid(grid);
                            handleUpdateSettings(grid); // Guardar automáticamente al eliminar
                          }}>Eliminar</Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {contentGrid.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={6} ta="center" c="dimmed">No hay contenidos en la parrilla</Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Box>

            <Box mt="xl" pt="xl" style={{ borderTop: '1px solid #eee' }}>
              <Title order={4} mb="sm">Pantalla de Reposo (Salvapantallas por Inactividad)</Title>
              <Text c="dimmed" size="sm" mb="sm">
                Independiente de la Parrilla de arriba. Solo se activa cuando la pantalla lleva el tiempo configurado
                SIN proyecciones y SIN reservas pendientes por proyectar — mientras eso no pase, la Parrilla y la
                tarjeta de bienvenida siguen funcionando exactamente igual que hoy.
              </Text>
              <Group align="flex-end" mb="md">
                <NumberInput
                  label="Activar tras (minutos de inactividad)"
                  description={
                    `0 desactiva la pantalla de reposo. Admite segundos como decimales de minuto (ej. 0.5 = 30s)` +
                    (typeof restScreenIdleMinutes === 'number' && restScreenIdleMinutes > 0 ? ` — equivale a ${Math.round(restScreenIdleMinutes * 60)}s` : '')
                  }
                  value={restScreenIdleMinutes}
                  onChange={(val) => setRestScreenIdleMinutes(val === '' ? '' : Number(val))}
                  min={0}
                  max={180}
                  step={0.5}
                  decimalScale={2}
                  maw={280}
                />
                <Button color="teal" onClick={() => handleUpdateSettings()}>Guardar Minutos de Inactividad</Button>
              </Group>
              <Group mb="sm">
                <Button onClick={() => {
                  setNewRestItem({ name: '', url: '', type: 'image', duration: 10 });
                  openRestItemModal();
                }} variant="light" color="grape">+ Añadir a Pantalla de Reposo</Button>
              </Group>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nombre</Table.Th>
                    <Table.Th>Miniatura</Table.Th>
                    <Table.Th>Tipo</Table.Th>
                    <Table.Th>Duración</Table.Th>
                    <Table.Th>Acciones</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {restScreenItems.map((item, idx) => (
                    <Table.Tr key={idx}>
                      <Table.Td>{item.name}</Table.Td>
                      <Table.Td>
                        {item.type === 'video' ? (
                          <video src={item.url} style={{ width: 40, height: 40, objectFit: 'cover' }} muted />
                        ) : (
                          <Image src={item.url} w={40} h={40} radius="sm" style={{ objectFit: 'cover' }} />
                        )}
                      </Table.Td>
                      <Table.Td><Badge color={item.type === 'video' ? 'red' : 'blue'}>{item.type}</Badge></Table.Td>
                      <Table.Td>{item.duration}s</Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Button size="xs" color="blue" variant="subtle" onClick={() => {
                            setNewRestItem(item);
                            openRestItemModal();
                          }}>Editar</Button>
                          <Button size="xs" color="red" variant="subtle" onClick={() => {
                            const items = [...restScreenItems];
                            items.splice(idx, 1);
                            setRestScreenItems(items);
                            handleUpdateSettings(undefined, items); // Guardar automáticamente al eliminar
                          }}>Eliminar</Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {restScreenItems.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={5} ta="center" c="dimmed">No hay contenidos en la pantalla de reposo</Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Box>

            <Modal opened={restItemModalOpened} size="lg" onClose={() => {
              setNewRestItem({ name: '', url: '', type: 'image', duration: 10 });
              closeRestItemModal();
            }} title={(newRestItem as any).id ? 'Editar Contenido de Reposo' : 'Añadir Contenido a Pantalla de Reposo'}>
              <TextInput label="Nombre Descriptivo" placeholder="Ej. Promo Coca-Cola" value={newRestItem.name} onChange={(e) => setNewRestItem({ ...newRestItem, name: e.currentTarget.value })} mb="sm" required />

              <TextInput
                label="URL del Archivo"
                placeholder="Subir imagen o video..."
                value={newRestItem.url}
                onChange={(e) => setNewRestItem({ ...newRestItem, url: e.currentTarget.value })}
                mb="sm"
                required
                rightSection={
                  <FileButton onChange={(f) => handleScreenAssetSelect(f, {
                    setUrlCallback: (url) => setNewRestItem((prev: any) => ({ ...prev, url })),
                    setTypeCallback: (type) => setNewRestItem((prev: any) => ({ ...prev, type })),
                    setDurationCallback: (duration) => setNewRestItem((prev: any) => ({ ...prev, duration })),
                    setTrimCallback: (trimStart, trimEnd) => setNewRestItem((prev: any) => ({ ...prev, trimStart, trimEnd })),
                  })} accept="image/*,video/*">
                    {(props) => <ActionIcon {...props} variant="light" color="blue"><IconUpload size={16} /></ActionIcon>}
                  </FileButton>
                }
              />

              {newRestItem.type === 'video' ? (
                <NumberInput label="Duración detectada (Segundos)" value={newRestItem.duration} disabled mb="sm" />
              ) : (
                <NumberInput label="Duración en pantalla (Segundos)" value={newRestItem.duration} onChange={(val) => setNewRestItem({ ...newRestItem, duration: Number(val) || 10 })} mb="sm" />
              )}

              <Button fullWidth onClick={() => {
                if (!newRestItem.name || !newRestItem.url) return alert('Completa nombre y url');

                let updatedItems;
                if ((newRestItem as any).id) {
                  updatedItems = restScreenItems.map(item => item.id === (newRestItem as any).id ? newRestItem : item);
                } else {
                  updatedItems = [...restScreenItems, { ...newRestItem, id: Date.now().toString() }];
                }

                setRestScreenItems(updatedItems);
                handleUpdateSettings(undefined, updatedItems); // Guardar automáticamente

                setNewRestItem({ name: '', url: '', type: 'image', duration: 10 });
                closeRestItemModal();
              }}>
                {(newRestItem as any).id ? 'Guardar Cambios' : 'Añadir a Pantalla de Reposo'}
              </Button>
            </Modal>

            <Modal opened={gridModalOpened} size="lg" onClose={() => {
              setNewGridItem({ 
                name: '', url: '', type: 'image', duration: 10, priority: 1, active: true,
                targetAppearances: 100, currentAppearances: 0, cooldownPeriod: 30, noConsecutive: true, exclusionWindows: []
              });
              closeGridModal();
            }} title={(newGridItem as any).id ? "Editar Contenido de Parrilla" : "Añadir Contenido a la Parrilla"}>
              <TextInput label="Nombre Descriptivo" placeholder="Ej. Promo Coca-Cola" value={newGridItem.name} onChange={(e) => setNewGridItem({...newGridItem, name: e.currentTarget.value})} mb="sm" required />
              
              <Group grow mb="sm">
                <Select 
                  label="Tipo de Contenido" 
                  data={[{value: 'image', label: 'Imagen'}, {value: 'video', label: 'Video'}]}
                  value={newGridItem.type}
                  onChange={(val) => setNewGridItem({...newGridItem, type: val || 'image'})}
                />
                <NumberInput label="Prioridad" description="En choque, gana la mayor" value={newGridItem.priority} onChange={(val) => setNewGridItem({...newGridItem, priority: Number(val)})} />
              </Group>

              <TextInput 
                label="URL del Archivo" 
                placeholder="Subir imagen o video..."
                value={newGridItem.url} 
                onChange={(e) => setNewGridItem({...newGridItem, url: e.currentTarget.value})} 
                mb="sm"
                required
                rightSection={
                  <FileButton onChange={(f) => handleScreenAssetSelect(f, {
                    setUrlCallback: (url) => setNewGridItem((prev: any) => ({...prev, url})),
                    setTypeCallback: (type) => setNewGridItem((prev: any) => ({...prev, type})),
                    setDurationCallback: (duration) => setNewGridItem((prev: any) => ({...prev, duration})),
                    setTrimCallback: (trimStart, trimEnd) => setNewGridItem((prev: any) => ({...prev, trimStart, trimEnd})),
                  })} accept="image/*,video/*">
                    {(props) => <ActionIcon {...props} variant="light" color="blue"><IconUpload size={16}/></ActionIcon>}
                  </FileButton>
                }
              />

              {newGridItem.type === 'video' ? (
                <NumberInput 
                  label="Duración detectada (Segundos)" 
                  value={newGridItem.duration} 
                  disabled
                  mb="sm" 
                />
              ) : (
                <NumberInput 
                  label="Duración en pantalla (Segundos)" 
                  value={newGridItem.duration} 
                  onChange={(val) => setNewGridItem({...newGridItem, duration: Number(val) || 10})} 
                  mb="sm" 
                />
              )}

              <Grid mb="sm">
                <Grid.Col span={6}>
                  <NumberInput label="Meta de Apariciones" value={newGridItem.targetAppearances} onChange={(val) => setNewGridItem({...newGridItem, targetAppearances: Number(val)})} />
                </Grid.Col>
                <Grid.Col span={6}>
                  <NumberInput label="Intervalo (minutos)" description="Tiempo mínimo entre apariciones" value={newGridItem.cooldownPeriod} onChange={(val) => setNewGridItem({...newGridItem, cooldownPeriod: Number(val)})} />
                </Grid.Col>
                <Grid.Col span={12}>
                  <Select 
                    label="Efecto de Transición (Entrada/Salida)"
                    value={newGridItem.transition}
                    onChange={(val) => setNewGridItem({...newGridItem, transition: val || 'fade'})}
                    data={[
                      { value: 'fade', label: 'Desvanecimiento Suave (Fade)' },
                      { value: 'slide-left', label: 'Deslizar a la Izquierda' },
                      { value: 'slide-right', label: 'Deslizar a la Derecha' },
                      { value: 'slide-up', label: 'Deslizar hacia Arriba' },
                      { value: 'slide-down', label: 'Deslizar hacia Abajo' },
                      { value: 'particles', label: 'Partículas / Fragmentación' }
                    ]}
                  />
                </Grid.Col>
              </Grid>

              <Text size="sm" fw={500} mt="md" mb="xs">Tiempos de Exclusión (No mostrar en estos horarios)</Text>
              {newGridItem.exclusionWindows?.map((window: any, wIdx: number) => (
                <Group key={wIdx} mb="xs" align="flex-end">
                  <TextInput type="time" step={1} label="Hora Inicio" value={window.start} onChange={(e) => {
                    const newExclusions = [...newGridItem.exclusionWindows];
                    newExclusions[wIdx].start = e.currentTarget.value;
                    setNewGridItem({...newGridItem, exclusionWindows: newExclusions});
                  }} />
                  <TextInput type="time" step={1} label="Hora Fin" value={window.end} onChange={(e) => {
                    const newExclusions = [...newGridItem.exclusionWindows];
                    newExclusions[wIdx].end = e.currentTarget.value;
                    setNewGridItem({...newGridItem, exclusionWindows: newExclusions});
                  }} />
                  <Button color="red" variant="subtle" onClick={() => {
                    const newExclusions = [...newGridItem.exclusionWindows];
                    newExclusions.splice(wIdx, 1);
                    setNewGridItem({...newGridItem, exclusionWindows: newExclusions});
                  }}>X</Button>
                </Group>
              ))}
              <Button size="xs" variant="light" mb="md" onClick={() => {
                setNewGridItem({...newGridItem, exclusionWindows: [...(newGridItem.exclusionWindows || []), {start: '12:00:00', end: '13:00:00'}]});
              }}>+ Añadir Exclusión</Button>

              <Button fullWidth onClick={() => {
                if(!newGridItem.name || !newGridItem.url) return alert('Completa nombre y url');
                
                let updatedGrid;
                if ((newGridItem as any).id) {
                  // Edit
                  updatedGrid = contentGrid.map(item => item.id === (newGridItem as any).id ? newGridItem : item);
                } else {
                  // Add
                  updatedGrid = [...contentGrid, {...newGridItem, id: Date.now().toString()}];
                }
                
                setContentGrid(updatedGrid);
                handleUpdateSettings(updatedGrid); // Guardar automáticamente
                
                setNewGridItem({ 
                  name: '', url: '', type: 'image', duration: 10, priority: 1, active: true,
                  targetAppearances: 100, currentAppearances: 0, cooldownPeriod: 30, noConsecutive: true, exclusionWindows: []
                });
                closeGridModal();
              }}>
                {(newGridItem as any).id ? 'Guardar Cambios' : 'Añadir a Parrilla'}
              </Button>
            </Modal>

            <ImageCropModal
              opened={imageCropModalOpened}
              imageSrc={rawImageForCrop}
              aspect={(Number(cropWidth) || DEFAULT_CROP_WIDTH) / (Number(cropHeight) || DEFAULT_CROP_HEIGHT)}
              outputWidth={Number(cropWidth) || DEFAULT_CROP_WIDTH}
              outputHeight={Number(cropHeight) || DEFAULT_CROP_HEIGHT}
              title={`Ajusta el encuadre (proporción de la pantalla: ${Number(cropWidth) || DEFAULT_CROP_WIDTH}×${Number(cropHeight) || DEFAULT_CROP_HEIGHT})`}
              onCancel={handleScreenImageCropCancel}
              onConfirm={handleScreenImageCropConfirm}
            />
            {/* Sin maxSeconds: el contenido de pantalla de reposo/parrilla no
                tiene límite de duración (a diferencia del video del
                photobooth, que sí lo tiene en BookingForm/AssistedBookingForm). */}
            <VideoTrimModal
              opened={videoTrimModalOpened}
              file={rawVideoFile}
              onCancel={handleScreenVideoTrimCancel}
              onConfirm={handleScreenVideoTrimConfirm}
            />

          </Box>

          <Text mb="sm" c="dimmed">Administra qué fotos ya fueron mostradas en la pantalla gigante.</Text>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Usuario</Table.Th>
                <Table.Th>Franja Horaria</Table.Th>
                <Table.Th>Imagen Final</Table.Th>
                <Table.Th>Estado Proyección</Table.Th>
                <Table.Th>Acción</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {bookings.map((b) => (
                <Table.Tr key={b.id}>
                  <Table.Td>{b.name}</Table.Td>
                  <Table.Td>
                    <Badge>{b.timeSlot}</Badge>
                    <br/>
                    <Text size="xs" fw={700} c="dimmed">Exacto: {b.exactTime || 'N/A'}</Text>
                  </Table.Td>
                  <Table.Td>
                    {b.mediaType === 'video' ? (
                      <video src={b.generatedImageUrl || b.imageUrl} muted style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, backgroundColor: '#000' }} />
                    ) : (
                      <Image src={b.generatedImageUrl || b.imageUrl} w={60} radius="md" />
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={b.status === 'SHOWN' ? 'blue' : b.status === 'COMPLETED' ? 'grape' : b.status === 'GENERATED' ? 'teal' : 'orange'}>
                      {b.status === 'SHOWN' ? 'PROYECTADA' : b.status === 'COMPLETED' ? 'FINALIZADA' : b.status === 'GENERATED' ? 'GENERADA' : 'EN COLA'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {(!b.generatedImageUrl && b.status !== 'SHOWN' && b.status !== 'COMPLETED') && (
                        <Button 
                          size="xs" 
                          color="violet" 
                          loading={generatingId === b.id}
                          onClick={() => handleGenerateImage(b.id)}
                        >
                          Generar Imagen
                        </Button>
                      )}
                      
                      {b.status !== 'SHOWN' && b.status !== 'COMPLETED' ? (
                        <Button size="xs" color="blue" leftSection={<IconCheck size={14} />} onClick={() => handleProject(b.id)}>
                          Proyectar
                        </Button>
                      ) : (
                        <Button size="xs" color="gray" variant="light" onClick={() => handleProject(b.id)}>
                          Volver a Proyectar
                        </Button>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>

      </Tabs>
    </Container>
  );
}
