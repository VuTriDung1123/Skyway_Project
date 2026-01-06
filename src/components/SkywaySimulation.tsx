// components/SkywaySimulation.tsx
"use client";

import React, { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment, Float, Text } from "@react-three/drei";
import { useControls, Leva, folder } from "leva";
import * as THREE from "three";

// --- 1. CẤU HÌNH TUYẾN ĐƯỜNG THẲNG (LINEAR TRACKS) ---

// Hàm tạo đường cong mở (không khép kín)
const createLinearCurve = (points: THREE.Vector3[]) => {
    // closed: false là chìa khóa cho tuyến A -> B
  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.2); 
};

// TUYẾN 1 (Xanh lá): KHU DÂN CƯ (Tây) ↔ TRUNG TÂM (Giữa)
const line1Points = [
  new THREE.Vector3(-250, 8, 0),   // A: Ga Dân Cư (Điểm đầu - 0%)
  new THREE.Vector3(-150, 8, 20),  // Điểm uốn
  new THREE.Vector3(-50, 10, -20), // Tiếp cận trung tâm
  new THREE.Vector3(0, 10, 0),     // B: Ga Trung Tâm 1 (Điểm cuối - 100%)
];
const line1Curve = createLinearCurve(line1Points);

// TUYẾN 2 (Xanh dương): CẢNG BIỂN (Đông) ↔ KHU CÔNG NGHIỆP (Đông Bắc)
const line2Points = [
  new THREE.Vector3(250, 15, 50),   // A: Ga Cảng Biển
  new THREE.Vector3(200, 15, 0),
  new THREE.Vector3(150, 12, -100),
  new THREE.Vector3(150, 12, -200), // B: Ga Công Nghiệp
];
const line2Curve = createLinearCurve(line2Points);

// TUYẾN 3 (Vàng): SÂN BAY (Nam) ↔ TRUNG TÂM (Giữa)
// Bố cục Sân bay: Đường băng (X=-50) | Nhà ga (X=0) | Ray Skyway (X=50) -> Chạy dọc trục Z
const line3Points = [
  new THREE.Vector3(0, 10, 0),      // A: Ga Trung Tâm 2
  new THREE.Vector3(30, 10, 50),
  new THREE.Vector3(50, 12, 150),   // Tiếp cận sân bay
  new THREE.Vector3(50, 12, 300),   // B: Ga Sân Bay (Chạy song song nhà ga)
];
const line3Curve = createLinearCurve(line3Points);

// --- CẤU HÌNH TRẠM DỪNG (Cập nhật theo tuyến thẳng) ---
// progress 0.0 là đầu A, 1.0 là đầu B
const STATION_DATA = [
    // Tuyến 1
    { lineId: 1, progress: 0.02, name: "Ga Dân Cư (A)" },
    { lineId: 1, progress: 0.98, name: "Ga Trung Tâm 1 (B)" },
    // Tuyến 2
    { lineId: 2, progress: 0.02, name: "Ga Cảng Biển (A)" },
    { lineId: 2, progress: 0.98, name: "Ga Công Nghiệp (B)" },
    // Tuyến 3
    { lineId: 3, progress: 0.02, name: "Ga Trung Tâm 2 (A)" },
    { lineId: 3, progress: 0.98, name: "Ga Sân Bay (B)" },
];

// --- COMPONENTS HIỂN THỊ ---

// Component Ga (Platform)
const StationPlatform = ({ curve, progress, name }: { curve: THREE.Curve<THREE.Vector3>, progress: number, name: string }) => {
    const position = useMemo(() => curve.getPointAt(progress), [curve, progress]);
    const tangent = useMemo(() => curve.getTangentAt(progress).normalize(), [curve, progress]);
    const angle = Math.atan2(tangent.x, tangent.z);

    return (
    <group position={position} rotation={[0, angle, 0]}>
        <mesh position={[0, -2.2, 0]}>
            <boxGeometry args={[12, 0.5, 20]} />
            <meshStandardMaterial color="#555" />
        </mesh>
        <mesh position={[0, 2.5, 0]}>
            <boxGeometry args={[12, 0.2, 20]} />
            <meshStandardMaterial color="#999" transparent opacity={0.9} />
        </mesh>
        <mesh position={[-5, 0, 9]}><cylinderGeometry args={[0.15, 0.15, 5]} /><meshStandardMaterial color="#777"/></mesh>
        <mesh position={[5, 0, 9]}><cylinderGeometry args={[0.15, 0.15, 5]} /><meshStandardMaterial color="#777"/></mesh>
        <mesh position={[-5, 0, -9]}><cylinderGeometry args={[0.15, 0.15, 5]} /><meshStandardMaterial color="#777"/></mesh>
        <mesh position={[5, 0, -9]}><cylinderGeometry args={[0.15, 0.15, 5]} /><meshStandardMaterial color="#777"/></mesh>
        <Text position={[0, 3.5, 0]} fontSize={3} color="white" anchorX="center" anchorY="middle" billboard>
            {name}
        </Text>
    </group>
)};

const RenderStations = () => (
    <>
        {STATION_DATA.map((station, i) => {
            let curve = station.lineId === 1 ? line1Curve : station.lineId === 2 ? line2Curve : line3Curve;
            return <StationPlatform key={i} curve={curve} progress={station.progress} name={station.name} />
        })}
    </>
)

const TrussTrack = ({ curve, color }: { curve: THREE.Curve<THREE.Vector3>, color: string }) => {
  const railGeometry = useMemo(() => new THREE.TubeGeometry(curve, 500, 0.15, 12, false), [curve]); // closed: false
  const struts = useMemo(() => {
    const items = [];
    const count = Math.floor(curve.getLength() / 1.5);
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

const Pillars = ({ curve, color }: { curve: THREE.Curve<THREE.Vector3>, color: string }) => {
  const pillarLocations = useMemo(() => {
    const locs = [];
    const count = Math.floor(curve.getLength() / 25); 
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const pos = curve.getPointAt(t);
      if (pos.y > 0) locs.push(pos); // Đặt cột ở mọi nơi trên đất liền
    }
    return locs;
  }, [curve]);

  return (
    <>
      {pillarLocations.map((pos, i) => (
        <group key={i} position={[pos.x, 0, pos.z]}>
            <mesh position={[3, pos.y / 2, 0]}><cylinderGeometry args={[0.5, 0.7, pos.y, 16]} /><meshStandardMaterial color={color} /></mesh>
            <mesh position={[1.5, pos.y + 1, 0]}><boxGeometry args={[3.5, 0.6, 0.6]} /><meshStandardMaterial color={color} /></mesh>
        </group>
      ))}
    </>
  );
};

// --- TÀU UNICAR CHẠY PING-PONG (A <-> B) ---
const UnicarPingPong = ({ lineId, curve, speed, isMoving, trainColor, stripeColor, isActiveCockpit, lookX, lookY }: any) => {
  const uPodRef = useRef<THREE.Group>(null);
  const progress = useRef(0.5); // Bắt đầu ở giữa
  const direction = useRef(1); // 1: đi tới, -1: đi lùi
  const trackLength = useMemo(() => curve.getLength(), [curve]);
  
  const [isStopped, setIsStopped] = useState(false);
  const stopTimer = useRef(0);
  const STOP_DURATION = 3; 

  useFrame((state, delta) => {
    if (!uPodRef.current || !isMoving) return;

    if (isStopped) {
        stopTimer.current += delta;
        if (stopTimer.current > STOP_DURATION) {
            setIsStopped(false);
            stopTimer.current = 0;
            // Đẩy nhẹ để thoát ga
            progress.current += direction.current * 0.01;
        }
        return; 
    }

    // Cập nhật tiến độ theo hướng
    progress.current += (speed * delta * direction.current) / trackLength;

    // Logic đảo chiều khi chạm đầu mút
    if (progress.current >= 1) {
        progress.current = 1;
        direction.current = -1; // Quay đầu
    } else if (progress.current <= 0) {
        progress.current = 0;
        direction.current = 1; // Quay đầu
    }

    const position = curve.getPointAt(progress.current);
    const tangent = curve.getTangentAt(progress.current).normalize();
    
    uPodRef.current.position.copy(position);
    
    // Xoay tàu theo hướng di chuyển (Nếu đi lùi thì nhìn ngược lại tangent)
    const lookAtPos = direction.current > 0 ? position.clone().add(tangent) : position.clone().sub(tangent);
    uPodRef.current.lookAt(lookAtPos);

    // Kiểm tra dừng trạm
    const myStations = STATION_DATA.filter(s => s.lineId === lineId);
    for (let station of myStations) {
        // Chỉ dừng ở 2 đầu ga A và B (gần 0 hoặc gần 1)
        if ((station.progress < 0.05 || station.progress > 0.95) && Math.abs(progress.current - station.progress) < 0.005) {
             setIsStopped(true);
             progress.current = station.progress;
        }
    }
  });

  return (
    <group ref={uPodRef}>
      {/* Camera buồng lái - Tự xoay theo tàu */}
      <PerspectiveCamera makeDefault={isActiveCockpit} position={[0, -1.5, 2.5]} rotation={[lookY, Math.PI + lookX, 0]} fov={80} near={0.1} />
      
      {/* Model Tàu - Xoay 180 độ để mặt tiền hướng về phía trước */}
      <group rotation={[0, Math.PI, 0]}>
        <group position={[0, -1.8, 0]}> 
            <mesh><boxGeometry args={[1.4, 1.6, 3.2]} /><meshStandardMaterial color={trainColor} /></mesh>
            <mesh position={[0, 0.1, 1.61]}><boxGeometry args={[1.2, 1, 0.1]} /><meshStandardMaterial color="#111" /></mesh>
            <mesh position={[0, -0.6, 0]}><boxGeometry args={[1.42, 0.2, 3]} /><meshStandardMaterial color="white" /></mesh>
        </group>
        <mesh position={[0, -0.6, 0]}><cylinderGeometry args={[0.15, 0.1, 1]} /><meshStandardMaterial color="#555" /></mesh>
        <group position={[0, 0, 0]}><mesh><boxGeometry args={[0.4, 0.3, 1.2]} /><meshStandardMaterial color="#333" /></mesh></group>
      </group>
    </group>
  );
};

// --- CÁC KHU VỰC (TÁCH BIỆT HOÀN TOÀN) ---

const CityCenterZone = () => (
    // Trung tâm ở gốc tọa độ (0,0)
    <group position={[0, 0, 0]}>
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.1, 0]}><planeGeometry args={[100, 100]} /><meshStandardMaterial color="#444" /></mesh>
        {[...Array(20)].map((_, i) => (
            <mesh key={i} position={[(Math.random()-0.5)*80, 15 + Math.random()*15, (Math.random()-0.5)*80]}>
                <boxGeometry args={[6, 30 + Math.random()*30, 6]} />
                <meshStandardMaterial color={`hsl(210, ${30+Math.random()*20}%, 40%)`} />
            </mesh>
        ))}
    </group>
)

const ResidentialZone = () => (
    // Khu Dân Cư: Rất xa về phía Tây (X = -250)
    <group position={[-250, 0, 0]}>
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.1, 0]}><planeGeometry args={[150, 150]} /><meshStandardMaterial color="#7cfc00" /></mesh>
        {[...Array(50)].map((_, i) => (
             <group key={i} position={[(Math.random()-0.5)*140, 0, (Math.random()-0.5)*140]}>
                 <mesh position={[0, 2, 0]}><boxGeometry args={[4, 4, 4]} /><meshStandardMaterial color="#F5DEB3" /></mesh>
                 <mesh position={[0, 5, 0]} rotation={[0, Math.PI/4, 0]}><coneGeometry args={[3.5, 2, 4]} /><meshStandardMaterial color="#A52A2A" /></mesh>
             </group>
        ))}
    </group>
)

const IndustryZone = () => (
    // Khu Công Nghiệp: Xa về phía Đông Bắc (X=150, Z=-200)
    <group position={[150, 0, -200]}>
         <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.1, 0]}><planeGeometry args={[120, 120]} /><meshStandardMaterial color="#555" /></mesh>
         {[...Array(20)].map((_, i) => (
            <mesh key={i} position={[(Math.random()-0.5)*100, 6, (Math.random()-0.5)*100]}>
                <boxGeometry args={[12, 12, 20]} /><meshStandardMaterial color={i%2==0 ? "#8B4513" : "#556B2F"} />
            </mesh>
         ))}
    </group>
)

const AirportZone = () => (
    // Sân Bay: Xa về phía Nam (Z=250). Bố cục: Băng(T) - Nhà(G) - Ray(P)
    <group position={[0, 0, 250]}>
         <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.1, 0]}><planeGeometry args={[200, 300]} /><meshStandardMaterial color="#333" /></mesh>
         
         {/* 1. Đường băng (Bên Trái - X=-50) */}
         <mesh rotation={[-Math.PI/2, 0, 0]} position={[-50, 0.15, 0]}><planeGeometry args={[40, 280]} /><meshStandardMaterial color="#111" /></mesh>
         
         {/* 2. Nhà ga Terminal (Ở Giữa - X=0) */}
         <group position={[0, 0, 0]}>
             <mesh position={[0, 8, 0]}><boxGeometry args={[40, 16, 200]} /><meshStandardMaterial color="#ddd" /></mesh>
             <Text position={[21, 14, 0]} fontSize={8} color="red" rotation={[0, Math.PI/2, 0]}>AIRPORT TERMINAL</Text>
         </group>

         {/* 3. Đường ray Skyway (Bên Phải - X=50) -> Đã được định nghĩa trong line3Points */}

         {/* Máy bay */}
         <group position={[-50, 2, -100]}>
            <mesh><boxGeometry args={[10, 3, 30]} /><meshStandardMaterial color="white" /></mesh>
            <mesh position={[0, 2, 5]}><boxGeometry args={[30, 1, 8]} /><meshStandardMaterial color="white" /></mesh>
         </group>
    </group>
)

const PortZone = () => (
    // Cảng Biển: Xa về phía Đông (X=250)
    <group position={[250, 0, 50]}>
         <mesh rotation={[-Math.PI/2, 0, 0]} position={[50, -0.5, 0]}><planeGeometry args={[150, 150]} /><meshStandardMaterial color="#006994" /></mesh>
         <mesh position={[-20, 1, 0]}><boxGeometry args={[40, 2, 150]} /><meshStandardMaterial color="#888" /></mesh>
         <group position={[-20, 0, -40]}>
            <mesh position={[0, 15, 0]}><cylinderGeometry args={[1, 1, 30]} /><meshStandardMaterial color="yellow" /></mesh>
            <mesh position={[15, 28, 0]}><boxGeometry args={[30, 2, 2]} /><meshStandardMaterial color="yellow" /></mesh>
         </group>
    </group>
)

const KeyboardCameraControls = ({ active }: { active: boolean }) => {
  const { camera } = useThree();
  const [movement, setMovement] = useState({ f: false, b: false, l: false, r: false, u: false, d: false });
  useEffect(() => {
    if (!active) return;
    const down = (e: KeyboardEvent) => {
       if(e.key === 'w') setMovement(m => ({...m, f: true})); if(e.key === 's') setMovement(m => ({...m, b: true}));
       if(e.key === 'a') setMovement(m => ({...m, l: true})); if(e.key === 'd') setMovement(m => ({...m, r: true}));
       if(e.key === 'q') setMovement(m => ({...m, u: true})); if(e.key === 'e') setMovement(m => ({...m, d: true}));
    }
    const up = (e: KeyboardEvent) => {
       if(e.key === 'w') setMovement(m => ({...m, f: false})); if(e.key === 's') setMovement(m => ({...m, b: false}));
       if(e.key === 'a') setMovement(m => ({...m, l: false})); if(e.key === 'd') setMovement(m => ({...m, r: false}));
       if(e.key === 'q') setMovement(m => ({...m, u: false})); if(e.key === 'e') setMovement(m => ({...m, d: false}));
    }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); }
  }, [active]);
  useFrame(() => {
    if(!active) return;
    const speed = 5; 
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    const side = new THREE.Vector3().crossVectors(camera.up, dir).normalize();
    if(movement.f) camera.position.addScaledVector(dir, speed); if(movement.b) camera.position.addScaledVector(dir, -speed);
    if(movement.l) camera.position.addScaledVector(side, speed); if(movement.r) camera.position.addScaledVector(side, -speed);
    if(movement.u) camera.position.y += speed; if(movement.d) camera.position.y -= speed;
  });
  return null;
}

export default function SkywaySimulation() {
  const { speed, activeCockpit, autoRotate, wasd } = useControls("Skyway Master Control", {
    speed: { value: 50, min: 0, max: 150, label: "Tốc độ chung" },
    activeCockpit: { options: { 'Không': 0, 'Tuyến 1': 1, 'Tuyến 2': 2, 'Tuyến 3': 3 }, label: "Buồng lái số:" },
    autoRotate: { value: false, label: "Xoay cảnh" },
    wasd: { value: false, label: "🎮 Điều khiển WASD" }
  });
  const lookX = 0; const lookY = 0; 

  return (
    <div className="w-full h-screen bg-black">
      <Leva collapsed={false} />
      <Canvas shadows camera={{ position: [0, 300, 500], fov: 60, far: 4000 }}>
        <Environment preset="city" background blur={0.6} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[200, 300, 200]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} />
        <fog attach="fog" args={['#ccc', 1000, 4000]} />

        {/* 3 Tuyến tàu chạy Ping-Pong */}
        <TrussTrack curve={line1Curve} color="#558855" />
        <Pillars curve={line1Curve} color="#77AA77" />
        <UnicarPingPong lineId={1} curve={line1Curve} speed={speed} isMoving={true} trainColor="#2E8B57" isActiveCockpit={activeCockpit === 1} lookX={lookX} lookY={lookY} />

        <TrussTrack curve={line2Curve} color="#4682B4" />
        <Pillars curve={line2Curve} color="#5F9EA0" />
        <UnicarPingPong lineId={2} curve={line2Curve} speed={speed} isMoving={true} trainColor="#1E90FF" isActiveCockpit={activeCockpit === 2} lookX={lookX} lookY={lookY} />

        <TrussTrack curve={line3Curve} color="#DAA520" />
        <Pillars curve={line3Curve} color="#F0E68C" />
        <UnicarPingPong lineId={3} curve={line3Curve} speed={speed} isMoving={true} trainColor="#FFA500" isActiveCockpit={activeCockpit === 3} lookX={lookX} lookY={lookY} />

        <RenderStations />

        {/* Các khu vực đã được tách xa và cố định vị trí */}
        <CityCenterZone />
        <ResidentialZone />
        <IndustryZone />
        <AirportZone />
        <PortZone />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
          <planeGeometry args={[4000, 4000]} />
          <meshStandardMaterial color="#222" />
        </mesh>

        <KeyboardCameraControls active={wasd && activeCockpit === 0} />
        {activeCockpit === 0 && !wasd && <OrbitControls autoRotate={autoRotate} maxDistance={1500} />}
      </Canvas>
    </div>
  );
}