import React from 'react';

interface CountdownOverlayProps {
  count: number;
}

const CountdownOverlay: React.FC<CountdownOverlayProps> = ({ count }) => {
  if (count <= 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      <div className="text-9xl font-bold text-white animate-bounce"
           style={{
             textShadow: '0 0 40px rgba(59, 130, 246, 0.8), 0 0 80px rgba(59, 130, 246, 0.4)',
           }}>
        {count}
      </div>
    </div>
  );
};

export default CountdownOverlay;
