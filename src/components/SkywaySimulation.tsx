// components/SkywaySimulation.tsx
"use client";

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sky, Stars, Grid } from "@react-three/drei";
import * as THREE from "three";

// 1. Component tạo đường ray (Rail) - Mảnh hơn để giống dây
const Rail = () => {
  return (
    <mesh position={[0, 4, 0]} rotation={[0, 0, 0]}> {/* Đưa lên cao độ y=4 */}
      <boxGeometry args={[40, 0.1, 0.2]} /> {/* Dài 40m, mỏng như dây */}
      <meshStandardMaterial color="#333" />
    </mesh>
  );
};

// 2. Component tạo Trụ đỡ (Pillars) - Đặc trưng Skyway
const Pillars = () => {
  // Tạo mảng vị trí các trụ (cách nhau 10m)
  const positions = [-15, -5, 5, 15]; 
  
  return (
    <>
      {positions.map((x, index) => (
        <group key={index} position={[x, 2, 0]}> {/* y=2 vì trụ cao 4m, tâm nằm ở 2 */}
          {/* Thân trụ */}
          <mesh>
            <cylinderGeometry args={[0.2, 0.3, 4, 32]} /> {/* Hình trụ: trên nhỏ, dưới to */}
            <meshStandardMaterial color="#888" />
          </mesh>
          {/* Chân đế trụ */}
          <mesh position={[0, -1.9, 0]}>
             <cylinderGeometry args={[0.5, 0.6, 0.2, 32]} />
             <meshStandardMaterial color="#555" />
          </mesh>
        </group>
      ))}
    </>
  );
};

// 3. Component xe uPod
const Upod = () => {
  const uPodRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (uPodRef.current) {
      const time = state.clock.getElapsedTime();
      // Xe chạy qua lại trên cao độ y=4 (bám theo ray)
      // Chạy chậm hơn và mượt hơn
      uPodRef.current.position.x = Math.sin(time * 0.5) * 15; 
      
      // Nghiêng xe nhẹ khi di chuyển để tạo cảm giác quán tính (Option nâng cao)
      uPodRef.current.rotation.z = Math.cos(time * 0.5) * 0.05;
    }
  });

  return (
    <group ref={uPodRef} position={[0, 4, 0]}> {/* Nhóm xe đặt ở độ cao ray */}
      {/* Thân xe bo tròn hơn */}
      <mesh>
        <boxGeometry args={[2.5, 1.2, 1]} />
        <meshStandardMaterial color="#00aaff" roughness={0.3} metalness={0.8} />
      </mesh>
      
      {/* Cửa kính xe (màu đen bóng) */}
      <mesh position={[0, 0.2, 0.51]}>
        <planeGeometry args={[2, 0.6]} />
        <meshStandardMaterial color="black" roughness={0.1} />
      </mesh>

      {/* Bánh xe treo (phần móc vào ray) */}
      <mesh position={[0, 0.7, 0]}>
         <boxGeometry args={[1, 0.4, 0.3]} />
         <meshStandardMaterial color="#333" />
      </mesh>
    </group>
  );
};

// 4. Component Mặt đất
const Ground = () => {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <planeGeometry args={[100, 100]} />
      {/* Màu cỏ xanh tối */}
      <meshStandardMaterial color="#1a472a" /> 
    </mesh>
  );
};

export default function SkywaySimulation() {
  return (
    <div className="w-full h-screen bg-black">
      <Canvas shadows camera={{ position: [8, 6, 12], fov: 45 }}>
        <color attach="background" args={['#111']} />
        
        {/* Ánh sáng */}
        <ambientLight intensity={0.7} />
        <spotLight position={[10, 20, 10]} angle={0.3} penumbra={1} intensity={1} castShadow />

        {/* Môi trường */}
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />
        <Grid infiniteGrid sectionSize={3} cellColor="#6f6f6f" sectionColor="#9d4b4b" fadeDistance={30} />

        {/* Các vật thể */}
        <Ground />
        <Pillars />
        <Rail />
        <Upod />

        <OrbitControls maxPolarAngle={Math.PI / 2.1} /> {/* Giới hạn không cho nhìn xuyên xuống dưới đất */}
      </Canvas>
    </div>
  );
}