// components/SkywaySimulation.tsx
"use client"; // Bắt buộc vì đây là Client Component

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sky, Stars } from "@react-three/drei";
import * as THREE from "three";

// 1. Component tạo đường ray (Rail)
const Rail = () => {
  return (
    <mesh position={[0, -1, 0]} rotation={[0, 0, 0]}>
      {/* Tạo một khối hộp dài làm đường ray */}
      <boxGeometry args={[20, 0.2, 0.5]} /> 
      <meshStandardMaterial color="#555" metallic={0.8} roughness={0.2} />
    </mesh>
  );
};

// 2. Component tạo uPod (Xe chạy)
const Upod = () => {
  const uPodRef = useRef<THREE.Mesh>(null);

  // useFrame chạy 60 lần/giây (vòng lặp render)
  useFrame((state, delta) => {
    if (uPodRef.current) {
      // Logic di chuyển: Dùng hàm sin để xe chạy qua lại
      // state.clock.elapsedTime là thời gian trôi qua
      const time = state.clock.getElapsedTime();
      
      // Di chuyển trục X từ -8 đến 8
      uPodRef.current.position.x = Math.sin(time) * 8; 
    }
  });

  return (
    <mesh ref={uPodRef} position={[0, 0, 0]}>
      {/* Thân xe là khối hộp màu xanh */}
      <boxGeometry args={[2, 1, 1]} />
      <meshStandardMaterial color="#00aaff" />
      
      {/* Trang trí thêm: 2 cái đèn pha nhỏ phía trước/sau */}
      <mesh position={[0.9, 0, 0]}>
         <boxGeometry args={[0.2, 0.5, 0.8]} />
         <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} />
      </mesh>
    </mesh>
  );
};

// 3. Component chính tổng hợp Scene
export default function SkywaySimulation() {
  return (
    <div className="w-full h-screen bg-black">
      <Canvas camera={{ position: [5, 5, 10], fov: 50 }}>
        {/* Ánh sáng môi trường */}
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />

        {/* Bầu trời và Sao */}
        <Sky sunPosition={[100, 20, 100]} turbidity={0.5} rayleigh={0.5} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />

        {/* Các vật thể trong game */}
        <Rail />
        <Upod />

        {/* Camera Control: Cho phép xoay, zoom bằng chuột */}
        <OrbitControls 
            enablePan={true} 
            enableZoom={true} 
            enableRotate={true}
            autoRotate={false} // Đặt true nếu muốn camera tự quay quanh cảnh
        />
        
        {/* Hiển thị trục tọa độ để dễ hình dung (X: Đỏ, Y: Xanh lá, Z: Xanh dương) */}
        <axesHelper args={[5]} />
      </Canvas>
    </div>
  );
}