import { useCallback, useMemo, useRef } from 'react';
import Webcam from 'react-webcam';
import './scanner.css';

const videoConstraints: MediaTrackConstraints = {
  facingMode: { ideal: 'environment' },
};

export default function Scanner() {
  const webcamRef = useRef<Webcam | null>(null);
  const handleUserMedia = useCallback(() => {
    // Camera stream available
  }, []);

  // Maintain 16:9 container ratio for camera preview
  const containerStyle = useMemo<React.CSSProperties>(() => ({
    position: 'relative',
    width: '100%',
    maxWidth: 640,
    aspectRatio: '9 / 16',
    margin: '0 auto',
    overflow: 'hidden',
    borderRadius: 12,
    background: '#000',
  }), []);

  const overlayStyle = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }), []);

  const cardGuideStyle = useMemo<React.CSSProperties>(() => ({
    width: '70%',
    // Card-ish 85.60mm × 53.98mm ratio ≈ 1.586
    aspectRatio: '85.6 / 53.98',
    border: '3px solid rgba(255,255,255,0.9)',
    borderRadius: 12,
    boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
  }), []);

  return (
    <div style={containerStyle}>
      <Webcam
        ref={webcamRef}
        audio={false}
        mirrored={false}
        screenshotFormat="image/jpeg"
        videoConstraints={videoConstraints}
        onUserMedia={handleUserMedia}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div style={overlayStyle}>
        <div style={cardGuideStyle} />
      </div>
    </div>
  );
}
