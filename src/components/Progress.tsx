import React, { useState, useEffect } from 'react';
import { Spinner } from '@inkjs/ui';
import { formatDuration } from '../utils/formatBytes.js';

interface ProgressProps {
  percentage: number;
  fileName: string;
  startTime: number;
}

export const Progress: React.FC<ProgressProps> = ({
  percentage,
  fileName,
  startTime,
}) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const label = `Compressing ${fileName}... ${percentage.toFixed(0)}% · ${formatDuration(elapsed)}`;

  return <Spinner label={label} />;
};
