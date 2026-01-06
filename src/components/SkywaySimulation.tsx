// components/SkywaySimulation.tsx
"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment, Float } from "@react-three/drei";
import { useControls, Leva } from "leva";
import * as THREE from "three";

// --- 1. THIẾT KẾ TUYẾN ĐƯỜNG LIÊN KẾT VÙNG ---
// Đi qua 4 khu vực: Trung tâm -> Dân cư -> Sân bay -> Cảng biển -> Về Trung tâm
const trackPoints = [
  // 🏙️ KHU TRUNG TÂM (Cao độ 15-20m)
  new THREE.Vector3(0, 15, 0),     
  new THREE.Vector3(20, 20, -20),  
  
  // 🏡 KHU DÂN CƯ (Hạ thấp 10m, đi len lỏi)
  new THREE.Vector3(60, 10, -40), 
  new THREE.Vector3(80, 10, 0),    
  
  // ✈️ SÂN BAY (Cao độ 15m, view thoáng)
  new THREE.Vector3(60, 15, 60),   
  new THREE.Vector3(20, 15, 80),   
  
  // ⚓ CẢNG BIỂN (Vượt biển, cao 18m)
  new THREE.Vector3(-40, 18, 60),  
  new THREE.Vector3(-60, 18, 20),  // Đi dọc bờ biển
  
  // Về lại trung tâm
  new THREE.Vector3(-20, 15, 0),   
];

// closed: true sẽ tự nối điểm cuối về điểm đầu -> Hết bị xoắn
const trackCurve = new THREE.CatmullRomCurve3(trackPoints, true, 'catmullrom', 0.2);

// --- 2. HỆ THỐNG ĐƯỜNG RAY (GIỮ NGUYÊN) ---
const CurvedTrussTrack = () => {
  const railGeometry = useMemo(() => new THREE.TubeGeometry(trackCurve, 500, 0.15, 8, true), []);
  const struts = useMemo(() => {
    const items = [];
    const count = 300; 
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const pos = trackCurve.getPointAt(t);
      const tangent = trackCurve.getTangentAt(t);
      const dummy = new THREE.Object3D();
      dummy.position.copy(pos);
      dummy.lookAt(pos.clone().add(tangent));
      items.push(
        <group key={i} position={[pos.x, pos.y + 0.6, pos.z]} rotation={dummy.rotation}>
           <mesh><boxGeometry args={[0.8, 1.2, 0.08]} /> <meshStandardMaterial color="#557788" /></mesh>
           <mesh position={[0, 0.6, 0]} rotation={[Math.PI/2, 0, 0]}><boxGeometry args={[0.05, 1.5, 0.05]} /><meshStandardMaterial color="#557788" /></mesh>
        </group>
      );
    }
    return items;
  }, []);
  return <group><mesh geometry={railGeometry}><meshStandardMaterial color="#222" /></mesh>{struts}</group>;
};

// --- 3. CỘT TRỤ THÔNG MINH ---
const SmartPillars = () => {
  const pillarLocations = useMemo(() => {
    const locs = [];
    for (let i = 0; i < 30; i++) {
      const t = i / 30;
      const pos = trackCurve.getPointAt(t);
      // Không đặt cột nếu đang ở trên mặt biển (khu vực x < -30 và z > 10)
      const isOverWater = pos.x < -20 && pos.z > 10;
      if (pos.y > 5 && !isOverWater) locs.push(pos);
    }
    return locs;
  }, []);
  return (
    <>
      {pillarLocations.map((pos, i) => (
        <group key={i} position={[pos.x, 0, pos.z]}>
            <mesh position={[3, pos.y / 2, 0]}><cylinderGeometry args={[0.5, 0.7, pos.y, 16]} /><meshStandardMaterial color="#8899AA" /></mesh>
            <mesh position={[1.5, pos.y + 1, 0]}><boxGeometry args={[3.5, 0.6, 0.6]} /><meshStandardMaterial color="#8899AA" /></mesh>
        </group>
      ))}
      {/* Cột trụ đặc biệt dưới biển (To hơn, chân đế bê tông) */}
      <mesh position={[-50, 9, 40]}>
          <cylinderGeometry args={[1, 1, 18, 32]} /> <meshStandardMaterial color="#666" />
      </mesh>
       <mesh position={[-50, 19, 40]}>
          <boxGeometry args={[6, 1, 1]} /> <meshStandardMaterial color="#666" />
      </mesh>
    </>
  );
};

// --- 4. TÀU UNICAR (GIỮ NGUYÊN) ---
const Unicar = ({ speed, isMoving, cockpitView, lookX, lookY }: any) => {
  const uPodRef = useRef<THREE.Group>(null);
  const progress = useRef(0);
  useFrame((state, delta) => {
    if (uPodRef.current && isMoving) {
      progress.current = (progress.current + (speed * delta) / 600) % 1; // Map to hơn nên chia 600
      const position = trackCurve.getPointAt(progress.current);
      const tangent = trackCurve.getTangentAt(progress.current).normalize();
      uPodRef.current.position.copy(position);
      uPodRef.current.lookAt(position.clone().add(tangent));
    }
  });
  return (
    <group ref={uPodRef}>
      <PerspectiveCamera makeDefault={cockpitView} position={[0, -1.5, 2.5]} rotation={[lookY, Math.PI + lookX, 0]} fov={80} near={0.1} />
      <group rotation={[0, Math.PI, 0]}>
        <group position={[0, 0, 0]}><mesh><boxGeometry args={[0.4, 0.3, 1.2]} /><meshStandardMaterial color="#333" /></mesh></group>
        <mesh position={[0, -0.6, 0]}><cylinderGeometry args={[0.15, 0.1, 1]} /><meshStandardMaterial color="#555" /></mesh>
        <group position={[0, -1.8, 0]}> 
            <mesh><boxGeometry args={[1.4, 1.6, 3.2]} /><meshStandardMaterial color="#ECECEC" roughness={0.2} /></mesh>
            <mesh position={[0, 0.1, 1.61]}><boxGeometry args={[1.2, 1, 0.1]} /><meshStandardMaterial color="#111" roughness={0} metalness={0.9} /></mesh>
            <mesh position={[0.71, 0.2, 0]}><boxGeometry args={[0.1, 0.8, 2.5]} /><meshStandardMaterial color="#111" roughness={0} metalness={0.9} /></mesh>
            <mesh position={[-0.71, 0.2, 0]}><boxGeometry args={[0.1, 0.8, 2.5]} /><meshStandardMaterial color="#111" roughness={0} metalness={0.9} /></mesh>
            <mesh position={[0.4, -0.5, 1.62]}><sphereGeometry args={[0.1]} /><meshStandardMaterial color="white" emissive="white" emissiveIntensity={2} /></mesh>
            <mesh position={[-0.4, -0.5, 1.62]}><sphereGeometry args={[0.1]} /><meshStandardMaterial color="white" emissive="white" emissiveIntensity={2} /></mesh>
             <mesh position={[0, -0.6, 0]}><boxGeometry args={[1.42, 0.2, 3]} /><meshStandardMaterial color="#0088FF" /></mesh>
        </group>
      </group>
    </group>
  );
};

// --- 5. XÂY DỰNG CÁC KHU VỰC CHỨC NĂNG (MỚI) ---

// 🏙️ Khu Trung Tâm
const CityCenter = () => (
    <group position={[0, 0, -10]}>
        {/* Sàn bê tông */}
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.1, 0]}><planeGeometry args={[50, 50]} /><meshStandardMaterial color="#333" /></mesh>
        {/* Các tòa nhà chọc trời */}
        {[...Array(10)].map((_, i) => (
            <mesh key={i} position={[(Math.random()-0.5)*40, 10 + Math.random()*10, (Math.random()-0.5)*40]}>
                <boxGeometry args={[4 + Math.random()*4, 20 + Math.random()*20, 4 + Math.random()*4]} />
                <meshStandardMaterial color={`hsl(200, ${20 + Math.random()*30}%, ${40 + Math.random()*20}%)`} />
            </mesh>
        ))}
    </group>
)

// 🏡 Khu Dân Cư
const ResidentialZone = () => (
    <group position={[70, 0, -20]}>
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.1, 0]}><planeGeometry args={[60, 60]} /><meshStandardMaterial color="#7cfc00" /></mesh>
        {/* Nhà mái ngói */}
        {[...Array(15)].map((_, i) => (
             <group key={i} position={[(Math.random()-0.5)*50, 0, (Math.random()-0.5)*50]}>
                 <mesh position={[0, 1.5, 0]}><boxGeometry args={[3, 3, 3]} /><meshStandardMaterial color="#F5DEB3" /></mesh>
                 <mesh position={[0, 3.5, 0]} rotation={[0, Math.PI/4, 0]}><coneGeometry args={[2.5, 1.5, 4]} /><meshStandardMaterial color="#A52A2A" /></mesh>
             </group>
        ))}
        {/* Cây cối */}
        {[...Array(20)].map((_, i) => (
             <mesh key={i} position={[(Math.random()-0.5)*50, 0, (Math.random()-0.5)*50]}>
                <coneGeometry args={[1, 4, 8]} /><meshStandardMaterial color="green" />
            </mesh>
        ))}
    </group>
)

// ✈️ Sân Bay
const AirportZone = () => (
    <group position={[40, 0, 70]}>
        {/* Đường băng */}
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.1, 0]}><planeGeometry args={[80, 40]} /><meshStandardMaterial color="#555" /></mesh>
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.11, 0]}><planeGeometry args={[70, 2]} /><meshStandardMaterial color="white" /></mesh>
        
        {/* Đài kiểm soát */}
        <group position={[-20, 0, -15]}>
            <mesh position={[0, 5, 0]}><cylinderGeometry args={[1, 1, 10]} /><meshStandardMaterial color="#ddd" /></mesh>
            <mesh position={[0, 11, 0]}><cylinderGeometry args={[2, 1, 2]} /><meshStandardMaterial color="#333" /></mesh>
        </group>

        {/* Máy bay (Đơn giản hóa) */}
        <Float speed={2} rotationIntensity={0.5} floatIntensity={2}>
            <group position={[10, 20, 0]} rotation={[0, -Math.PI/2, -0.2]}>
                 <mesh><boxGeometry args={[2, 1, 8]} /><meshStandardMaterial color="white" /></mesh> {/* Thân */}
                 <mesh position={[0, 0, 2]}><boxGeometry args={[8, 0.1, 2]} /><meshStandardMaterial color="white" /></mesh> {/* Cánh */}
                 <mesh position={[0, 1, -3]}><boxGeometry args={[0.2, 2, 1]} /><meshStandardMaterial color="red" /></mesh> {/* Đuôi */}
            </group>
        </Float>
    </group>
)

// ⚓ Cảng Biển & Khu Công Nghiệp
const PortZone = () => (
    <group position={[-50, 0, 40]}>
        {/* Mặt nước biển */}
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.5, 0]}>
            <planeGeometry args={[80, 80]} />
            <meshStandardMaterial color="#006994" roughness={0.1} metalness={0.8} />
        </mesh>

        {/* Tàu hàng (Ship) */}
        <group position={[-10, 0.5, 10]} rotation={[0, 0.2, 0]}>
             <mesh position={[0, 1, 0]}><boxGeometry args={[5, 2, 15]} /><meshStandardMaterial color="#8B0000" /></mesh>
             <mesh position={[0, 2.5, -4]}><boxGeometry args={[3, 2, 4]} /><meshStandardMaterial color="white" /></mesh>
             {/* Container trên tàu */}
             <mesh position={[0, 2.5, 2]}><boxGeometry args={[2, 1, 4]} /><meshStandardMaterial color="orange" /></mesh>
        </group>

        {/* Cần cẩu cảng */}
        <group position={[20, 0, 0]}>
             <mesh position={[0, 10, 0]}><cylinderGeometry args={[0.5, 0.5, 20]} /><meshStandardMaterial color="yellow" /></mesh>
             <mesh position={[-5, 18, 0]} rotation={[0, 0, 0.2]}><boxGeometry args={[15, 1, 1]} /><meshStandardMaterial color="yellow" /></mesh>
        </group>

        {/* Kho bãi (Container) */}
        {[...Array(10)].map((_, i) => (
             <mesh key={i} position={[20 + (Math.random()-0.5)*20, 1.5, 20 + (Math.random()-0.5)*20]}>
                <boxGeometry args={[2, 2, 4]} />
                <meshStandardMaterial color={Math.random() > 0.5 ? "blue" : "red"} />
            </mesh>
        ))}
    </group>
)

// --- MAIN APP ---
export default function SkywaySimulation() {
  const { speed, isMoving, cockpitView, autoRotate, lookX, lookY } = useControls("Skyway Panel", {
    speed: { value: 20, min: 0, max: 100, label: "Tốc độ (km/h)" },
    isMoving: { value: true, label: "Chạy tàu" },
    cockpitView: { value: false, label: "Vào buồng lái" },
    lookX: { value: 0, min: -1.5, max: 1.5, label: "Quay đầu" },
    lookY: { value: 0, min: -0.5, max: 0.5, label: "Ngước nhìn" },
    autoRotate: { value: false, label: "Xoay cảnh" },
  });

  return (
    <div className="w-full h-screen bg-black">
      <Leva collapsed={false} />
      <Canvas shadows camera={{ position: [0, 100, 100], fov: 45 }}>
        <Environment preset="city" background blur={0.6} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[100, 100, 50]} intensity={1.5} castShadow />

        {/* Đường ray & Cột */}
        <CurvedTrussTrack />
        <SmartPillars />
        
        {/* Tàu chạy */}
        <Unicar speed={speed} isMoving={isMoving} cockpitView={cockpitView} lookX={lookX} lookY={lookY} />

        {/* CÁC KHU VỰC THÀNH PHỐ */}
        <CityCenter />
        <ResidentialZone />
        <AirportZone />
        <PortZone />

        {/* Nền đất chung */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
          <planeGeometry args={[1000, 1000]} />
          <meshStandardMaterial color="#222" />
        </mesh>

        {!cockpitView && <OrbitControls autoRotate={autoRotate} autoRotateSpeed={0.5} maxPolarAngle={Math.PI / 2.1} />}
      </Canvas>
    </div>
  );
}