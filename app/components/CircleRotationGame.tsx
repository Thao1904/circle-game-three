"use client";

import React, { useState, useEffect, useRef } from 'react';

export default function CircleRotationGame() {
  const [rotations, setRotations] = useState([0, 0, 0]);
  const [isWin, setIsWin] = useState(false);
  const [moves, setMoves] = useState(0);
  const [targetCircle, setTargetCircle] = useState(0);

  // Recording / upload state (from Old version)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordChunks, setRecordChunks] = useState<Blob[]>([]);
  const [uploadedRecordId, setUploadedRecordId] = useState<string | null>(null);

  // THEO DÕI VỊ TRÍ CHUỘT ĐỂ LÀM CUSTOM CURSOR
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const mouseDownTimerRef = useRef<number | null>(null);
  const inactivityTimerRef = useRef<number | null>(null);
  const winTimerRef = useRef<number | null>(null);

  const radius = 150;

  const circlePositions = [
    { x: 350, y: 150 },
    { x: 350 - radius, y: 150 + radius * Math.sqrt(3) },
    { x: 350 + radius, y: 150 + radius * Math.sqrt(3) },
  ];

  const rotationStep = 2;

  const dotAngles = [
    [-30, 30],
    [-30, 30],
    [-30, 30],
  ];

  // (hiện không dùng, nhưng giữ nếu sau muốn dùng target cụ thể)
  const correctAngles = [210, 330, 90];

  // ====== Recording functions (copied from CircleRotationGameOld) ======
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);
      setRecordChunks([]);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) setRecordChunks((prev) => [...prev, e.data]);
      };
      recorder.start();
      console.log("Recording started");
    } catch (error) {
      console.error("Cannot start recording", error);
    }
  };

  const stopRecordingAndUpload = () => {
    if (!mediaRecorder) return;

    const recorder = mediaRecorder;
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = async () => {
      try {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        console.log('Final blob size (bytes):', blob.size);
        const file = new File([blob], `record_${Date.now()}.webm`, { type: 'audio/webm' });

        console.log('Uploading file size (bytes):', file.size, 'name:', file.name);

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/upload-audio', {
          method: 'POST',
          body: formData,
        });

        const result = await res.json();
        if (result.success) {
          console.log('Uploaded successfully:', result.url);
          fetch('http://localhost:3001/send', {
            method: 'POST',
            body: JSON.stringify({ command: 'WIN' }),
            headers: { 'Content-Type': 'application/json' },
          }).catch((err) => console.error('Error sending WIN command', err));
          if (result.id) setUploadedRecordId(result.id);
        } else {
          console.error('Upload failed:', result.error);
        }
      } catch (err) {
        console.error('Upload error', err);
      }
    };

    recorder.stop();
    console.log('Recording stopped');
  };
  // ======================================================================

  const getDotPosition = (
    centerX: number,
    centerY: number,
    angle: number,
    rotation: number,
  ): { x: number; y: number } => {
    const totalAngle = (angle + rotation - 90) * Math.PI / 180;
    return {
      x: centerX + Math.cos(totalAngle) * radius,
      y: centerY + Math.sin(totalAngle) * radius,
    };
  };

  const checkWin = () => {
      const allDots: { x: number; y: number; circleIndex: number; dotIndex: number }[] = [];

    circlePositions.forEach((pos, circleIndex) => {
      dotAngles[circleIndex].forEach((angle, dotIndex) => {
        const dotPos = getDotPosition(pos.x, pos.y, angle, rotations[circleIndex]);
        allDots.push({
          ...dotPos,
          circleIndex,
          dotIndex,
        });
      });
    });

    const tolerance = 0.5;
    const touchingPairs = [];

    for (let i = 0; i < allDots.length; i++) {
      for (let j = i + 1; j < allDots.length; j++) {
        if (allDots[i].circleIndex !== allDots[j].circleIndex) {
          const distance = Math.sqrt(
            Math.pow(allDots[i].x - allDots[j].x, 2) +
            Math.pow(allDots[i].y - allDots[j].y, 2),
          );

          if (distance < tolerance) {
            touchingPairs.push({
              circle1: allDots[i].circleIndex,
              circle2: allDots[j].circleIndex,
            });
          }
        }
      }
    }

    const hasConnection01 = touchingPairs.some(
      (p) =>
        (p.circle1 === 0 && p.circle2 === 1) ||
        (p.circle1 === 1 && p.circle2 === 0),
    );
    const hasConnection12 = touchingPairs.some(
      (p) =>
        (p.circle1 === 1 && p.circle2 === 2) ||
        (p.circle1 === 2 && p.circle2 === 1),
    );
    const hasConnection20 = touchingPairs.some(
      (p) =>
        (p.circle1 === 2 && p.circle2 === 0) ||
        (p.circle1 === 0 && p.circle2 === 2),
    );

    return hasConnection01 && hasConnection12 && hasConnection20;
  };

  // CẬP NHẬT TRẠNG THÁI THẮNG
  useEffect(() => {
    setIsWin(checkWin());
  }, [rotations]);

  // GỌI /win KHI THẮNG (DELAY 5 GIÂY)
useEffect(() => {
  if (isWin) {
    const timer = setTimeout(() => {
      // preserve original behavior: call existing /win endpoint
      fetch('http://localhost:3001/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command: "WIN" }),
      }).catch((err) => {
        console.error('Error calling /win:', err);
      });

      // stop recording and upload
      stopRecordingAndUpload();
    }, 5000); // ⏳ 5 giây

    // cleanup nếu rời trang hoặc win reset lại
    return () => clearTimeout(timer);
  }
}, [isWin]);

  // TỰ RESET SAU KHI THẮNG 120 GIÂY
  useEffect(() => {
    if (isWin) {
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current);
      }

      winTimerRef.current = window.setTimeout(() => {
        reset();
      }, 360000); // 360s sau khi win thì reset
    } else {
      if (winTimerRef.current) {
        window.clearTimeout(winTimerRef.current);
      }
    }

    return () => {
      if (winTimerRef.current) {
        window.clearTimeout(winTimerRef.current);
      }
    };
  }, [isWin]);

  const reset = () => {
    setRotations([
      Math.floor(Math.random() * 180) * 2,
      Math.floor(Math.random() * 180) * 2,
      Math.floor(Math.random() * 180) * 2,
    ]);
    setIsWin(false);
    setMoves(0);
    setTargetCircle(0);

    // start recording when game resets (Old behavior)
    startRecording();

    // use Old's send endpoint to notify external service of RESET
    fetch('http://localhost:3001/send', {
      method: 'POST',
      body: JSON.stringify({ command: 'RESET' }),
      headers: { 'Content-Type': 'application/json' },
    }).catch((err) => {
      console.error('Error calling /send RESET:', err);
    });
  };

  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current);
    }

    inactivityTimerRef.current = window.setTimeout(() => {
      reset();
    }, 10000); // 10s không activity thì reset
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY;
    const direction = delta > 0 ? 1 : -1;

    setRotations((prev) => {
      const newRotations = [...prev];
      const current = newRotations[targetCircle] ?? 0;

      let newRotation = current + direction * rotationStep;
      newRotation = Math.round(newRotation / rotationStep) * rotationStep;
      newRotation = (newRotation + 360) % 360;

      if (newRotation !== current) {
        newRotations[targetCircle] = newRotation;
        setMoves((m) => m + 1);
      }
      return newRotations;
    });

    resetInactivityTimer();
  };

  const handleLeftClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 0) {
      setTargetCircle((prev) => (prev + 1) % 3);
      resetInactivityTimer();
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 0) {
      // setTimeout in browsers returns a number
      mouseDownTimerRef.current = window.setTimeout(() => {
        reset();
      }, 5000); // giữ chuột 5s thì reset
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 0 && mouseDownTimerRef.current) {
      window.clearTimeout(mouseDownTimerRef.current);
      mouseDownTimerRef.current = null;
    }
  };

  // TRACK VỊ TRÍ CHUỘT ĐỂ VẼ CUSTOM CURSOR
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // DỌN DẸP TIMER KHI UNMOUNT
  useEffect(() => {
    return () => {
      if (mouseDownTimerRef.current) {
        window.clearTimeout(mouseDownTimerRef.current);
      }
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current);
      }
      if (winTimerRef.current) {
        window.clearTimeout(winTimerRef.current);
      }
    };
  }, []);

  // BẮT ĐẦU ĐẾM INACTIVITY NGAY LÚC LOAD
  useEffect(() => {
    resetInactivityTimer();
  }, []);

  // Auto-start game on mount (Old behavior: call reset to initialize and start recording)
  useEffect(() => {
    reset();
  }, []);

  // LẮNG NGHE WHEEL TOÀN DOCUMENT
  useEffect(() => {
    const handleDocumentWheel = (e: WheelEvent) => {
      handleWheel(e);
    };

    document.addEventListener('wheel', handleDocumentWheel, { passive: false });

    return () => {
      document.removeEventListener('wheel', handleDocumentWheel);
    };
  }, [targetCircle, rotations]);

  return (
    <>
      {/* ẨN CON TRỎ MẶC ĐỊNH TOÀN MÀN HÌNH */}
      {/* Nếu dùng Vite/CRA thì dùng <style> như dưới, không cần "jsx" */}
      <style>{`
        * {
          cursor: none !important;
        }
      `}</style>

      <div
        className="flex h-screen bg-white relative"
        onClick={handleLeftClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* KHU VỰC GAME 3 HÌNH TRÒN */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          <svg width="700" height="600" className="drop-shadow-xl select-none">
            {/* ĐƯỜNG NỐI KHI WIN */}
            {isWin &&
              circlePositions.map((pos1, i) =>
                circlePositions.map((pos2, j) => {
                  if (i >= j) return null;
                  return (
                    <line
                      key={`${i}-${j}`}
                      x1={pos1.x}
                      y1={pos1.y}
                      x2={pos2.x}
                      y2={pos2.y}
                      stroke="#22c55e"
                      strokeWidth="3"
                      strokeDasharray="5,5"
                      className="animate-pulse"
                      opacity="0.5"
                    />
                  );
                }),
              )}

            {/* VẼ 3 HÌNH TRÒN + CÁNH QUẠT */}
            {circlePositions.map((pos, i) => (
              <g key={i}>
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={radius}
                  fill="white"
                  stroke="#000000"
                  strokeWidth="3"
                  className="transition-all duration-200"
                  style={{ pointerEvents: 'none' }}
                />

                {dotAngles[i].map((angle, dotIndex) => {
                  const dotPos = getDotPosition(
                    pos.x,
                    pos.y,
                    angle,
                    rotations[i],
                  );
                  return (
                    <line
                      key={`line-${i}-${dotIndex}`}
                      x1={pos.x}
                      y1={pos.y}
                      x2={dotPos.x}
                      y2={dotPos.y}
                      stroke={isWin ? '#ff69b4' : '#000000'}
                      strokeWidth="2"
                      style={{ pointerEvents: 'none' }}
                      className="transition-all duration-300"
                    />
                  );
                })}
              </g>
            ))}
          </svg>
        </div>

      

        {/* ⭐⭐ DISCLAIMER Ở GÓC DƯỚI BÊN PHẢI ⭐⭐ */}
        {/*
          👉 CHỖ CHỈNH:
          - VỊ TRÍ:
              bottom: '16px'  // chỉnh cao/thấp (px, %, etc.)
              right: '16px'   // chỉnh sát/tránh mép phải
          - CỠ CHỮ:
              fontSize: '10px' // tăng/giảm cỡ chữ
          - ĐẬM/NHẸ:
              fontWeight: 300   // 300: light, 400: normal, 500+: đậm hơn
          - NÊN IMPORT FONT MONTSERRAT Ở GLOBAL:
              + index.html: <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500&display=swap" rel="stylesheet" />
              hoặc
              + trong CSS global dùng @import.
        */}
        <div
          className="fixed z-40 text-right"
          style={{
            bottom: '150px', // 🔧 CHỈNH CAO/THẤP Ở ĐÂY
            right: '200px',  // 🔧 CHỈNH CÁCH MÉP PHẢI Ở ĐÂY
            maxWidth: '500px',
            fontFamily:
              "'Montserrat', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            fontSize: '15px', // 🔧 CHỈNH CỠ CHỮ Ở ĐÂY
            fontWeight: 300,  // 🔧 CHỈNH ĐẬM/NHẠT Ở ĐÂY (300 = light)
            lineHeight: 1.3,
            color: '#000000',
            opacity: 10,
          }}
        >
          <div>This experience is being recorded.</div>
          <div>
            By continuing to participate, you are consenting to be recorded.
          </div>
        </div>

        {/* CUSTOM CURSOR - CHẤM TRÒN TRẮNG VIỀN ĐEN */}
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: `${mousePosition.x}px`,
            top: `${mousePosition.y}px`,
            transform: 'translate(-50%, -50%)',
            width: '20px',
            height: '20px',
            backgroundColor: 'white',
            border: '1px solid black',
            borderRadius: '50%',
          }}
        />
      </div>
    </>
  );
}
