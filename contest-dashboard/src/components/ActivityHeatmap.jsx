import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function intensityColor(value, max) {
  if (value === 0) return 'rgba(127,86,217,0.04)';
  const ratio = Math.min(value / (max || 1), 1);
  if (ratio < 0.25) return 'rgba(127,86,217,0.15)';
  if (ratio < 0.5) return 'rgba(127,86,217,0.35)';
  if (ratio < 0.75) return 'rgba(127,86,217,0.6)';
  return '#7F56D9';
}

function glowForValue(value, max) {
  if (value === 0) return 'none';
  const ratio = Math.min(value / (max || 1), 1);
  if (ratio < 0.5) return 'none';
  return `0 0 ${4 + ratio * 8}px rgba(127,86,217,${ratio * 0.4})`;
}

/**
 * 7-row x 24-col heatmap grid (day-of-week x hour-of-day).
 * Purple gradient color scheme matching the dark theme.
 */
export default function ActivityHeatmap({ data = [], title = 'Activity Heatmap' }) {
  let matrix;
  if (Array.isArray(data) && !Array.isArray(data[0])) {
    matrix = [data];
  } else {
    matrix = data;
  }

  let max = 0;
  for (const row of matrix) {
    for (const v of row) {
      if (v > max) max = v;
    }
  }

  const cellSize = 18;
  const gap = 2;

  return (
    <Box>
      {title && (
        <Typography sx={{ mb: 1.5, fontWeight: 600, fontSize: '0.9rem', color: '#fff' }}>
          {title}
        </Typography>
      )}
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {/* Day labels */}
        {matrix.length > 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${gap}px`, mr: 0.5 }}>
            {matrix.map((_, d) => (
              <Box
                key={d}
                sx={{
                  height: cellSize,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Typography sx={{ fontSize: '0.6rem', width: 28, color: '#555', fontWeight: 500 }}>
                  {DAYS[d % 7]}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {/* Grid */}
        <Box>
          {/* Hour header */}
          <Box sx={{ display: 'flex', gap: `${gap}px`, mb: `${gap}px` }}>
            {HOURS.map((h) => (
              <Box key={h} sx={{ width: cellSize, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.55rem', color: '#444' }}>
                  {h % 6 === 0 ? `${h}h` : ''}
                </Typography>
              </Box>
            ))}
          </Box>

          {matrix.map((row, d) => (
            <Box key={d} sx={{ display: 'flex', gap: `${gap}px`, mb: `${gap}px` }}>
              {HOURS.map((h) => {
                const val = row[h] || 0;
                return (
                  <Tooltip
                    key={h}
                    title={`${matrix.length > 1 ? DAYS[d % 7] + ' ' : ''}${h}:00 — ${val} event${val !== 1 ? 's' : ''}`}
                    arrow
                  >
                    <Box
                      sx={{
                        width: cellSize,
                        height: cellSize,
                        borderRadius: '4px',
                        bgcolor: intensityColor(val, max),
                        boxShadow: glowForValue(val, max),
                        cursor: 'default',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          transform: 'scale(1.3)',
                          zIndex: 1,
                          boxShadow: '0 0 12px rgba(127,86,217,0.5)',
                        },
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5 }}>
        <Typography sx={{ fontSize: '0.6rem', color: '#444', mr: 0.5 }}>Less</Typography>
        {[0.04, 0.15, 0.35, 0.6, 1].map((opacity, i) => (
          <Box
            key={i}
            sx={{
              width: 12,
              height: 12,
              borderRadius: '3px',
              bgcolor: i === 0 ? 'rgba(127,86,217,0.04)' : `rgba(127,86,217,${opacity})`,
            }}
          />
        ))}
        <Typography sx={{ fontSize: '0.6rem', color: '#444', ml: 0.5 }}>More</Typography>
      </Box>
    </Box>
  );
}
