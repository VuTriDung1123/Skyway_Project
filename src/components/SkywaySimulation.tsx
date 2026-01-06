// components/SkywaySimulation.tsx
"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment, useHelper } from "@react-three/drei";
import { useControls, Leva } from "leva";
import * as THREE from "three";

// --- 1. THIẾT KẾ TUYẾN ĐƯỜNG (PATH) ---
const trackPoints = [
  new THREE.Vector3(0, 10, 0),    // P1: Nhà ga (Bắt đầu)
  new THREE.Vector3(0, 10, -40),  // P2: Đi thẳng
  new THREE.Vector3(30, 14, -80), // P3: Lên dốc, cua phải
  new THREE.Vector3(80, 18, -60), // P4: Đỉnh đồi
  new THREE.Vector3(100, 18, 0),  // P5: Đi ngang trên cao
  new THREE.Vector3(80, 14, 50),  // P6: Xuống dốc
  new THREE.Vector3(30, 10, 50),  // P7: Về thấp
  new THREE.Vector3(0, 10, 0),    // P8: Khép vòng
];
const trackCurve = new THREE.CatmullRomCurve3(trackPoints, true, 'catmullrom', 0.4);

// --- 2. HỆ THỐNG GIÀN THÉP (TRUSS) ---
const CurvedTrussTrack = () => {
  const railGeometry = useMemo(() => new THREE.TubeGeometry(trackCurve, 400, 0.15, 8, true), []);
  
  // Tạo khung xương giàn giáo
  const struts = useMemo(() => {
    const items = [];
    const count = 200; 
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const pos = trackCurve.getPointAt(t);
      const tangent = trackCurve.getTangentAt(t);
      const dummy = new THREE.Object3D();
      dummy.position.copy(pos);
      dummy.lookAt(pos.clone().add(tangent));
      
      items.push(
        <group key={i} position={[pos.x, pos.y + 0.6, pos.z]} rotation={dummy.rotation}>
           {/* Khung bao */}
           <mesh>
              <boxGeometry args={[0.8, 1.2, 0.08]} /> 
              <meshStandardMaterial color="#557788" />
           </mesh>
           {/* Thanh chéo trên nóc */}
           <mesh position={[0, 0.6, 0]} rotation={[Math.PI/2, 0, 0]}>
               <boxGeometry args={[0.05, 1.5, 0.05]} />
               <meshStandardMaterial color="#557788" />
           </mesh>
        </group>
      );
    }
    return items;
  }, []);

  return (
    <group>
      <mesh geometry={railGeometry}><meshStandardMaterial color="#222" /></mesh>
      {struts}
    </group>
  );
};

// --- 3. CỘT TRỤ (PILLARS) ---
const SmartPillars = () => {
  const pillarLocations = useMemo(() => {
    const locs = [];
    for (let i = 0; i < 20; i++) {
      const t = i / 20;
      const pos = trackCurve.getPointAt(t);
      if (pos.y > 5) locs.push(pos);
    }
    return locs;
  }, []);

  return (
    <>
      {pillarLocations.map((pos, i) => (
        <group key={i} position={[pos.x, 0, pos.z]}>
            {/* Thân cột */}
            <mesh position={[3, pos.y / 2, 0]}> 
                <cylinderGeometry args={[0.4, 0.6, pos.y, 16]} />
                <meshStandardMaterial color="#8899AA" />
            </mesh>
            {/* Cánh tay đòn */}
            <mesh position={[1.5, pos.y + 1, 0]}> 
                <boxGeometry args={[3.5, 0.6, 0.6]} />
                <meshStandardMaterial color="#8899AA" />
            </mesh>
        </group>
      ))}
    </>
  );
};

// --- 4. TÀU UNICAR (MODEL MỚI) ---
const Unicar = ({ speed, isMoving, cockpitView, lookX, lookY }: any) => {
  const uPodRef = useRef<THREE.Group>(null);
  const progress = useRef(0);

  useFrame((state, delta) => {
    if (uPodRef.current && isMoving) {
      progress.current = (progress.current + (speed * delta) / 400) % 1;
      
      const position = trackCurve.getPointAt(progress.current);
      const tangent = trackCurve.getTangentAt(progress.current).normalize();
      
      uPodRef.current.position.copy(position);
      uPodRef.current.lookAt(position.clone().add(tangent));
    }
  });

  return (
    <group ref={uPodRef}>
      <PerspectiveCamera 
        makeDefault={cockpitView} 
        position={[0, -1.5, 2]} 
        rotation={[lookY, Math.PI + lookX, 0]} 
        fov={80} near={0.1}
      />

      {/* Xoay ngược model 180 độ để đúng hướng chạy */}
      <group rotation={[0, Math.PI, 0]}>
        
        {/* --- CỤM BÁNH XE (Chạy trên ray) --- */}
        <group position={[0, 0, 0]}>
            <mesh>
                <boxGeometry args={[0.4, 0.3, 1.2]} />
                <meshStandardMaterial color="#333" />
            </mesh>
        </group>

        {/* --- CỔ TREO (Nối bánh với thân) --- */}
        <mesh position={[0, -0.6, 0]}>
            <cylinderGeometry args={[0.15, 0.1, 1]} />
            <meshStandardMaterial color="#555" />
        </mesh>

        {/* --- THÂN TÀU (UNICAR) --- */}
        <group position={[0, -1.8, 0]}> 
            {/* Vỏ tàu màu trắng/xanh */}
            <mesh>
                <boxGeometry args={[1.4, 1.6, 3.2]} /> 
                <meshStandardMaterial color="#ECECEC" roughness={0.2} />
            </mesh>
            
            {/* Kính lái phía trước (To và cong nhẹ) */}
            <mesh position={[0, 0.1, 1.61]}>
                <boxGeometry args={[1.2, 1, 0.1]} />
                <meshStandardMaterial color="#111" roughness={0} metalness={0.9} />
            </mesh>

            {/* Kính bên hông */}
            <mesh position={[0.71, 0.2, 0]}>
                <boxGeometry args={[0.1, 0.8, 2.5]} />
                <meshStandardMaterial color="#111" roughness={0} metalness={0.9} />
            </mesh>
            <mesh position={[-0.71, 0.2, 0]}>
                <boxGeometry args={[0.1, 0.8, 2.5]} />
                <meshStandardMaterial color="#111" roughness={0} metalness={0.9} />
            </mesh>

            {/* Đèn pha */}
            <mesh position={[0.4, -0.5, 1.62]}>
                <sphereGeometry args={[0.1]} />
                <meshStandardMaterial color="white" emissive="white" emissiveIntensity={2} />
            </mesh>
             <mesh position={[-0.4, -0.5, 1.62]}>
                <sphereGeometry args={[0.1]} />
                <meshStandardMaterial color="white" emissive="white" emissiveIntensity={2} />
            </mesh>

             {/* Họa tiết trang trí (Sọc xanh) */}
             <mesh position={[0, -0.6, 0]}>
                 <boxGeometry args={[1.42, 0.2, 3]} />
                 <meshStandardMaterial color="#0088FF" />
             </mesh>
        </group>
      </group>
    </group>
  );
};

// --- 5. TRANG TRÍ MÔI TRƯỜNG ---
const Scenery = () => (
    <group>
        {/* Đất */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
          <planeGeometry args={[1000, 1000]} />
          <meshStandardMaterial color="#2d3a2d" />
        </mesh>
        
        {/* NHÀ GA (Chỉnh lại thấp xuống để không đụng tàu) */}
        <group position={[0, 0, 0]}>
            {/* Tòa nhà chính */}
            <mesh position={[5, 3, 0]}>
                <boxGeometry args={[6, 8, 15]} />
                <meshStandardMaterial color="#DDD" />
            </mesh>
            {/* Mái che (Hạ thấp xuống y=6 để tránh đường ray ở y=10) */}
            <mesh position={[3, 6, 0]}>
                 <boxGeometry args={[10, 0.2, 18]} />
                 <meshStandardMaterial color="#999" />
            </mesh>
            {/* Sàn đón khách (Tương ứng với đáy tàu) */}
            <mesh position={[3, 2, 0]}>
                 <boxGeometry args={[8, 0.2, 16]} />
                 <meshStandardMaterial color="#555" />
            </mesh>
        </group>

        {/* Cây cối */}
        {Array.from({ length: 30 }).map((_, i) => (
             <mesh key={i} position={[(Math.random()-0.5)*200, 0, (Math.random()-0.5)*200]}>
                <coneGeometry args={[2, 8, 8]} />
                <meshStandardMaterial color="#1a472a" />
            </mesh>
        ))}
    </group>
)

export default function SkywaySimulation() {
  const { speed, isMoving, cockpitView, autoRotate, lookX, lookY } = useControls("Skyway Panel", {
    speed: { value: 15, min: 0, max: 60, label: "Tốc độ" },
    isMoving: { value: true, label: "Chạy tàu" },
    cockpitView: { value: false, label: "Vào buồng lái" },
    lookX: { value: 0, min: -1, max: 1, label: "Xoay đầu" },
    lookY: { value: 0, min: -0.5, max: 0.5, label: "Nhìn cao/thấp" },
    autoRotate: { value: false, label: "Xoay cảnh" },
  });

  return (
    <div className="w-full h-screen bg-black">
      <Leva collapsed={false} />
      <Canvas shadows camera={{ position: [40, 30, 60], fov: 50 }}>
        <Environment preset="city" background blur={0.5} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[100, 100, 50]} intensity={1.5} castShadow />

        <CurvedTrussTrack />
        <SmartPillars />
        <Scenery />
        
        <Unicar 
          speed={speed} 
          isMoving={isMoving} 
          cockpitView={cockpitView} 
          lookX={lookX} 
          lookY={lookY}
        />

        {!cockpitView && <OrbitControls autoRotate={autoRotate} autoRotateSpeed={0.5} maxPolarAngle={Math.PI / 2.1} />}
      </Canvas>
    </div>
  );
}