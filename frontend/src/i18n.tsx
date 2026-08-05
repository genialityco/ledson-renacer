import React, { createContext, useContext, useState } from 'react';

type Language = 'es' | 'en';

const translations = {
  es: {
    // App
    appTitle: "Led's on Renacer Photobooth",

    // Home
    homeTitle: "Reserva tu espacio",
    homeSubtitle: "en la pantalla más grande de la Comuna 13, Medellín",
    welcomeTitle: "Bienvenido(a) a la Experiencia LED'S ON",
    welcomeText1: "Sube tu foto o video, reserva tu espacio en pantalla y conviértete en arte vivo de la Comuna 13 de Medellín.",
    welcomeText2: "Cada experiencia incluye un recuerdo digital para que puedas verlo de nuevo y compartir tu momento estelar.",
    scanQR: "Escanea el código QR con tu teléfono para reservar, tomarte tu foto y aparecer en la pantalla gigante.",
    qrCaption: "Escanea este código con tu teléfono para reservar desde tu celular.",
    startBtn: "Comenzar",

    // BookingForm
    chooseStyle: "Elegir Estilo",
    selectFilterDesc: "Selecciona el filtro",
    payment: "Pago",
    enterDataPay: "Ingresa datos y paga",
    photo: "Foto",
    takePhotoDesc: "Tómate la foto",
    result: "Resultado",
    yourTurn: "Tu turno",
    step1Title: "Elige tu filtro artístico",
    step1Subtitle: "Este será el estilo que se aplicará a tu fotografía.",
    noFilters: "No hay filtros activos en este momento.",
    nextStep: "Continuar",
    step2Title: "Llena tus datos para realizar el pago",
    step2Subtitle: "Usaremos estos datos para registrar tu reserva y el pago.",
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
    timeSlot: "Horario a elegir",
    selectTimeSlot: "Selecciona la hora de proyección",
    habeasDataText1: "Acepto la ",
    habeasDataText2: "política de tratamiento de datos personales (Habeas Data)",
    requiresInvoiceLabel: "¿Requieres factura electrónica?",
    yesLabel: "Sí",
    noLabel: "No",
    back: "Volver",
    alreadyPaid: "Ya realicé el pago en D-Local Go",
    payWith: "Pagar con",
    paymentApproved: "¡Pago Aprobado!",
    nowUploadPhoto: "Ahora, sube tu foto o video, o tómate una selfie, para la proyección.",
    uploadPhoto: "Subir Foto",
    uploadVideo: "Subir Video",
    takeSelfie: "Tomar Selfie",
    selectedImage: "Imagen seleccionada:",
    removeImage: "Cambiar imagen",
    magicReady: "Estamos listos para agregar la magia de la comuna 13",
    videoReady: "Tu video está listo para proyectarse en pantalla",
    videoTooLargeAlert: "El video pesa demasiado (máximo {max}MB). Elige uno más liviano.",
    next: "Siguiente",
    bookingCompleted: "¡Reserva Completada Exitosamente!",
    queueTurn: "Tu turno en la fila es el #",
    assignedTime: "Vivirás tu experiencia en pantalla a las",
    unassigned: "Sin asignar",
    franjaAssigned: "Tu horario reservado es:",
    franjaFullTitle: "Horario actual lleno",
    franjaFullMsg: "El horario actual está lleno. Por favor selecciona otro horario de publicación:",
    selectFranja: "Selecciona un horario",
    confirmFranjaBtn: "Confirmar horario",
    spotsLabel: "cupos disponibles",
    franjaNowFull: "Ese horario acaba de llenarse. Por favor elige otro.",
    selectFranjaAlert: "Debes seleccionar un horario.",
    assignFranjaError: "Hubo un error asignando el horario. Intenta de nuevo.",
    approxFranjaLabel: "Tu horario aproximado de publicación es:",
    changeFranjaLabel: "¿Prefieres otro horario?",
    currentFranjaTag: "actual",
    bookingCodeLabel: "Tu código de reserva",
    copyCode: "Copiar código",
    photoWillBeProjected: "Tu imagen se proyectará en pantalla y luego enviaremos el recuerdo digital a tu correo electrónico.",
    newExperienceQuestion: "¿Quieres una nueva Experiencia LED'S ON?",
    newReservationBtn: "Reserva un nuevo espacio",
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
    enterIdToVerify: "Ingresa tu código de reserva, cédula o correo electrónico para verificar tus reservas y el horario de tus proyecciones en pantalla gigante.",
    idOrEmail: "Código de reserva, cédula o correo electrónico",
    idOrEmailPlaceholder: "Ej: A3-F9-K2, 10203040 o juan@correo.com",
    search: "Buscar",
    noProjectionsFound: "No se encontraron proyecciones con ese dato.",
    pendingPayment: "Pago Pendiente",
    confirmedInQueue: "Confirmada (En Cola)",
    imageGenerated: "Imagen Generada",
    projected: "Proyectada",
    experienceFinished: "Experiencia Finalizada",
    date: "Fecha:",
    generalSlot: "Horario General:",
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
    homeTitle: "Book your spot",
    homeSubtitle: "on the biggest screen in Comuna 13, Medellín",
    welcomeTitle: "Welcome to the LED'S ON Experience",
    welcomeText1: "Upload your photo or video, book your spot on screen, and become living art of Comuna 13, Medellín.",
    welcomeText2: "Each experience includes a digital keepsake so you can watch it again and share your standout moment.",
    scanQR: "Scan the QR code with your phone to book, take your photo, and appear on the big screen.",
    qrCaption: "Scan this code with your phone to book from your mobile.",
    startBtn: "Start",

    // BookingForm
    chooseStyle: "Choose Style",
    selectFilterDesc: "Select the filter",
    payment: "Payment",
    enterDataPay: "Enter data and pay",
    photo: "Photo",
    takePhotoDesc: "Take your photo",
    result: "Result",
    yourTurn: "Your turn",
    step1Title: "Choose your artistic filter",
    step1Subtitle: "This will be the style applied to your photo.",
    noFilters: "No active filters at the moment.",
    nextStep: "Continue",
    step2Title: "Fill in your details to make the payment",
    step2Subtitle: "We'll use this information to register your booking and payment.",
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
    requiresInvoiceLabel: "Do you require an electronic invoice?",
    yesLabel: "Yes",
    noLabel: "No",
    back: "Back",
    alreadyPaid: "I already paid on D-Local Go",
    payWith: "Pay with",
    paymentApproved: "Payment Approved!",
    nowUploadPhoto: "Now, upload your photo or video, or take a selfie, for the projection.",
    uploadPhoto: "Upload Photo",
    uploadVideo: "Upload Video",
    takeSelfie: "Take Selfie",
    selectedImage: "Selected image:",
    removeImage: "Change image",
    magicReady: "We are ready to add the magic of Comuna 13",
    videoReady: "Your video is ready to be projected on screen",
    videoTooLargeAlert: "The video is too large (max {max}MB). Please choose a smaller one.",
    next: "Next",
    bookingCompleted: "Booking Completed Successfully!",
    queueTurn: "Your turn in the queue is #",
    assignedTime: "You'll live your experience on screen at",
    unassigned: "Unassigned",
    franjaAssigned: "Your reserved time slot is:",
    franjaFullTitle: "Current window full",
    franjaFullMsg: "The current time window is full. Please select a different publication window:",
    selectFranja: "Select a time window",
    confirmFranjaBtn: "Confirm window",
    spotsLabel: "spots available",
    franjaNowFull: "That window just filled up. Please choose another one.",
    selectFranjaAlert: "You must select a time window.",
    assignFranjaError: "There was an error assigning the window. Please try again.",
    approxFranjaLabel: "Your approximate publication window is:",
    changeFranjaLabel: "Prefer a different window?",
    currentFranjaTag: "current",
    bookingCodeLabel: "Your booking code",
    copyCode: "Copy code",
    photoWillBeProjected: "Your image will be projected on screen and then we'll email you your digital keepsake.",
    newExperienceQuestion: "Want a new LED'S ON Experience?",
    newReservationBtn: "Book a new spot",
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
    enterIdToVerify: "Enter your booking code, ID or email to check your bookings and the schedule of your big screen projections.",
    idOrEmail: "Booking code, ID or email",
    idOrEmailPlaceholder: "Ex: A3-F9-K2, 10203040 or john@email.com",
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