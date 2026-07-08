import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { TextureLoader } from 'three';
import { Box } from '@mantine/core';
import * as THREE from 'three';
import sprayObjPath from './assets/Spray_Color_obj.obj?url';
import stickerTexturePath from './assets/StickerBox.jpg';
import { API_BASE_URL } from './config';

// Componente para cargar el modelo 3D
function SprayModel() {
  const obj = useLoader(OBJLoader, sprayObjPath);
  const texture = useLoader(TextureLoader, stickerTexturePath);
  const meshRef = useRef<any>(null);

  useEffect(() => {
    // Ajustar configuración de la textura si es necesario (evita que se vea volteada)
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    // Si el OBJ no tiene material, le asignamos uno para que se vea
    obj.traverse((child: any) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({ map: texture });
      }
    });
  }, [obj, texture]);

  useFrame((state, delta) => {
    if (meshRef.current) {
      // Como ahora la lata ya está "parada" por el <group> padre, 
      // solo aplicamos rotación sobre el eje Y local para que ruede sobre sí misma.
      meshRef.current.rotation.y += delta * 0.4;
      
      // Agiteo de la lata mientras pinta (temblor en el eje Z)
      meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 20) * 0.05; 
      
      // Asegurarnos que X local sea 0 (sin inclinación)
      meshRef.current.rotation.x = 0;
    }
  });

  return (
    <group rotation={[0, Math.PI / 2, 0]}>
      {/* 
        Para simplificar y no pelear con rotaciones relativas en useFrame, 
        usamos un group para "parar" la lata y aplicamos el useFrame solo para la animación.
      */}
      <primitive 
        ref={meshRef}
        object={obj} 
        scale={[2, 2, 2]} 
        position={[0, 0, 0]} 
      />
    </group>
  );
}

// Lógica de partículas adaptada del código proporcionado
function RandomizeParticles(stageX: number, stageY: number, ctx: CanvasRenderingContext2D, amount: number, intensity: number) {
  for (let i = 0; i < intensity; i++) {
    let x = stageX + (Math.random() - 0.5) * Math.random() * amount * 3;
    let y = stageY + (Math.random() - 0.5) * Math.random() * amount * 3;
    let alpha = Math.random();

    let rad;
    if (
      x > stageX + (amount - 20) ||
      x < stageX - (amount - 20) ||
      y > stageY + (amount - 20) ||
      y < stageY - (amount - 20)
    ) {
      rad = (Math.random() * amount) / 10; // Círculos un poco más grandes en los bordes
    } else if (
      x > stageX + (amount - 25) ||
      x < stageX - (amount - 25) ||
      y > stageY + (amount - 25) ||
      y < stageY - (amount - 25)
    ) {
      rad = (Math.random() * amount) / 15;
    } else if (
      x > stageX + (amount - 30) ||
      x < stageX - (amount - 30) ||
      y > stageY + (amount - 30) ||
      y < stageY - (amount - 30)
    ) {
      rad = (Math.random() * amount) / 20;
    } else if (
      x > stageX + (amount - 15) ||
      x < stageX - (amount - 15) ||
      y > stageY + (amount - 15) ||
      y < stageY - (amount - 15)
    ) {
      rad = Math.random() * 2;
    } else {
      rad = (Math.random() * amount) / 5; // Aumentar sustancialmente el tamaño de las partículas del centro
    }

    ctx.beginPath();
    // Color negro con alpha mayor para rellenar más sólido
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(alpha + 0.3, 1)})`;
    ctx.arc(x, y, rad, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();
  }
}

export function SprayEffect({ imageUrl, frameUrl, onComplete }: { imageUrl: string, frameUrl?: string, onComplete?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [sprayPos, setSprayPos] = useState({ x: -1000, y: -1000, opacity: 0 });
  
  useEffect(() => {
    const container = containerRef.current;
    const mainCanvas = mainCanvasRef.current;
    if (!container || !mainCanvas) return;

    // Obtener las dimensiones del contenedor de la imagen
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Configurar canvas visibles
    mainCanvas.width = width;
    mainCanvas.height = height;

    // Crear canvas invisible para la máscara de partículas
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    maskCanvasRef.current = maskCanvas;

    const mainCtx = mainCanvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!mainCtx || !maskCtx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous'; // En caso de CORS
    
    let frameImg: HTMLImageElement | null = null;
    if (frameUrl) {
      frameImg = new Image();
      frameImg.crossOrigin = 'anonymous';
      // Pasamos la URL del marco por el proxy
      frameImg.src = `${API_BASE_URL}/api/images/proxy?url=${encodeURIComponent(frameUrl)}`;
    }

    let animationFrameId: number;
    let startTime: number | null = null;
    const duration = 10000; // Duración total del zigzag (10 segundos para que sea más lento y apreciable)
    
    // Puntos del zigzag (coordenadas relativas de 0 a 1)
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0.1 },
      { x: 0, y: 0.2 },
      { x: 1, y: 0.3 },
      { x: 0, y: 0.4 },
      { x: 1, y: 0.5 },
      { x: 0, y: 0.6 },
      { x: 1, y: 0.7 },
      { x: 0, y: 0.8 },
      { x: 1, y: 0.9 },
      { x: 0, y: 1 },
    ];

    const audio = new Audio("https://cdn.discordapp.com/attachments/1072488517017550868/1080789282572218418/continous_spray_spund.mp3");
    audio.loop = true;

    img.onload = () => {
      audio.play().catch(e => console.log('Audio autoplay error:', e));

      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        let elapsed = timestamp - startTime;
        let progress = Math.min(elapsed / duration, 1);

        // Encontrar en qué segmento del zigzag estamos
        const numSegments = path.length - 1;
        const scaledProgress = progress * numSegments;
        const index = Math.floor(scaledProgress);
        const segmentProgress = scaledProgress - index;

        let currentX = width / 2;
        let currentY = height / 2;

        if (index < numSegments) {
          const p1 = path[index];
          const p2 = path[index + 1];
          currentX = (p1.x + (p2.x - p1.x) * segmentProgress) * width;
          currentY = (p1.y + (p2.y - p1.y) * segmentProgress) * height;
        } else {
          currentX = path[numSegments].x * width;
          currentY = path[numSegments].y * height;
        }

        // Actualizar UI del spray 3D
        setSprayPos({ x: currentX, y: currentY, opacity: progress < 1 ? 1 : 0 });

        // Pintar partículas en el mask canvas
        if (progress < 1) {
          // Ajusta el grosor del spray según el tamaño del canvas
          const sprayAmount = Math.min(width, height) * 0.15; // Mayor área de dispersión
          // Ejecutamos más partículas para que llene el espacio más rápido y denso
          RandomizeParticles(currentX, currentY, maskCtx, sprayAmount, 300);
        }

        // --- Renderizar todo al Main Canvas ---
        mainCtx.clearRect(0, 0, width, height);
        
        // 1. Dibujar la imagen de la persona y el marco
        mainCtx.globalCompositeOperation = 'source-over';
        
        // Emular object-fit: cover para la imagen
        const imgRatio = img.width / img.height;
        const canvasRatio = width / height;
        let drawWidth = width;
        let drawHeight = height;
        let offsetX = 0;
        let offsetY = 0;

        if (imgRatio > canvasRatio) {
          drawHeight = height;
          drawWidth = img.width * (height / img.height);
          offsetX = (width - drawWidth) / 2;
        } else {
          drawWidth = width;
          drawHeight = img.height * (width / img.width);
          offsetY = (height - drawHeight) / 2;
        }
        mainCtx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

        // Dibujar el marco si existe (object-fit: contain)
        if (frameImg && frameImg.complete) {
          const frameRatio = frameImg.width / frameImg.height;
          let fDrawWidth = width;
          let fDrawHeight = height;
          let fOffsetX = 0;
          let fOffsetY = 0;

          if (frameRatio > canvasRatio) {
            fDrawWidth = width;
            fDrawHeight = frameImg.height * (width / frameImg.width);
            fOffsetY = (height - fDrawHeight) / 2;
          } else {
            fDrawHeight = height;
            fDrawWidth = frameImg.width * (height / frameImg.height);
            fOffsetX = (width - fDrawWidth) / 2;
          }
          mainCtx.drawImage(frameImg, fOffsetX, fOffsetY, fDrawWidth, fDrawHeight);
        }

        // 2. Aplicar la máscara (borrar todo excepto donde haya partículas)
        mainCtx.globalCompositeOperation = 'destination-in';
        mainCtx.drawImage(maskCanvas, 0, 0);

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(animate);
        } else {
          audio.pause();
          if (onComplete) onComplete();
        }
      };

      animationFrameId = requestAnimationFrame(animate);
    };

    // Pasamos la URL de la imagen por nuestro proxy de backend para evadir los problemas de CORS de Firebase
    img.src = `${API_BASE_URL}/api/images/proxy?url=${encodeURIComponent(imageUrl)}`;

    return () => {
      cancelAnimationFrame(animationFrameId);
      audio.pause();
    };
  }, [imageUrl, frameUrl, onComplete]);

  return (
    <Box style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 30, pointerEvents: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      
      {/* Contenedor relativo 1:1 donde ocurre la magia */}
      <Box ref={containerRef} style={{ position: 'relative', height: '100%', aspectRatio: '1 / 1', overflow: 'hidden' }}>
        
        {/* Canvas principal donde se revela la foto */}
        <canvas 
          ref={mainCanvasRef} 
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        />

        {/* Lata de spray 3D moviéndose sincronizada */}
        <div
          style={{
            position: 'absolute',
            top: sprayPos.y,
            left: sprayPos.x,
            width: '600px', // Ampliamos más el canvas contenedor
            height: '600px',
            marginLeft: '-300px', // Ajustado al centro horizontal (mitad de 600)
            marginTop: '0px',  // Modificado a -150px para bajar el tarro visualmente y alinear la boquilla al chorro de pintura
            zIndex: 40,
            opacity: sprayPos.opacity,
            transition: 'opacity 0.2s'
          }}
        >
          {/* Ajustamos la cámara y fov para que capte modelos que inician de menor tamaño nativo */}
          <Canvas camera={{ position: [0, 0, 50], fov: 50, near: 0.1, far: 1000 }}>
            <ambientLight intensity={2} />
            <directionalLight position={[10, 10, 10]} intensity={3} />
            <pointLight position={[-10, -10, -10]} intensity={1.5} color="#ffffff" />
            <React.Suspense fallback={
              <mesh>
                <boxGeometry args={[10, 10, 10]} />
                <meshStandardMaterial color="blue" />
              </mesh>
            }>
              <SprayModel />
            </React.Suspense>
          </Canvas>
        </div>
      </Box>
    </Box>
  );
}
