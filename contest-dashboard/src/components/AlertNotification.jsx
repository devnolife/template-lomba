import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { format } from 'date-fns';

const SEVERITY_CONFIG = {
  critical: { color: '#ef4444', glow: 'rgba(239,68,68,0.15)', label: 'Critical' },
  warning: { color: '#f59e0b', glow: 'rgba(245,158,11,0.15)', label: 'Warning' },
  info: { color: '#06b6d4', glow: 'rgba(6,182,212,0.15)', label: 'Info' },
};

export function AlertItem({ alert, compact = false }) {
  const sev = SEVERITY_CONFIG[alert.level] || SEVERITY_CONFIG.info;
  const time = alert.timestamp
    ? format(new Date(alert.timestamp), 'MMM dd HH:mm:ss')
    : '';

  if (compact) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          py: 1,
          px: 1.5,
          borderRadius: '12px',
          bgcolor: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.04)',
          mb: 0.5,
          transition: 'all 0.2s',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
        }}
      >
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: sev.color,
            boxShadow: `0 0 8px ${sev.glow}`,
            flexShrink: 0,
          }}
        />
        <Typography sx={{ flex: 1, fontSize: '0.82rem', color: '#ccc', fontWeight: 500 }} noWrap>
          {alert.participantName || alert.participantId} — {(alert.reasons || []).join(', ')}
        </Typography>
        <Typography sx={{ fontSize: '0.7rem', color: '#555', flexShrink: 0 }}>
          {time}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        mb: 1,
        p: 2,
        borderRadius: '14px',
        background: 'rgba(255,255,255,0.02)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.05)',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.2s',
        '&:hover': { borderColor: sev.color + '33' },
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: sev.color,
          borderRadius: '3px 0 0 3px',
          boxShadow: `0 0 8px ${sev.glow}`,
        },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.8 }}>
        <Typography sx={{ fontWeight: 600, fontSize: '0.88rem', color: '#fff' }}>
          {alert.participantName || alert.participantId}
        </Typography>
        <Chip
          label={sev.label}
          size="small"
          sx={{
            height: 20,
            fontSize: '0.65rem',
            fontWeight: 600,
            bgcolor: sev.color + '18',
            color: sev.color,
            border: `1px solid ${sev.color}33`,
          }}
        />
        <Typography sx={{ fontSize: '0.7rem', color: '#555', ml: 'auto' }}>
          {time}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        {(alert.reasons || []).map((r, j) => (
          <Chip
            key={j}
            label={r}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.7rem',
              bgcolor: 'rgba(127,86,217,0.08)',
              color: '#9E77ED',
              border: '1px solid rgba(127,86,217,0.15)',
            }}
          />
        ))}
      </Stack>
      {alert.suspicionScore != null && (
        <Typography sx={{ fontSize: '0.72rem', color: '#666', mt: 0.8 }}>
          Score: {(alert.suspicionScore * 100).toFixed(1)}%
        </Typography>
      )}
    </Box>
  );
}

export default function AlertNotification({ alerts = [], compact = false, maxItems = 20 }) {
  const visible = alerts.slice(0, maxItems);

  if (visible.length === 0) {
    return (
      <Box sx={{ py: 3, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '0.82rem', color: '#555' }}>No alerts.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {visible.map((a, i) => (
        <AlertItem key={a._id || i} alert={a} compact={compact} />
      ))}
      {alerts.length > maxItems && (
        <Typography sx={{ fontSize: '0.75rem', color: '#555', mt: 1 }}>
          + {alerts.length - maxItems} more
        </Typography>
      )}
    </Box>
  );
}
