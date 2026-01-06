// components/SkywaySimulation.tsx
"use client";

import React, { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sky, Stars, PerspectiveCamera, Environment } from "@react-three/drei";
import { useControls, Leva } from "leva";
import * as THREE from "three";

// --- 1. CẤU TRÚC GIÀN THÉP (TRUSS TRACK) ---
// Tạo một đoạn giàn thép mẫu
const TrussSegment = ({ position }: { position: [number, number, number] }) => {
  const trussMaterial = new THREE.MeshStandardMaterial({ color: "#557788", metalness: 0.6, roughness: 0.2 });
  const length = 10; // Độ dài mỗi đoạn
  const height = 1.5; // Chiều cao giàn
  const width = 1;    // Chiều rộng giàn

  return (
    <group position={position}>
      {/* Thanh chủ (Chord) trên và dưới */}
      <mesh position={[0, height / 2, 0]} material={trussMaterial}><boxGeometry args={[width, 0.2, length]} /></mesh>
      <mesh position={[0, -height / 2, 0]} material={trussMaterial}><boxGeometry args={[width, 0.2, length]} /></mesh>
      
      {/* Đường ray treo tàu (nằm dưới đáy) */}
      <mesh position={[0, -height / 2 - 0.15, 0]} material={trussMaterial}>
          <boxGeometry args={[0.3, 0.1, length]} />
      </mesh>

      {/* Các thanh chống đứng (Vertical posts) */}
      {[-length / 2, 0, length / 2].map((z, i) => (
        <React.Fragment key={i}>
          <mesh position={[-width / 2 + 0.1, 0, z]} material={trussMaterial}><boxGeometry args={[0.2, height, 0.2]} /></mesh>
          <mesh position={[width / 2 - 0.1, 0, z]} material={trussMaterial}><boxGeometry args={[0.2, height, 0.2]} /></mesh>
        </React.Fragment>
      ))}
      
      {/* Các thanh chéo (Diagonal braces) - Tạo hình ziczac */}
      <mesh position={[width/2 - 0.1, 0, 0]} rotation={[Math.PI/4, 0, 0]} material={trussMaterial}><boxGeometry args={[0.15, height * 1.4, 0.15]} /></mesh>
      <mesh position={[width/2 - 0.1, 0, 0]} rotation={[-Math.PI/4, 0, 0]} material={trussMaterial}><boxGeometry args={[0.15, height * 1.4, 0.15]} /></mesh>
       <mesh position={[-width/2 + 0.1, 0, 0]} rotation={[Math.PI/4, 0, 0]} material={trussMaterial}><boxGeometry args={[0.15, height * 1.4, 0.15]} /></mesh>
      <mesh position={[-width/2 + 0.1, 0, 0]} rotation={[-Math.PI/4, 0, 0]} material={trussMaterial}><boxGeometry args={[0.15, height * 1.4, 0.15]} /></mesh>
    </group>
  );
};

// Tạo toàn bộ đường ray từ các đoạn giàn
const FullTrack = () => {
  // Tạo 20 đoạn, tổng chiều dài 200m
  const segments = Array.from({ length: 20 }, (_, i) => (
    <TrussSegment key={i} position={[0, 10, (i - 9.5) * 10]} />
  ));
  return <group>{segments}</group>;
};


// --- 2. CỘT ĐỠ DẠNG CHỮ T NGƯỢC (SUPPORT PILLARS) ---
const Pillars = () => {
  // Đặt trụ cách nhau 40m
  const positions = [-80, -40, 0, 40, 80];
  const pillarMaterial = new THREE.MeshStandardMaterial({ color: "#8899AA" });

  return (
    <>
      {positions.map((z, i) => (
        <group key={i} position={[0, 0, z]}>
          {/* Thân trụ chính (lệch sang một bên để không cản tàu) */}
          <mesh position={[3, 5, 0]} material={pillarMaterial}>
            <cylinderGeometry args={[0.6, 0.8, 10, 32]} />
          </mesh>
          {/* Đế trụ */}
          <mesh position={[3, 0.2, 0]} material={pillarMaterial}>
            <cylinderGeometry args={[1.2, 1.5, 0.4, 32]} />
          </mesh>
          
          {/* Xà ngang (Cánh tay đòn) đỡ đường ray giàn */}
          <mesh position={[0, 9.8, 0]} material={pillarMaterial}>
              <boxGeometry args={[7, 0.8, 1.5]} />
          </mesh>
          {/* Khớp nối giữa xà ngang và giàn */}
           <mesh position={[0, 10.2, 0]} material={pillarMaterial}>
              <boxGeometry args={[1.2, 0.6, 1.2]} />
          </mesh>
        </group>
      ))}
    </>
  );
};


// --- 3. uPod TREO (HANGING uPod) ---
const HangingUpod = ({ speed, isMoving, cockpitView, lookX, lookY }: any) => {
  const uPodRef = useRef<THREE.Group>(null);
  // Giới hạn di chuyển trong khoảng z từ -90 đến 90
  const zPosition = useRef(0);

  useFrame((state, delta) => {
    if (uPodRef.current && isMoving) {
        // Di chuyển qua lại
        zPosition.current += speed * delta * 0.5 * Math.sign(Math.sin(state.clock.elapsedTime * 0.2));
        // Giới hạn phạm vi
        zPosition.current = Math.max(-90, Math.min(90, zPosition.current));

        // Đặt vị trí: x=0, y=9 (treo dưới giàn cao 10), z thay đổi
        uPodRef.current.position.set(0, 9, zPosition.current);
        
        // Xoay đầu xe theo hướng di chuyển
        const direction = Math.sign(Math.sin(state.clock.elapsedTime * 0.2));
        uPodRef.current.rotation.y = direction > 0 ? 0 : Math.PI;
    }
  });

  return (
    <group ref={uPodRef}>
      <PerspectiveCamera 
        makeDefault={cockpitView} 
        position={[0, 0, 1.8]} // Ngồi ở đầu xe
        rotation={[lookY, lookX, 0]} 
        fov={80} near={0.1}
      />

      {/* Thân xe (Màu xanh ngọc giống ảnh) */}
      <mesh position={[0, -0.8, 0]}> {/* Hạ thấp trọng tâm */}
        <boxGeometry args={[2.2, 1.4, 3]} />
        <meshStandardMaterial color="#00A896" roughness={0.2} metalness={0.4} />
      </mesh>
      {/* Kính trước */}
      <mesh position={[0, -0.6, 1.51]}>
        <planeGeometry args={[2, 0.8]} />
        <meshStandardMaterial color="#111" roughness={0} metalness={1} opacity={0.9} transparent />
      </mesh>
      
      {/* HỆ THỐNG TREO (Suspension System) */}
      {/* Thanh kết nối chính */}
      <mesh position={[0, 0.1, 0]}>
         <boxGeometry args={[0.4, 0.8, 1.5]} />
         <meshStandardMaterial color="#444" />
      </mesh>
      {/* Bánh xe/Con lăn ôm vào đường ray (tượng trưng) */}
      <group position={[0, 0.5, 0]}>
          <mesh position={[0.2, 0, 0.5]} rotation={[0,0,Math.PI/2]}>
              <cylinderGeometry args={[0.15, 0.15, 0.1]} /><meshStandardMaterial color="#222"/>
          </mesh>
           <mesh position={[-0.2, 0, 0.5]} rotation={[0,0,Math.PI/2]}>
              <cylinderGeometry args={[0.15, 0.15, 0.1]} /><meshStandardMaterial color="#222"/>
          </mesh>
           <mesh position={[0.2, 0, -0.5]} rotation={[0,0,Math.PI/2]}>
              <cylinderGeometry args={[0.15, 0.15, 0.1]} /><meshStandardMaterial color="#222"/>
          </mesh>
           <mesh position={[-0.2, 0, -0.5]} rotation={[0,0,Math.PI/2]}>
              <cylinderGeometry args={[0.15, 0.15, 0.1]} /><meshStandardMaterial color="#222"/>
          </mesh>
      </group>
    </group>
  );
};

// --- MÔI TRƯỜNG ---
const EnvironmentScenery = () => (
    <>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[500, 500]} />
          <meshStandardMaterial color="#3A5A40" /> // Màu cỏ
        </mesh>
         {/* Vài cái cây đơn giản ở xa */}
        {[...Array(20)].map((_, i) => (
            <mesh key={i} position={[(Math.random()-0.5)*200, 5, (Math.random()-0.5)*200]}>
                <coneGeometry args={[3, 10, 8]} />
                <meshStandardMaterial color="#2D4F30" />
            </mesh>
        ))}
    </>
)


// --- MAIN ---
export default function SkywaySimulation() {
  const { speed, isMoving, cockpitView, autoRotate, lookX, lookY } = useControls("Skyway Controller", {
    speed: { value: 10, min: 0, max: 30, label: "🚀 Tốc độ" },
    isMoving: { value: true, label: "▶ Chạy tàu" },
    cockpitView: { value: false, label: "🎥 Vào Buồng Lái" },
    lookX: { value: 0, min: -1, max: 1, label: "👀 Quay Trái/Phải" },
    lookY: { value: 0, min: -0.5, max: 0.5, label: "👀 Nhìn Lên/Xuống" },
    autoRotate: { value: false, label: "🔄 Tự động xoay cảnh" },
  });

  return (
    <div className="w-full h-screen bg-black">
      <Leva collapsed={false} />
      {/* Dùng ảnh môi trường (HDR) cho ánh sáng và nền trời đẹp hơn */}
      <Canvas shadows camera={{ position: [30, 20, 40], fov: 50 }}>
        <Environment preset="park" background blur={0.5} /> {/* Ánh sáng công viên tự nhiên */}
        <directionalLight position={[50, 50, 25]} intensity={2} castShadow />
        <ambientLight intensity={0.3} />

        <EnvironmentScenery />
        <FullTrack />
        <Pillars />
        
        <HangingUpod 
          speed={speed} 
          isMoving={isMoving} 
          cockpitView={cockpitView} 
          lookX={lookX} 
          lookY={lookY} 
        />

        {!cockpitView && <OrbitControls autoRotate={autoRotate} autoRotateSpeed={1} maxPolarAngle={Math.PI / 2.1} />}
      </Canvas>
    </div>
  );
}