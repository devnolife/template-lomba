import React from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';

function getColor(score) {
  if (score >= 0.7) return '#ef4444';
  if (score >= 0.4) return '#f59e0b';
  return '#22c55e';
}

function getLabel(score) {
  if (score >= 0.7) return 'High Risk';
  if (score >= 0.4) return 'Medium';
  return 'Low';
}

export default function SuspicionMeter({ score = 0, size = 'medium', showLabel = true }) {
  const pct = Math.round(score * 100);
  const color = getColor(score);
  const label = getLabel(score);

  const height = size === 'small' ? 8 : size === 'large' ? 14 : 10;

  return (
    <Tooltip title={`Suspicion: ${score.toFixed(3)} — ${label}`} arrow>
      <Box sx={{ width: '100%' }}>
        {showLabel && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" sx={{ color: '#666666', fontWeight: 600 }}>
              Suspicion Level
            </Typography>
            <Typography variant="caption" sx={{ color, fontWeight: 800 }}>
              {pct}%
            </Typography>
          </Box>
        )}
        <Box sx={{ position: 'relative', width: '100%', height, bgcolor: 'rgba(255, 255, 255, 0.05)', borderRadius: height / 2 }}>
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: `${pct}%`,
              bgcolor: color,
              borderRadius: height / 2,
              boxShadow: `0 0 10px ${color}50`,
              transition: 'width 0.5s ease-out',
            }}
          />
        </Box>
      </Box>
    </Tooltip>
  );
}
