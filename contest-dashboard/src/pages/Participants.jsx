import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { format } from 'date-fns';

import { useParticipants } from '../hooks/useParticipants';
import { downloadCSV } from '../utils/api';
import SuspicionMeter from '../components/SuspicionMeter';

function statusInfo(lastActive) {
  if (!lastActive) return { label: 'Unknown', color: 'default' };
  const diff = Date.now() - new Date(lastActive).getTime();
  if (diff < 2 * 60 * 1000) return { label: 'Active', color: 'success' };
  if (diff < 10 * 60 * 1000) return { label: 'Idle', color: 'warning' };
  return { label: 'Offline', color: 'error' };
}

export default function Participants() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('suspicionScore');
  const [sortDir, setSortDir] = useState('desc');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading } = useParticipants({
    sort: sortBy,
    order: sortDir,
    limit: 200,
  });

  const participants = data?.participants || [];

  const filtered = useMemo(() => {
    let list = participants;

    // Search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          (p.githubUsername || '').toLowerCase().includes(q) ||
          (p.machineId || '').toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter((p) => statusInfo(p.lastActive).label.toLowerCase() === statusFilter);
    }

    // Sort
    list = [...list].sort((a, b) => {
      const av = a[sortBy] ?? 0;
      const bv = b[sortBy] ?? 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });

    return list;
  }, [participants, search, statusFilter, sortBy, sortDir]);

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const handleExport = () => {
    downloadCSV(
      filtered.map((p) => ({
        username: p.githubUsername || p.machineId,
        status: statusInfo(p.lastActive).label,
        suspicionScore: p.suspicionScore?.toFixed(3),
        totalEvents: p.totalEvents,
        pasteCount: p.stats?.pasteCount,
        lastActive: p.lastActive
          ? format(new Date(p.lastActive), 'yyyy-MM-dd HH:mm:ss')
          : '',
      })),
      `participants-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', mb: 0.5 }}>
            Participants
          </Typography>
          <Typography variant="body2" sx={{ color: '#666666' }}>
            Managing {filtered.length} active participants in this contest
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<FileDownloadIcon />}
          onClick={handleExport}
          disabled={filtered.length === 0}
          sx={{
            bgcolor: '#7F56D9',
            borderRadius: '12px',
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            '&:hover': { bgcolor: '#6941C6' },
          }}
        >
          Export CSV
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ bgcolor: '#0C0C0C', border: '1px solid #1E1E1E', mb: 3, borderRadius: '20px' }}>
        <CardContent sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', py: '16px !important' }}>
          <TextField
            size="small"
            placeholder="Search by name or machine ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{
              minWidth: 320,
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                '& fieldset': { borderColor: '#1E1E1E' },
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: '#666666' }} />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel sx={{ color: '#666666' }}>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
              sx={{
                borderRadius: '12px',
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#1E1E1E' },
                color: 'white',
              }}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="idle">Idle</MenuItem>
              <MenuItem value="offline">Offline</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {/* Table */}
      <Card sx={{ bgcolor: '#0C0C0C', border: '1px solid #1E1E1E', borderRadius: '24px', overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(255, 255, 255, 0.02)' }}>
                <TableCell sx={{ color: '#666666', fontWeight: 700, borderBottom: '1px solid #1E1E1E', py: 2 }}>Participant</TableCell>
                <TableCell sx={{ color: '#666666', fontWeight: 700, borderBottom: '1px solid #1E1E1E', py: 2 }}>Status</TableCell>
                <TableCell sx={{ color: '#666666', fontWeight: 700, borderBottom: '1px solid #1E1E1E', py: 2 }}>
                  <TableSortLabel
                    active={sortBy === 'suspicionScore'}
                    direction={sortBy === 'suspicionScore' ? sortDir : 'desc'}
                    onClick={() => toggleSort('suspicionScore')}
                    sx={{
                      '&.MuiTableSortLabel-active': { color: '#7F56D9' },
                      '& .MuiTableSortLabel-icon': { color: '#7F56D9 !important' },
                    }}
                  >
                    Suspicion Score
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ color: '#666666', fontWeight: 700, borderBottom: '1px solid #1E1E1E', py: 2 }}>
                  <TableSortLabel
                    active={sortBy === 'totalEvents'}
                    direction={sortBy === 'totalEvents' ? sortDir : 'desc'}
                    onClick={() => toggleSort('totalEvents')}
                  >
                    Events
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ color: '#666666', fontWeight: 700, borderBottom: '1px solid #1E1E1E', py: 2 }}>Last Active</TableCell>
                <TableCell align="center" sx={{ color: '#666666', fontWeight: 700, borderBottom: '1px solid #1E1E1E', py: 2 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j} sx={{ borderBottom: '1px solid #1E1E1E' }}>
                          <Skeleton sx={{ bgcolor: '#1E1E1E' }} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : filtered.map((p) => {
                    const st = statusInfo(p.lastActive);
                    const color = st.color === 'success' ? '#22c55e' : st.color === 'warning' ? '#f59e0b' : '#ef4444';
                    return (
                      <TableRow
                        key={p._id}
                        hover
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.02) !important' },
                          '& .MuiTableCell-root': { borderBottom: '1px solid #1E1E1E' },
                        }}
                        onClick={() => navigate(`/participant/${p._id}`)}
                      >
                        <TableCell>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar
                              src={`https://github.com/${p.githubUsername}.png`}
                              sx={{ width: 32, height: 32, bgcolor: '#7F56D9', fontSize: '0.8rem' }}
                            >
                              {p.githubUsername?.[0]?.toUpperCase() || 'P'}
                            </Avatar>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: 'white' }}>
                              {p.githubUsername || p.machineId?.slice(0, 16)}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
                            <Typography variant="body2" sx={{ color: 'white', fontWeight: 500 }}>{st.label}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ minWidth: 200 }}>
                          <Stack direction="row" spacing={2} alignItems="center">
                            <Box sx={{ flex: 1 }}>
                              <SuspicionMeter score={p.suspicionScore ?? 0} size="small" showLabel={false} />
                            </Box>
                            <Typography variant="body2" sx={{ color: 'white', fontWeight: 700, minWidth: 40 }}>
                              {Math.round((p.suspicionScore ?? 0) * 100)}%
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ color: '#666666' }}>{p.totalEvents ?? 0}</TableCell>
                        <TableCell sx={{ color: '#666666' }}>
                          {p.lastActive
                            ? format(new Date(p.lastActive), 'HH:mm:ss')
                            : '—'}
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            sx={{ color: '#7F56D9', bgcolor: 'rgba(127, 86, 217, 0.1)', '&:hover': { bgcolor: 'rgba(127, 86, 217, 0.2)' } }}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/participant/${p._id}`);
                            }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
