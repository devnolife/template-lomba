import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { format } from 'date-fns';

import useStore from '../store/useStore';
import { downloadCSV, downloadJSON } from '../utils/api';

const severityConfig = {
  critical: { color: '#ef4444', glow: 'rgba(239,68,68,0.15)', label: 'Critical' },
  warning: { color: '#f59e0b', glow: 'rgba(245,158,11,0.15)', label: 'Warning' },
  info: { color: '#06b6d4', glow: 'rgba(6,182,212,0.15)', label: 'Info' },
};

export default function Alerts() {
  const liveAlerts = useStore((s) => s.liveAlerts);
  const clearLiveAlerts = useStore((s) => s.clearLiveAlerts);
  const [filter, setFilter] = useState('all');
  const [reviewed, setReviewed] = useState(new Set());

  const filtered = useMemo(() => {
    let list = liveAlerts;
    if (filter !== 'all') {
      list = list.filter((a) => a.level === filter);
    }
    return list;
  }, [liveAlerts, filter]);

  const handleMarkReviewed = (index) => {
    setReviewed((prev) => new Set([...prev, index]));
  };

  const handleExportCSV = () => {
    downloadCSV(
      filtered.map((a, i) => ({
        time: a.timestamp ? format(new Date(a.timestamp), 'yyyy-MM-dd HH:mm:ss') : '',
        level: a.level,
        participant: a.participantName || a.participantId || '',
        reasons: (a.reasons || []).join('; '),
        score: a.suspicionScore?.toFixed(3) ?? '',
        reviewed: reviewed.has(i) ? 'Yes' : 'No',
      })),
      `alerts-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`
    );
  };

  const handleExportJSON = () => {
    downloadJSON(filtered, `alerts-${format(new Date(), 'yyyyMMdd-HHmmss')}.json`);
  };

  const severityCounts = {
    critical: liveAlerts.filter((a) => a.level === 'critical').length,
    warning: liveAlerts.filter((a) => a.level === 'warning').length,
    info: liveAlerts.filter((a) => a.level === 'info' || !a.level).length,
  };

  const filterButtons = [
    { value: 'all', label: `All (${liveAlerts.length})` },
    { value: 'critical', label: 'Critical' },
    { value: 'warning', label: 'Warning' },
    { value: 'info', label: 'Info' },
  ];

  return (
    <Box sx={{ animation: 'fadeInUp 0.5s ease-out' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>
          Alerts
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<FileDownloadIcon />}
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            sx={{
              bgcolor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: '#aaa',
              borderRadius: '12px',
              textTransform: 'none',
              fontSize: '0.82rem',
              '&:hover': { bgcolor: 'rgba(127,86,217,0.1)', color: '#9E77ED', borderColor: 'rgba(127,86,217,0.2)' },
            }}
          >
            CSV
          </Button>
          <Button
            startIcon={<FileDownloadIcon />}
            onClick={handleExportJSON}
            disabled={filtered.length === 0}
            sx={{
              bgcolor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: '#aaa',
              borderRadius: '12px',
              textTransform: 'none',
              fontSize: '0.82rem',
              '&:hover': { bgcolor: 'rgba(127,86,217,0.1)', color: '#9E77ED', borderColor: 'rgba(127,86,217,0.2)' },
            }}
          >
            JSON
          </Button>
          <Button
            startIcon={<DeleteOutlineIcon />}
            onClick={clearLiveAlerts}
            disabled={liveAlerts.length === 0}
            sx={{
              bgcolor: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.12)',
              color: '#ef4444',
              borderRadius: '12px',
              textTransform: 'none',
              fontSize: '0.82rem',
              '&:hover': { bgcolor: 'rgba(239,68,68,0.12)' },
            }}
          >
            Clear All
          </Button>
        </Stack>
      </Box>

      {/* Severity summary cards */}
      <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
        {Object.entries(severityCounts).map(([key, count]) => {
          const cfg = severityConfig[key];
          return (
            <Box
              key={key}
              sx={{
                minWidth: 130,
                textAlign: 'center',
                py: 2,
                px: 3,
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.02)',
                backdropFilter: 'blur(16px)',
                border: `1px solid ${key === filter ? cfg.color + '33' : 'rgba(255,255,255,0.05)'}`,
                cursor: 'pointer',
                transition: 'all 0.25s',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': { borderColor: cfg.color + '44' },
                ...(key === filter && {
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: cfg.color,
                    boxShadow: `0 0 12px ${cfg.glow}`,
                  },
                }),
              }}
              onClick={() => setFilter(key)}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: cfg.color,
                  boxShadow: `0 0 10px ${cfg.glow}`,
                  mx: 'auto',
                  mb: 1,
                }}
              />
              <Typography sx={{ fontSize: '0.7rem', color: '#666', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1px' }}>
                {cfg.label}
              </Typography>
              <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', lineHeight: 1.2, mt: 0.3 }}>
                {count}
              </Typography>
            </Box>
          );
        })}
      </Stack>

      {/* Filter tabs */}
      <Stack direction="row" spacing={0.5} sx={{ mb: 2.5, p: 0.5, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '12px', display: 'inline-flex' }}>
        {filterButtons.map((btn) => (
          <Box
            key={btn.value}
            onClick={() => setFilter(btn.value)}
            sx={{
              px: 2,
              py: 0.8,
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 500,
              color: filter === btn.value ? '#fff' : '#666',
              bgcolor: filter === btn.value ? 'rgba(127,86,217,0.15)' : 'transparent',
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: filter === btn.value ? 'rgba(127,86,217,0.2)' : 'rgba(255,255,255,0.03)',
                color: filter === btn.value ? '#fff' : '#999',
              },
            }}
          >
            {btn.label}
          </Box>
        ))}
      </Stack>

      {/* Alerts table */}
      <Box
        sx={{
          background: 'rgba(255,255,255,0.02)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '20px',
          overflow: 'hidden',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(127,86,217,0.2), transparent)',
          },
        }}
      >
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ bgcolor: 'rgba(10,10,10,0.9)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Time
                </TableCell>
                <TableCell sx={{ bgcolor: 'rgba(10,10,10,0.9)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Severity
                </TableCell>
                <TableCell sx={{ bgcolor: 'rgba(10,10,10,0.9)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Participant
                </TableCell>
                <TableCell sx={{ bgcolor: 'rgba(10,10,10,0.9)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Reasons
                </TableCell>
                <TableCell sx={{ bgcolor: 'rgba(10,10,10,0.9)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Score
                </TableCell>
                <TableCell align="center" sx={{ bgcolor: 'rgba(10,10,10,0.9)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Reviewed
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((a, i) => {
                const isReviewed = reviewed.has(i);
                const cfg = severityConfig[a.level] || severityConfig.info;
                return (
                  <TableRow
                    key={i}
                    sx={{
                      opacity: isReviewed ? 0.4 : 1,
                      transition: 'all 0.2s',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                      '& td': { borderBottom: '1px solid rgba(255,255,255,0.03)' },
                    }}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap', color: '#888', fontSize: '0.82rem' }}>
                      {a.timestamp ? format(new Date(a.timestamp), 'HH:mm:ss') : '\u2014'}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: cfg.color,
                            boxShadow: `0 0 8px ${cfg.glow}`,
                            flexShrink: 0,
                          }}
                        />
                        <Typography sx={{ fontSize: '0.82rem', color: cfg.color, fontWeight: 500, textTransform: 'capitalize' }}>
                          {a.level || 'info'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 500, fontSize: '0.85rem', color: '#ddd' }}>
                        {a.participantName || a.participantId || '\u2014'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {(a.reasons || []).map((r, j) => (
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
                              mb: 0.3,
                            }}
                          />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {a.suspicionScore != null ? (
                        <Typography
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            color: a.suspicionScore > 0.5 ? '#ef4444' : '#aaa',
                          }}
                        >
                          {(a.suspicionScore * 100).toFixed(0)}%
                        </Typography>
                      ) : '\u2014'}
                    </TableCell>
                    <TableCell align="center">
                      {isReviewed ? (
                        <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 18, opacity: 0.7 }} />
                      ) : (
                        <Tooltip title="Mark as reviewed">
                          <IconButton
                            size="small"
                            onClick={() => handleMarkReviewed(i)}
                            sx={{
                              color: '#555',
                              '&:hover': { color: '#22c55e', bgcolor: 'rgba(34,197,94,0.08)' },
                            }}
                          >
                            <CheckCircleIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        {filtered.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography sx={{ fontSize: '0.85rem', color: '#555' }}>
              No alerts to display. Alerts appear here in real-time via Socket.io.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
