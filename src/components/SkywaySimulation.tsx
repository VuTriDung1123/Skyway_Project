// components/SkywaySimulation.tsx
"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sky, Stars, PerspectiveCamera } from "@react-three/drei";
import { useControls, Leva } from "leva";
import * as THREE from "three";

// --- CẤU HÌNH ĐƯỜNG ĐUA (LOOP) ---
// Tạo các điểm mốc để đường ray đi qua. 
// Lưu ý: Điểm (0, 8, 30) là vị trí đặt Nhà Ga.
const trackPoints = [
  new THREE.Vector3(0, 8, 30),   // Điểm giữa Nhà ga
  new THREE.Vector3(20, 8, 30),  // Ra khỏi ga
  new THREE.Vector3(40, 8, 10),  // Cua phải
  new THREE.Vector3(40, 8, -10),
  new THREE.Vector3(20, 8, -30), // Vòng ra sau
  new THREE.Vector3(-20, 8, -30),
  new THREE.Vector3(-40, 8, -10),
  new THREE.Vector3(-40, 8, 10), // Cua trái về lại
  new THREE.Vector3(-20, 8, 30), // Chuẩn bị vào ga
];

// Tạo đường cong khép kín
const trackCurve = new THREE.CatmullRomCurve3(trackPoints, true, 'catmullrom', 0.2);

// 1. Component Đường ray (Rail)
const Rail = () => {
  const curveGeometry = useMemo(() => {
    // Tạo hình ống bám theo đường cong
    return new THREE.TubeGeometry(trackCurve, 300, 0.15, 8, true);
  }, []);

  return (
    <mesh geometry={curveGeometry}>
      <meshStandardMaterial color="#333" />
    </mesh>
  );
};

// 2. Component Cột trụ (Pillars) - Tự động sinh ra tại các điểm uốn của đường ray
const Pillars = () => {
  return (
    <>
      {trackPoints.map((point, i) => (
        <group key={i} position={[point.x, 4, point.z]}> {/* y=4 vì trụ cao 8m */}
          <mesh>
            <cylinderGeometry args={[0.3, 0.5, 8, 32]} />
            <meshStandardMaterial color="#888" />
          </mesh>
          <mesh position={[0, -3.9, 0]}>
             <cylinderGeometry args={[0.8, 1, 0.2, 32]} />
             <meshStandardMaterial color="#555" />
          </mesh>
        </group>
      ))}
    </>
  );
};

// 3. Component Nhà ga (Station) - Đặt tại vị trí (0, 8, 30)
const Station = () => {
  return (
    <group position={[0, 8, 30]}>
      {/* Sàn ga (Tàu sẽ lướt ngay trên mặt này) */}
      <mesh position={[0, -0.6, 0]}>
        <boxGeometry args={[12, 0.5, 12]} />
        <meshStandardMaterial color="#505050" />
      </mesh>
      {/* Mái che */}
      <mesh position={[0, 3.5, 0]}>
         <boxGeometry args={[14, 0.2, 14]} />
         <meshStandardMaterial color="#aaa" />
      </mesh>
       {/* Cột đỡ mái nhà ga */}
       <mesh position={[-5, 1.5, 5]}><cylinderGeometry args={[0.2,0.2,4]} /><meshStandardMaterial color="#666"/></mesh>
       <mesh position={[5, 1.5, 5]}><cylinderGeometry args={[0.2,0.2,4]} /><meshStandardMaterial color="#666"/></mesh>
       <mesh position={[-5, 1.5, -5]}><cylinderGeometry args={[0.2,0.2,4]} /><meshStandardMaterial color="#666"/></mesh>
       <mesh position={[5, 1.5, -5]}><cylinderGeometry args={[0.2,0.2,4]} /><meshStandardMaterial color="#666"/></mesh>
    </group>
  )
}

// 4. Component Các toà nhà (Trang trí)
const Buildings = () => {
  const buildings = useMemo(() => {
    const configs = [
        { pos: [-15, 0, 10], size: [5, 20, 5], color: '#A020F0' },
        { pos: [15, 0, 5], size: [4, 25, 4], color: '#00FF7F' },
        { pos: [25, 0, 15], size: [6, 18, 6], color: '#FFC0CB' },
        { pos: [-20, 0, -10], size: [5, 15, 5], color: '#FF4500' },
        { pos: [0, 0, -20], size: [8, 30, 8], color: '#4682B4' }, // Toà nhà chọc trời giữa map
    ];
    return configs.map((cfg, i) => (
       <mesh key={i} position={[cfg.pos[0], cfg.size[1] / 2 - 0.1, cfg.pos[2]]}>
          <boxGeometry args={cfg.size as [number, number, number]} />
          <meshStandardMaterial color={cfg.color} />
        </mesh>
    ));
  }, []);
  return <group>{buildings}</group>;
}

// 5. Component uPod (Có Camera Buồng lái)
const Upod = ({ speed, isMoving, cockpitView }: { speed: number, isMoving: boolean, cockpitView: boolean }) => {
  const uPodRef = useRef<THREE.Group>(null);
  const progress = useRef(0);

  useFrame((state, delta) => {
    if (uPodRef.current && isMoving) {
      // Logic di chuyển
      progress.current = (progress.current + (speed * delta) / 200) % 1; // Chia 200 vì đường dài hơn
      const position = trackCurve.getPointAt(progress.current);
      uPodRef.current.position.copy(position);
      
      const tangent = trackCurve.getTangentAt(progress.current).normalize();
      uPodRef.current.lookAt(position.clone().add(tangent));
    }
  });

  return (
    <group ref={uPodRef}>
      {/* --- CAMERA BUỒNG LÁI (Gắn chặt vào xe) --- */}
      <PerspectiveCamera 
        makeDefault={cockpitView} 
        position={[0, 0.5, 1.8]} // Ngồi trong xe nhìn ra trước
        rotation={[0, Math.PI, 0]} // Xoay ngược lại vì lookAt của xe đang hướng về Z
        fov={75}
        near={0.1}
      />
      {/* Cần xoay camera 180 độ (Math.PI) nếu thấy đi lùi, hoặc chỉnh lại logic lookAt. 
         Với CatmullRomCurve3 mặc định, thường ta nhìn về hướng tangent. 
         Để đơn giản, ta đặt camera ngay mũi xe. */}

      {/* Thân xe */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[2.2, 1.2, 2.5]} />
        <meshStandardMaterial color="#00aaff" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Kính đen */}
      <mesh position={[0, 0.4, 1.26]}>
        <planeGeometry args={[2, 0.6]} />
        <meshStandardMaterial color="black" roughness={0.1} />
      </mesh>
      {/* Móc treo */}
      <mesh position={[0, 0.8, 0]}>
         <boxGeometry args={[0.8, 0.5, 0.5]} />
         <meshStandardMaterial color="#333" />
      </mesh>
    </group>
  );
};

// --- MAIN ---
export default function SkywaySimulation() {
  const { speed, isMoving, ambientIntensity, cockpitView } = useControls("Điều khiển Skyway", {
    speed: { value: 8, min: 0, max: 20, label: "Tốc độ" },
    isMoving: { value: true, label: "Chạy tàu" },
    cockpitView: { value: false, label: "Góc nhìn Buồng lái" },
    ambientIntensity: { value: 0.5, min: 0, max: 1, label: "Độ sáng" },
  });

  return (
    <div className="w-full h-screen bg-black">
      <Leva collapsed={false} />

      <Canvas shadows camera={{ position: [30, 30, 60], fov: 50 }}>
        <color attach="background" args={['#111']} />
        
        <ambientLight intensity={ambientIntensity} />
        <directionalLight position={[50, 50, 25]} intensity={1.5} castShadow />

        <Sky sunPosition={[7, 5, 1]} turbidity={8} rayleigh={6} />
        <Stars count={3000} factor={4} />
        
        {/* Sàn đất */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
          <planeGeometry args={[500, 500]} />
          <meshStandardMaterial color="#1a2a1a" />
        </mesh>

        <Rail />
        <Pillars />
        <Buildings />
        <Station />
        <Upod speed={speed} isMoving={isMoving} cockpitView={cockpitView} />

        {/* Ẩn OrbitControls khi đang ngồi trong buồng lái để không bị conflict chuột */}
        {!cockpitView && <OrbitControls maxPolarAngle={Math.PI / 2.1} />}
      </Canvas>
    </div>
  );
}