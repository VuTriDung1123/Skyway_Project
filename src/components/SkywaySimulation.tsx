// components/SkywaySimulation.tsx
"use client";

import React, { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment, Float } from "@react-three/drei";
import { useControls, Leva, folder } from "leva";
import * as THREE from "three";

// --- ĐỊNH NGHĨA LẠI CÁC TUYẾN ĐƯỜNG (TRUNK LINES) ---

// TUYẾN 1 (Xanh lá): DÂN CƯ ↔ TRUNG TÂM (Né tòa nhà trung tâm)
const line1Points = [
  new THREE.Vector3(-20, 15, -20), // Xuất phát cạnh trung tâm
  new THREE.Vector3(-40, 15, -80), // Đi ra ngoại ô
  new THREE.Vector3(-80, 10, -150), // Trạm Khu dân cư
  new THREE.Vector3(-120, 10, -100), // Vòng lại
  new THREE.Vector3(-60, 15, -40),   // Về lại hướng trung tâm
];
const line1Curve = new THREE.CatmullRomCurve3(line1Points, true, 'catmullrom', 0.3);

// TUYẾN 2 (Xanh dương): CẢNG BIỂN ↔ KHU CÔNG NGHIỆP (Tiếp cận sát trạm)
const line2Points = [
  new THREE.Vector3(160, 18, 60),   // Trạm Cảng biển (Sát cầu cảng)
  new THREE.Vector3(180, 18, 0),    // Đi dọc bờ
  new THREE.Vector3(200, 15, -80),  // Trạm Khu công nghiệp (Giữa các nhà máy)
  new THREE.Vector3(150, 15, -100), // Vòng ra sau khu công nghiệp
  new THREE.Vector3(130, 18, 20),   // Về lại hướng cảng (trên mặt nước)
];
const line2Curve = new THREE.CatmullRomCurve3(line2Points, true, 'catmullrom', 0.2);

// TUYẾN 3 (Vàng): SÂN BAY ↔ TRUNG TÂM (Né đường băng, vào cửa nhà ga)
const line3Points = [
  new THREE.Vector3(20, 15, -20),   // Xuất phát cạnh trung tâm
  new THREE.Vector3(60, 18, 50),    // Hướng ra sân bay
  // Sân bay tâm tại [50, 0, 150]. Nhà ga lệch X=+50 => Tọa độ thế giới X=100.
  new THREE.Vector3(110, 15, 150),  // **TRẠM NHÀ GA SÂN BAY** (Trước cửa chính)
  new THREE.Vector3(120, 18, 200),  // Vòng ra sau nhà ga
  new THREE.Vector3(60, 18, 220),   // Vòng rộng né đường băng
  new THREE.Vector3(20, 15, 80),    // Về lại hướng trung tâm
];
const line3Curve = new THREE.CatmullRomCurve3(line3Points, true, 'catmullrom', 0.3);


// --- COMPONENT HỆ THỐNG ĐƯỜNG RAY (Dùng chung) ---
const TrussTrack = ({ curve, color }: { curve: THREE.Curve<THREE.Vector3>, color: string }) => {
  const railGeometry = useMemo(() => new THREE.TubeGeometry(curve, 400, 0.15, 8, true), [curve]);
  const struts = useMemo(() => {
    const items = [];
    // Tăng mật độ khung giàn lên một chút cho đẹp
    const count = Math.floor(curve.getLength() / 1.2); 
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const pos = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      const dummy = new THREE.Object3D();
      dummy.position.copy(pos);
      dummy.lookAt(pos.clone().add(tangent));
      items.push(
        <group key={i} position={[pos.x, pos.y + 0.6, pos.z]} rotation={dummy.rotation}>
           <mesh><boxGeometry args={[0.8, 1.2, 0.08]} /> <meshStandardMaterial color={color} /></mesh>
           <mesh position={[0, 0.6, 0]} rotation={[Math.PI/2, 0, 0]}><boxGeometry args={[0.05, 1.5, 0.05]} /><meshStandardMaterial color={color} /></mesh>
        </group>
      );
    }
    return items;
  }, [curve, color]);
  return <group><mesh geometry={railGeometry}><meshStandardMaterial color="#333" /></mesh>{struts}</group>;
};

// --- COMPONENT CỘT TRỤ (Dùng chung) ---
const Pillars = ({ curve, color, isLine2 = false }: { curve: THREE.Curve<THREE.Vector3>, color: string, isLine2?: boolean }) => {
  const pillarLocations = useMemo(() => {
    const locs = [];
    const count = Math.floor(curve.getLength() / 25); // Đặt cột dày hơn (mỗi 25m)
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const pos = curve.getPointAt(t);
      // Logic né nước: Nếu là Line 2 thì cho phép đặt cột dưới nước ở khu vực nhất định
      // Nếu không phải Line 2 thì không đặt ở khu vực nước (X > 100 và Z > 0)
      let canPlace = pos.y > 5;
      if (!isLine2 && pos.x > 100 && pos.z > 0) canPlace = false;

      if (canPlace) locs.push(pos);
    }
    return locs;
  }, [curve, isLine2]);

  return (
    <>
      {pillarLocations.map((pos, i) => (
        <group key={i} position={[pos.x, 0, pos.z]}>
            <mesh position={[3, pos.y / 2, 0]}><cylinderGeometry args={[0.5, 0.7, pos.y, 16]} /><meshStandardMaterial color={color} /></mesh>
            <mesh position={[1.5, pos.y + 1, 0]}><boxGeometry args={[3.5, 0.6, 0.6]} /><meshStandardMaterial color={color} /></mesh>
        </group>
      ))}
       {/* Cột trụ đặc biệt to hơn dưới biển cho Tuyến 2 (đã cập nhật vị trí mới) */}
       {isLine2 && (
         <>
          <mesh position={[135, 9, 30]}><cylinderGeometry args={[1.2, 1.2, 18, 32]} /> <meshStandardMaterial color="#666" /></mesh>
          <mesh position={[135, 19, 30]}><boxGeometry args={[7, 1.2, 1.5]} /> <meshStandardMaterial color="#666" /></mesh>
         </>
       )}
    </>
  );
};

// --- COMPONENT TÀU UNICAR (Dùng chung) ---
const Unicar = ({ curve, speed, isMoving, trainColor, stripeColor, isActiveCockpit, lookX, lookY }: any) => {
  const uPodRef = useRef<THREE.Group>(null);
  const progress = useRef(Math.random()); 
  const trackLength = useMemo(() => curve.getLength(), [curve]);

  useFrame((state, delta) => {
    if (uPodRef.current && isMoving) {
      progress.current = (progress.current + (speed * delta) / trackLength) % 1;
      const position = curve.getPointAt(progress.current);
      const tangent = curve.getTangentAt(progress.current).normalize();
      uPodRef.current.position.copy(position);
      uPodRef.current.lookAt(position.clone().add(tangent));
    }
  });

  return (
    <group ref={uPodRef}>
      <PerspectiveCamera makeDefault={isActiveCockpit} position={[0, -1.5, 2.5]} rotation={[lookY, Math.PI + lookX, 0]} fov={80} near={0.1} />
      <group rotation={[0, Math.PI, 0]}>
        <group position={[0, 0, 0]}><mesh><boxGeometry args={[0.4, 0.3, 1.2]} /><meshStandardMaterial color="#333" /></mesh></group>
        <mesh position={[0, -0.6, 0]}><cylinderGeometry args={[0.15, 0.1, 1]} /><meshStandardMaterial color="#555" /></mesh>
        <group position={[0, -1.8, 0]}> 
            <mesh><boxGeometry args={[1.4, 1.6, 3.2]} /><meshStandardMaterial color={trainColor} roughness={0.2} /></mesh>
            <mesh position={[0, 0.1, 1.61]}><boxGeometry args={[1.2, 1, 0.1]} /><meshStandardMaterial color="#111" roughness={0} metalness={0.9} /></mesh>
            <mesh position={[0.71, 0.2, 0]}><boxGeometry args={[0.1, 0.8, 2.5]} /><meshStandardMaterial color="#111" roughness={0} metalness={0.9} /></mesh>
            <mesh position={[-0.71, 0.2, 0]}><boxGeometry args={[0.1, 0.8, 2.5]} /><meshStandardMaterial color="#111" roughness={0} metalness={0.9} /></mesh>
            <mesh position={[0.4, -0.5, 1.62]}><sphereGeometry args={[0.1]} /><meshStandardMaterial color="white" emissive="white" emissiveIntensity={2} /></mesh>
            <mesh position={[-0.4, -0.5, 1.62]}><sphereGeometry args={[0.1]} /><meshStandardMaterial color="white" emissive="white" emissiveIntensity={2} /></mesh>
             <mesh position={[0, -0.6, 0]}><boxGeometry args={[1.42, 0.2, 3]} /><meshStandardMaterial color={stripeColor} /></mesh>
        </group>
      </group>
    </group>
  );
};

// --- CÁC KHU VỰC CHỨC NĂNG (GIỮ NGUYÊN VỊ TRÍ CŨ) ---
const CityCenter = () => (
    <group position={[0, 0, 0]}>
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.1, 0]}><planeGeometry args={[80, 80]} /><meshStandardMaterial color="#444" /></mesh>
        {[...Array(15)].map((_, i) => (
            <mesh key={i} position={[(Math.random()-0.5)*60, 15 + Math.random()*15, (Math.random()-0.5)*60]}>
                <boxGeometry args={[5 + Math.random()*5, 30 + Math.random()*30, 5 + Math.random()*5]} />
                <meshStandardMaterial color={`hsl(210, ${30 + Math.random()*20}%, ${30 + Math.random()*20}%)`} />
            </mesh>
        ))}
        <mesh position={[0, 8, 0]}><boxGeometry args={[20, 16, 10]} /><meshStandardMaterial color="#888" /></mesh>
    </group>
)

const ResidentialZone = () => (
    <group position={[-100, 0, -150]}>
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.1, 0]}><planeGeometry args={[100, 100]} /><meshStandardMaterial color="#7cfc00" /></mesh>
        {[...Array(25)].map((_, i) => (
             <group key={i} position={[(Math.random()-0.5)*80, 0, (Math.random()-0.5)*80]}>
                 <mesh position={[0, 2, 0]}><boxGeometry args={[4, 4, 4]} /><meshStandardMaterial color="#F5DEB3" /></mesh>
                 <mesh position={[0, 5, 0]} rotation={[0, Math.PI/4, 0]}><coneGeometry args={[3.5, 2, 4]} /><meshStandardMaterial color="#A52A2A" /></mesh>
             </group>
        ))}
        {[...Array(30)].map((_, i) => (
             <mesh key={i} position={[(Math.random()-0.5)*90, 0, (Math.random()-0.5)*90]}>
                <coneGeometry args={[1.5, 6, 8]} /><meshStandardMaterial color="green" />
            </mesh>
        ))}
    </group>
)

const AirportZone = () => (
    <group position={[50, 0, 150]}>
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.1, 0]}><planeGeometry args={[60, 200]} /><meshStandardMaterial color="#555" /></mesh>
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.11, 0]}><planeGeometry args={[2, 180]} /><meshStandardMaterial color="white" /></mesh>
        <group position={[50, 0, 0]}>
            <mesh position={[0, 6, 0]}><boxGeometry args={[30, 12, 60]} /><meshStandardMaterial color="#ddd" /></mesh>
            <mesh position={[-15, 4, 0]}><boxGeometry args={[10, 8, 40]} /><meshStandardMaterial color="#aaa" /></mesh>
        </group>
        <group position={[-40, 0, -50]}>
            <mesh position={[0, 8, 0]}><cylinderGeometry args={[1.5, 1.5, 16]} /><meshStandardMaterial color="#ddd" /></mesh>
            <mesh position={[0, 17, 0]}><cylinderGeometry args={[3, 2, 3]} /><meshStandardMaterial color="#333" /></mesh>
        </group>
        <Float speed={1.5} rotationIntensity={0.2} floatIntensity={1}>
            <group position={[-30, 30, 50]} rotation={[0.1, Math.PI, 0]}>
                 <mesh><boxGeometry args={[2, 1, 8]} /><meshStandardMaterial color="white" /></mesh>
                 <mesh position={[0, 0, 2]}><boxGeometry args={[8, 0.1, 2]} /><meshStandardMaterial color="white" /></mesh>
                 <mesh position={[0, 1, -3]}><boxGeometry args={[0.2, 2, 1]} /><meshStandardMaterial color="red" /></mesh>
            </group>
        </Float>
        <group position={[20, 1, -40]} rotation={[0, -Math.PI/2, 0]}>
                 <mesh><boxGeometry args={[2, 1, 8]} /><meshStandardMaterial color="white" /></mesh>
                 <mesh position={[0, 0, 2]}><boxGeometry args={[8, 0.1, 2]} /><meshStandardMaterial color="white" /></mesh>
                 <mesh position={[0, 1, -3]}><boxGeometry args={[0.2, 2, 1]} /><meshStandardMaterial color="blue" /></mesh>
        </group>
    </group>
)

const PortAndIndustryZone = () => (
    <group position={[150, 0, 0]}>
        <group position={[0, 0, 50]}>
             <mesh rotation={[-Math.PI/2, 0, 0]} position={[50, -0.5, 0]}><planeGeometry args={[100, 100]} /><meshStandardMaterial color="#006994" roughness={0.1} metalness={0.8} /></mesh>
            <mesh position={[0, 1, 0]}><boxGeometry args={[20, 2, 100]} /><meshStandardMaterial color="#777" /></mesh>
            <group position={[30, 1, 20]} rotation={[0, 0.2, 0]}>
                <mesh position={[0, 2, 0]}><boxGeometry args={[6, 4, 20]} /><meshStandardMaterial color="#8B0000" /></mesh>
                <mesh position={[0, 4.5, -6]}><boxGeometry args={[4, 3, 5]} /><meshStandardMaterial color="white" /></mesh>
                <mesh position={[0, 4.5, 4]}><boxGeometry args={[5, 2.5, 10]} /><meshStandardMaterial color="orange" /></mesh>
            </group>
            <group position={[0, 0, -20]}>
                <mesh position={[0, 12, 0]}><cylinderGeometry args={[0.8, 0.8, 24]} /><meshStandardMaterial color="yellow" /></mesh>
                <mesh position={[10, 22, 0]} rotation={[0, 0, -0.1]}><boxGeometry args={[25, 1.5, 1.5]} /><meshStandardMaterial color="yellow" /></mesh>
            </group>
        </group>
        <group position={[50, 0, -100]}>
            <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.1, 0]}><planeGeometry args={[100, 100]} /><meshStandardMaterial color="#555" /></mesh>
            {[...Array(10)].map((_, i) => (
                <mesh key={i} position={[(Math.random()-0.5)*80, 6, (Math.random()-0.5)*80]}><boxGeometry args={[15 + Math.random()*10, 12, 20 + Math.random()*10]} /><meshStandardMaterial color={Math.random() > 0.5 ? "#8B4513" : "#696969"} /></mesh>
            ))}
             {[...Array(5)].map((_, i) => (
                <mesh key={i} position={[(Math.random()-0.5)*80, 15, (Math.random()-0.5)*80]}><cylinderGeometry args={[1, 2, 30]} /><meshStandardMaterial color="#333" /></mesh>
            ))}
        </group>
    </group>
)

// --- COMPONENT ĐIỀU KHIỂN CAMERA BẰNG BÀN PHÍM (WASD) ---
const KeyboardCameraControls = ({ active }: { active: boolean }) => {
  const { camera } = useThree();
  const [movement, setMovement] = useState({ forward: false, backward: false, left: false, right: false });
  const speed = 2; // Tốc độ di chuyển camera

  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': setMovement(m => ({ ...m, forward: true })); break;
        case 'KeyS': case 'ArrowDown': setMovement(m => ({ ...m, backward: true })); break;
        case 'KeyA': case 'ArrowLeft': setMovement(m => ({ ...m, left: true })); break;
        case 'KeyD': case 'ArrowRight': setMovement(m => ({ ...m, right: true })); break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': setMovement(m => ({ ...m, forward: false })); break;
        case 'KeyS': case 'ArrowDown': setMovement(m => ({ ...m, backward: false })); break;
        case 'KeyA': case 'ArrowLeft': setMovement(m => ({ ...m, left: false })); break;
        case 'KeyD': case 'ArrowRight': setMovement(m => ({ ...m, right: false })); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [active]);

  useFrame(() => {
    if (!active) return;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0; // Giữ di chuyển trên mặt phẳng ngang
    direction.normalize();

    const sideways = new THREE.Vector3();
    sideways.crossVectors(camera.up, direction).normalize();

    if (movement.forward) camera.position.addScaledVector(direction, speed);
    if (movement.backward) camera.position.addScaledVector(direction, -speed);
    if (movement.left) camera.position.addScaledVector(sideways, speed);
    if (movement.right) camera.position.addScaledVector(sideways, -speed);
  });

  return null;
};


// --- MAIN APP ---
export default function SkywaySimulation() {
  const { speed1, move1, speed2, move2, speed3, move3, activeCockpit, lookX, lookY, autoRotate, useKeyboardCtrl } = useControls("Skyway Control Center", {
    'Tuyến 1 (Dân cư - Trung tâm)': folder({
        speed1: { value: 30, min: 0, max: 100, label: "Tốc độ" },
        move1: { value: true, label: "Chạy tàu" },
    }),
    'Tuyến 2 (Cảng - Công nghiệp)': folder({
        speed2: { value: 20, min: 0, max: 80, label: "Tốc độ" },
        move2: { value: true, label: "Chạy tàu" },
    }),
    'Tuyến 3 (Sân bay - Trung tâm)': folder({
        speed3: { value: 40, min: 0, max: 120, label: "Tốc độ" },
        move3: { value: true, label: "Chạy tàu" },
    }),
    'Góc nhìn & Camera': folder({
        activeCockpit: { options: { 'Không': 0, 'Tuyến 1': 1, 'Tuyến 2': 2, 'Tuyến 3': 3 }, label: "Buồng lái tàu số:" },
        lookX: { value: 0, min: -1.5, max: 1.5, label: "Quay đầu (Buồng lái)" },
        lookY: { value: 0, min: -0.5, max: 0.5, label: "Ngước nhìn (Buồng lái)" },
        useKeyboardCtrl: { value: false, label: "🎮 Điều khiển WASD" },
        autoRotate: { value: false, label: "Xoay toàn cảnh tự động" },
    })
  });

  const isOrbitActive = activeCockpit === 0 && !useKeyboardCtrl;

  return (
    <div className="w-full h-screen bg-black">
      <Leva collapsed={false} />
      <Canvas shadows camera={{ position: [0, 200, 400], fov: 50, far: 2500 }}>
        <Environment preset="city" background blur={0.6} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[200, 200, 100]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} />
        <fog attach="fog" args={['#ccc', 500, 2000]} />

        {/* --- HỆ THỐNG SKYWAY --- */}
        <TrussTrack curve={line1Curve} color="#558855" />
        <Pillars curve={line1Curve} color="#77AA77" />
        <Unicar curve={line1Curve} speed={speed1} isMoving={move1} trainColor="#ECECEC" stripeColor="#00FF00" isActiveCockpit={activeCockpit === 1} lookX={lookX} lookY={lookY} />

        <TrussTrack curve={line2Curve} color="#557799" />
        <Pillars curve={line2Curve} color="#7799BB" isLine2={true} />
        <Unicar curve={line2Curve} speed={speed2} isMoving={move2} trainColor="#ECECEC" stripeColor="#0000FF" isActiveCockpit={activeCockpit === 2} lookX={lookX} lookY={lookY} />

        <TrussTrack curve={line3Curve} color="#888855" />
        <Pillars curve={line3Curve} color="#AAAA77" />
        <Unicar curve={line3Curve} speed={speed3} isMoving={move3} trainColor="#ECECEC" stripeColor="#FFFF00" isActiveCockpit={activeCockpit === 3} lookX={lookX} lookY={lookY} />

        {/* --- CÁC KHU VỰC CHỨC NĂNG --- */}
        <CityCenter />
        <ResidentialZone />
        <AirportZone />
        <PortAndIndustryZone />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
          <planeGeometry args={[2500, 2500]} />
          <meshStandardMaterial color="#333" />
        </mesh>

        {/* Điều khiển Camera */}
        <KeyboardCameraControls active={useKeyboardCtrl && activeCockpit === 0} />
        {isOrbitActive && <OrbitControls autoRotate={autoRotate} autoRotateSpeed={0.3} maxPolarAngle={Math.PI / 2.1} maxDistance={1000} />}
      </Canvas>
    </div>
  );
}