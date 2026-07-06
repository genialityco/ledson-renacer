import React, { createContext, useContext, useState } from 'react';

type Language = 'es' | 'en';

const translations = {
  es: {
    // App
    appTitle: "Led's on Renacer Photobooth",

    // Home
    captureMoment: "Captura el Momento",
    scanQR: "Escanea el código QR con tu teléfono para reservar, tomarte tu foto y aparecer en la pantalla gigante.",
    simulateScan: "Simular Escaneo (Ir al Formulario)",

    // BookingForm
    bookPhotobooth: "Reserva tu Photobooth",
    chooseStyle: "Elegir Estilo",
    selectFilterDesc: "Selecciona el filtro",
    payment: "Pago",
    enterDataPay: "Ingresa datos y paga",
    photo: "Foto",
    takePhotoDesc: "Tómate la foto",
    result: "Resultado",
    yourTurn: "Tu turno",
    step1Title: "1. Selecciona el estilo que deseas para tu proyección",
    noFilters: "No hay filtros activos en este momento.",
    selectFilterAlert: "Selecciona un filtro para continuar",
    nextStep: "Siguiente Paso",
    step2Title: "2. Llena tus datos para realizar el pago",
    fullName: "Nombre completo",
    docId: "ID / Cédula",
    email: "Correo Electrónico",
    whatsapp: "WhatsApp (Celular)",
    country: "Nacionalidad (País)",
    selectCountry: "Selecciona tu país",
    city: "Ciudad",
    selectCity: "Selecciona tu ciudad",
    selectCountryFirst: "Primero selecciona un país",
    bookingDate: "Fecha de reserva",
    timeSlot: "Franja horaria a elegir",
    selectTimeSlot: "Selecciona la hora de proyección",
    habeasDataText1: "Acepto la ",
    habeasDataText2: "política de tratamiento de datos personales (Habeas Data)",
    back: "Volver",
    alreadyPaid: "Ya realicé el pago en D-Local Go",
    payWith: "Pagar con",
    paymentApproved: "¡Pago Aprobado!",
    nowUploadPhoto: "Ahora, sube tu foto o tómate una selfie para la proyección.",
    gallery: "Galería",
    takeSelfie: "Tomar Selfie",
    selectedImage: "Imagen seleccionada:",
    removeImage: "Cambiar imagen",
    magicReady: "Estamos listos para agregar la magia de la comuna 13",
    next: "Siguiente",
    bookingCompleted: "¡Reserva Completada Exitosamente!",
    queueTurn: "Tu turno en la fila es el #",
    assignedTime: "La hora asignada para tu proyección es a las",
    unassigned: "Sin asignar",
    franjaAssigned: "Tu franja de publicación es",
    franjaFullTitle: "Franja actual llena",
    franjaFullMsg: "La franja actual está llena. Por favor selecciona otra franja de publicación:",
    selectFranja: "Selecciona una franja",
    confirmFranjaBtn: "Confirmar franja",
    spotsLabel: "cupos disponibles",
    franjaNowFull: "Esa franja acaba de llenarse. Por favor elige otra.",
    selectFranjaAlert: "Debes seleccionar una franja.",
    assignFranjaError: "Hubo un error asignando la franja. Intenta de nuevo.",
    yourPhotoReady: "Tu foto lista para la magia:",
    searchBookingText: "Busca tu reserva con tu cédula en el portal para ver su estado en tiempo real.",
    goToMyBookings: "Ir a mis reservas",
    paymentProcessing: "Tu pago está procesándose o no fue aprobado",
    dontWorry: "No te preocupes. Accede a nuestro portal a continuación. Si tu pago se aprueba, podrás completar tu reserva o revisar el estado desde allí ingresando tu cédula o email.",
    poseTitle: "Acomoda tu mejor pose",
    capture: "Capturar",
    agreeHabeasDataAlert: "Debes aceptar la política de tratamiento de datos personales para continuar.",
    fillNameAndUrl: "Completa nombre y url",
    takeOrUploadAlert: "Por favor, tómate una foto o sube un archivo.",
    uploadErrorAlert: "Hubo un error subiendo tu foto.",
    paymentErrorAlert: "Error al iniciar el pago.",

    // UserBookingsView
    backHome: "Volver al inicio",
    myProjections: "Mis Proyecciones",
    enterIdToVerify: "Ingresa tu cédula o correo electrónico para verificar tus reservas y el horario de tus proyecciones en pantalla gigante.",
    idOrEmail: "Cédula o Correo Electrónico",
    idOrEmailPlaceholder: "Ej: 10203040 o juan@correo.com",
    search: "Buscar",
    noProjectionsFound: "No se encontraron proyecciones con ese dato.",
    pendingPayment: "Pago Pendiente",
    confirmedInQueue: "Confirmada (En Cola)",
    imageGenerated: "Imagen Generada",
    projected: "Proyectada",
    experienceFinished: "Experiencia Finalizada",
    date: "Fecha:",
    generalSlot: "Franja General:",
    queuePosition: "Turno en la cola:",
    projectionDateTime: "Fecha y hora de proyección:",
    pendingPaymentState: "Pendiente de pago",
    toCalculate: "Por calcular",
    searchError: "Hubo un error al buscar tus proyecciones.",
  },
  en: {
    // App
    appTitle: "Led's on Renacer Photobooth",

    // Home
    captureMoment: "Capture the Moment",
    scanQR: "Scan the QR code with your phone to book, take your photo, and appear on the big screen.",
    simulateScan: "Simulate Scan (Go to Form)",

    // BookingForm
    bookPhotobooth: "Book your Photobooth",
    chooseStyle: "Choose Style",
    selectFilterDesc: "Select the filter",
    payment: "Payment",
    enterDataPay: "Enter data and pay",
    photo: "Photo",
    takePhotoDesc: "Take your photo",
    result: "Result",
    yourTurn: "Your turn",
    step1Title: "1. Select the style for your projection",
    noFilters: "No active filters at the moment.",
    selectFilterAlert: "Select a filter to continue",
    nextStep: "Next Step",
    step2Title: "2. Fill in your details to make the payment",
    fullName: "Full Name",
    docId: "ID / Passport",
    email: "Email",
    whatsapp: "WhatsApp (Mobile)",
    country: "Nationality (Country)",
    selectCountry: "Select your country",
    city: "City",
    selectCity: "Select your city",
    selectCountryFirst: "Select a country first",
    bookingDate: "Booking date",
    timeSlot: "Time slot to choose",
    selectTimeSlot: "Select projection time",
    habeasDataText1: "I accept the ",
    habeasDataText2: "personal data processing policy (Habeas Data)",
    back: "Back",
    alreadyPaid: "I already paid on D-Local Go",
    payWith: "Pay with",
    paymentApproved: "Payment Approved!",
    nowUploadPhoto: "Now, upload your photo or take a selfie for the projection.",
    gallery: "Gallery",
    takeSelfie: "Take Selfie",
    selectedImage: "Selected image:",
    removeImage: "Change image",
    magicReady: "We are ready to add the magic of Comuna 13",
    next: "Next",
    bookingCompleted: "Booking Completed Successfully!",
    queueTurn: "Your turn in the queue is #",
    assignedTime: "The time assigned for your projection is at",
    unassigned: "Unassigned",
    franjaAssigned: "Your publication window is",
    franjaFullTitle: "Current window full",
    franjaFullMsg: "The current time window is full. Please select a different publication window:",
    selectFranja: "Select a time window",
    confirmFranjaBtn: "Confirm window",
    spotsLabel: "spots available",
    franjaNowFull: "That window just filled up. Please choose another one.",
    selectFranjaAlert: "You must select a time window.",
    assignFranjaError: "There was an error assigning the window. Please try again.",
    yourPhotoReady: "Your photo ready for the magic:",
    searchBookingText: "Search for your booking with your ID in the portal to see its status in real time.",
    goToMyBookings: "Go to my bookings",
    paymentProcessing: "Your payment is processing or was not approved",
    dontWorry: "Don't worry. Access our portal below. If your payment is approved, you can complete your booking or check the status from there by entering your ID or email.",
    poseTitle: "Strike your best pose",
    capture: "Capture",
    agreeHabeasDataAlert: "You must accept the personal data processing policy to continue.",
    fillNameAndUrl: "Fill in name and url",
    takeOrUploadAlert: "Please take a photo or upload a file.",
    uploadErrorAlert: "There was an error uploading your photo.",
    paymentErrorAlert: "Error initiating payment.",

    // UserBookingsView
    backHome: "Back to home",
    myProjections: "My Projections",
    enterIdToVerify: "Enter your ID or email to check your bookings and the schedule of your big screen projections.",
    idOrEmail: "ID or Email",
    idOrEmailPlaceholder: "Ex: 10203040 or john@email.com",
    search: "Search",
    noProjectionsFound: "No projections found with that data.",
    pendingPayment: "Pending Payment",
    confirmedInQueue: "Confirmed (In Queue)",
    imageGenerated: "Image Generated",
    projected: "Projected",
    experienceFinished: "Experience Finished",
    date: "Date:",
    generalSlot: "General Slot:",
    queuePosition: "Queue Position:",
    projectionDateTime: "Projection date and time:",
    pendingPaymentState: "Pending payment",
    toCalculate: "To calculate",
    searchError: "There was an error searching your projections.",
  }
};

type TranslationKey = keyof typeof translations.es;

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'es',
  toggleLanguage: () => {},
  t: (key) => key,
});

export const LanguageProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('appLanguage');
    return (saved === 'en' || saved === 'es') ? saved : 'es';
  });

  const toggleLanguage = () => {
    setLanguage(prev => {
      const next = prev === 'es' ? 'en' : 'es';
      localStorage.setItem('appLanguage', next);
      return next;
    });
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);