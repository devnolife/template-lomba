import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Avatar from '@mui/material/Avatar';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import PersonIcon from '@mui/icons-material/Person';
import GitHubIcon from '@mui/icons-material/GitHub';
import { format } from 'date-fns';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
  BarChart, Bar,
} from 'recharts';

import { useParticipant } from '../hooks/useParticipants';
import { useGithubAnalysis, useGithubCommits } from '../hooks/useEvents';
import useSocket from '../hooks/useSocket';
import SuspicionMeter from '../components/SuspicionMeter';
import EventTimeline from '../components/EventTimeline';

const COLORS = ['#7F56D9', '#06b6d4', '#9E77ED', '#22d3ee', '#a855f7', '#ec4899'];

const chartTooltipStyle = {
  contentStyle: {
    background: 'rgba(12,12,12,0.95)',
    border: '1px solid rgba(127,86,217,0.2)',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    color: '#fff',
    fontSize: '0.8rem',
  },
  itemStyle: { color: '#ccc' },
  labelStyle: { color: '#fff', fontWeight: 600 },
};

const axisStyle = { fill: '#555', fontSize: 10 };
const gridStyle = { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.04)' };

const thStyle = {
  bgcolor: 'rgba(10,10,10,0.9)',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  color: '#666',
  fontWeight: 600,
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

function GlassCard({ children, sx, ...props }) {
  return (
    <Box
      sx={{
        background: 'rgba(255,255,255,0.02)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '20px',
        p: 3,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(127,86,217,0.2), transparent)',
        },
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

export default function ParticipantDetail() {
  const { id } = useParams();
  const { data, isLoading } = useParticipant(id);
  const { data: ghAnalysis } = useGithubAnalysis(id);
  const { data: ghCommits } = useGithubCommits(id);
  const [tab, setTab] = useState(0);
  const [eventFilter, setEventFilter] = useState('all');
  const { on } = useSocket();

  useEffect(() => {
    const off = on('participant:update', () => {});
    return off;
  }, [on]);

  if (isLoading) {
    return (
      <Box sx={{ animation: 'fadeInUp 0.5s ease-out' }}>
        <Skeleton variant="rectangular" height={140} sx={{ borderRadius: '20px', mb: 2, bgcolor: 'rgba(255,255,255,0.03)' }} />
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.03)' }} />
      </Box>
    );
  }

  const p = data?.participant || {};
  const events = data?.events || [];
  const suspicionBreakdown = data?.suspicionBreakdown || [];

  const displayName = p.githubUsername || p.machineId?.slice(0, 16) || 'Unknown';

  // Event type distribution
  const eventTypeCounts = {};
  events.forEach((e) => {
    const t = e.eventType || 'unknown';
    eventTypeCounts[t] = (eventTypeCounts[t] || 0) + 1;
  });
  const eventDist = Object.entries(eventTypeCounts).map(([name, value]) => ({ name, value }));

  // Typing speed over time
  const typingData = events
    .filter((e) => e.eventType === 'typing' && e.data?.interval)
    .map((e) => ({
      time: format(new Date(e.timestamp), 'HH:mm'),
      interval: e.data.interval,
      wpm: e.data.interval > 0 ? Math.round(60000 / (e.data.interval * 5)) : 0,
    }))
    .slice(-50);

  // Commits
  const commits = ghCommits?.commits || [];

  // Filtered events
  const filteredEvents =
    eventFilter === 'all'
      ? events
      : eventFilter === 'flagged'
      ? events.filter((e) => e.flagged || (e.suspicionScore || 0) > 0.3)
      : events.filter((e) => e.eventType === eventFilter);

  // Similarity
  const similarities = ghAnalysis?.similarityMatches || [];

  const eventFilterButtons = [
    { value: 'all', label: 'All Events' },
    { value: 'flagged', label: 'Flagged' },
    { value: 'paste', label: 'Paste' },
    { value: 'typing', label: 'Typing' },
    { value: 'window_blur', label: 'Blur' },
    { value: 'file_operation', label: 'File' },
    { value: 'clipboard', label: 'Clipboard' },
  ];

  return (
    <Box sx={{ animation: 'fadeInUp 0.5s ease-out' }}>
      {/* Header card */}
      <GlassCard sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2.5, flexWrap: 'wrap' }}>
          <Avatar
            sx={{
              width: 60,
              height: 60,
              borderRadius: '18px',
              background: 'linear-gradient(135deg, #7F56D9, #9E77ED)',
              border: '2px solid rgba(127,86,217,0.3)',
              boxShadow: '0 0 20px rgba(127,86,217,0.2)',
            }}
          >
            <PersonIcon sx={{ fontSize: 30 }} />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: '1.4rem',
                color: '#fff',
                letterSpacing: '-0.5px',
                lineHeight: 1.2,
              }}
            >
              {displayName}
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: '#666', mt: 0.5 }}>
              Machine: {p.machineId?.slice(0, 24)}... | Session: {p.sessionId?.slice(0, 12)}
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#555', mt: 0.3 }}>
              Started: {p.startTime ? format(new Date(p.startTime), 'MMM dd yyyy HH:mm') : '\u2014'}
              {' | Last active: '}
              {p.lastActive ? format(new Date(p.lastActive), 'HH:mm:ss') : '\u2014'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              label={`${p.totalEvents ?? 0} events`}
              size="small"
              sx={{
                bgcolor: 'rgba(127,86,217,0.1)',
                color: '#9E77ED',
                border: '1px solid rgba(127,86,217,0.2)',
                fontWeight: 600,
              }}
            />
            <Chip
              label={`${p.stats?.pasteCount ?? 0} pastes`}
              size="small"
              sx={{
                bgcolor: 'rgba(245,158,11,0.1)',
                color: '#f59e0b',
                border: '1px solid rgba(245,158,11,0.2)',
                fontWeight: 600,
              }}
            />
            <Chip
              label={`${p.stats?.typingAnomalies ?? 0} anomalies`}
              size="small"
              sx={{
                bgcolor: 'rgba(239,68,68,0.1)',
                color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.2)',
                fontWeight: 600,
              }}
            />
          </Stack>
        </Box>
        <Box sx={{ maxWidth: 400, mt: 2.5 }}>
          <SuspicionMeter score={p.suspicionScore ?? 0} size="large" />
        </Box>
      </GlassCard>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 2,
          '& .MuiTabs-indicator': {
            background: 'linear-gradient(90deg, #7F56D9, #9E77ED)',
            height: 3,
            borderRadius: '3px',
          },
          '& .MuiTab-root': {
            color: '#555',
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.88rem',
            '&.Mui-selected': { color: '#fff' },
          },
        }}
      >
        <Tab label="Timeline" />
        <Tab label="Charts" />
        <Tab label="Events Log" />
        <Tab label="GitHub" />
        <Tab label="Similarity" />
      </Tabs>

      {/* Tab: Timeline */}
      <TabPanel value={tab} index={0}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <GlassCard>
              <Typography sx={{ fontWeight: 600, mb: 2, color: '#fff', fontSize: '0.95rem' }}>
                Real-time Activity Timeline
              </Typography>
              <EventTimeline events={events.slice(0, 100)} />
            </GlassCard>
          </Grid>
          <Grid item xs={12} md={4}>
            <GlassCard sx={{ mb: 2 }}>
              <Typography sx={{ fontWeight: 600, mb: 1.5, color: '#fff', fontSize: '0.9rem' }}>Stats</Typography>
              <Stack spacing={1}>
                {[
                  { label: 'Paste Count', value: p.stats?.pasteCount ?? 0, color: '#f59e0b' },
                  { label: 'Paste Chars Total', value: p.stats?.pasteCharsTotal ?? 0, color: '#f59e0b' },
                  { label: 'Typing Anomalies', value: p.stats?.typingAnomalies ?? 0, color: '#ef4444' },
                  { label: 'Window Blurs', value: p.stats?.windowBlurCount ?? 0, color: '#06b6d4' },
                  { label: 'Blur Time', value: `${Math.round((p.stats?.windowBlurTotalMs ?? 0) / 1000)}s`, color: '#06b6d4' },
                  { label: 'Clipboard Changes', value: p.stats?.clipboardChanges ?? 0, color: '#9E77ED' },
                  { label: 'Files Created', value: p.stats?.filesCreated ?? 0, color: '#22c55e' },
                ].map((stat) => (
                  <Box
                    key={stat.label}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      py: 0.6,
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 5,
                          height: 5,
                          borderRadius: '50%',
                          bgcolor: stat.color,
                          boxShadow: `0 0 6px ${stat.color}40`,
                        }}
                      />
                      <Typography sx={{ fontSize: '0.8rem', color: '#888' }}>{stat.label}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{stat.value}</Typography>
                  </Box>
                ))}
              </Stack>
            </GlassCard>

            {suspicionBreakdown.length > 0 && (
              <GlassCard>
                <Typography sx={{ fontWeight: 600, mb: 1.5, color: '#fff', fontSize: '0.9rem' }}>
                  Suspicion Breakdown
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {suspicionBreakdown.map((s, i) => (
                    <Chip
                      key={i}
                      label={`${s._id}: ${s.count}`}
                      size="small"
                      sx={{
                        mb: 0.3,
                        bgcolor: s.count > 5 ? 'rgba(239,68,68,0.1)' : 'rgba(127,86,217,0.08)',
                        color: s.count > 5 ? '#ef4444' : '#9E77ED',
                        border: `1px solid ${s.count > 5 ? 'rgba(239,68,68,0.2)' : 'rgba(127,86,217,0.15)'}`,
                        fontSize: '0.72rem',
                      }}
                    />
                  ))}
                </Stack>
              </GlassCard>
            )}
          </Grid>
        </Grid>
      </TabPanel>

      {/* Tab: Charts */}
      <TabPanel value={tab} index={1}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <GlassCard>
              <Typography sx={{ fontWeight: 600, mb: 2, color: '#fff', fontSize: '0.95rem' }}>
                Typing Speed Over Time (WPM)
              </Typography>
              {typingData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={typingData}>
                    <defs>
                      <linearGradient id="wpmGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7F56D9" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#7F56D9" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...gridStyle} />
                    <XAxis dataKey="time" tick={axisStyle} />
                    <YAxis tick={axisStyle} />
                    <RTooltip {...chartTooltipStyle} />
                    <Area type="monotone" dataKey="wpm" stroke="#7F56D9" fill="url(#wpmGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.85rem', color: '#555' }}>No typing data yet.</Typography>
                </Box>
              )}
            </GlassCard>
          </Grid>

          <Grid item xs={12} md={6}>
            <GlassCard>
              <Typography sx={{ fontWeight: 600, mb: 2, color: '#fff', fontSize: '0.95rem' }}>
                Event Distribution
              </Typography>
              {eventDist.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={eventDist}
                      dataKey="value"
                      nameKey="name"
                      cx="50%" cy="50%"
                      outerRadius={85}
                      innerRadius={45}
                      strokeWidth={0}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {eventDist.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ color: '#888', fontSize: '0.75rem' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.85rem', color: '#555' }}>No events yet.</Typography>
                </Box>
              )}
            </GlassCard>
          </Grid>

          {ghAnalysis?.timingAnalysis?.hourlyDistribution && (
            <Grid item xs={12}>
              <GlassCard>
                <Typography sx={{ fontWeight: 600, mb: 2, color: '#fff', fontSize: '0.95rem' }}>
                  Commit Activity by Hour
                </Typography>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={ghAnalysis.timingAnalysis.hourlyDistribution.map((v, h) => ({
                      hour: `${h}h`,
                      commits: v,
                    }))}
                  >
                    <CartesianGrid {...gridStyle} />
                    <XAxis dataKey="hour" tick={axisStyle} />
                    <YAxis tick={axisStyle} />
                    <RTooltip {...chartTooltipStyle} />
                    <Bar dataKey="commits" radius={[6, 6, 0, 0]}>
                      {ghAnalysis.timingAnalysis.hourlyDistribution.map((_, i) => (
                        <Cell key={i} fill={`rgba(127,86,217,${0.3 + (i / 24) * 0.7})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </GlassCard>
            </Grid>
          )}
        </Grid>
      </TabPanel>

      {/* Tab: Events Log */}
      <TabPanel value={tab} index={2}>
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            mb: 2.5,
            p: 0.5,
            bgcolor: 'rgba(255,255,255,0.02)',
            borderRadius: '12px',
            display: 'inline-flex',
            flexWrap: 'wrap',
          }}
        >
          {eventFilterButtons.map((btn) => (
            <Box
              key={btn.value}
              onClick={() => setEventFilter(btn.value)}
              sx={{
                px: 1.5,
                py: 0.7,
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: 500,
                color: eventFilter === btn.value ? '#fff' : '#666',
                bgcolor: eventFilter === btn.value ? 'rgba(127,86,217,0.15)' : 'transparent',
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: eventFilter === btn.value ? 'rgba(127,86,217,0.2)' : 'rgba(255,255,255,0.03)',
                },
              }}
            >
              {btn.label}
            </Box>
          ))}
        </Stack>

        <GlassCard sx={{ p: 0, overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: 500 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={thStyle}>Time</TableCell>
                  <TableCell sx={thStyle}>Type</TableCell>
                  <TableCell sx={thStyle}>Score</TableCell>
                  <TableCell sx={thStyle}>Flagged</TableCell>
                  <TableCell sx={thStyle}>Data</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEvents.slice(0, 200).map((e, i) => (
                  <TableRow
                    key={e._id || i}
                    sx={{
                      bgcolor: e.flagged || (e.suspicionScore || 0) > 0.3
                        ? 'rgba(239,68,68,0.04)'
                        : 'transparent',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                      '& td': { borderBottom: '1px solid rgba(255,255,255,0.03)' },
                    }}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap', color: '#888', fontSize: '0.82rem' }}>
                      {e.timestamp ? format(new Date(e.timestamp), 'HH:mm:ss') : '\u2014'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={e.eventType}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: '0.7rem',
                          bgcolor: 'rgba(127,86,217,0.08)',
                          color: '#9E77ED',
                          border: '1px solid rgba(127,86,217,0.15)',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {e.suspicionScore != null ? (
                        <Typography
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            color: e.suspicionScore > 0.5 ? '#ef4444' : e.suspicionScore > 0.2 ? '#f59e0b' : '#666',
                          }}
                        >
                          {(e.suspicionScore * 100).toFixed(0)}%
                        </Typography>
                      ) : '\u2014'}
                    </TableCell>
                    <TableCell>
                      {e.flagged && (
                        <Chip
                          label="Flagged"
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            bgcolor: 'rgba(239,68,68,0.1)',
                            color: '#ef4444',
                            border: '1px solid rgba(239,68,68,0.2)',
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell
                      sx={{
                        maxWidth: 300,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontFamily: 'monospace',
                        fontSize: '0.68rem',
                        color: '#666',
                      }}
                    >
                      {JSON.stringify(e.data || {}).slice(0, 120)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </GlassCard>
      </TabPanel>

      {/* Tab: GitHub */}
      <TabPanel value={tab} index={3}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <GlassCard>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                <GitHubIcon sx={{ color: '#fff' }} />
                <Typography sx={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem' }}>
                  {ghAnalysis?.repoFullName || 'No repo registered'}
                </Typography>
                {ghAnalysis?.githubSuspicionScore != null && (
                  <Chip
                    label={`GitHub Score: ${(ghAnalysis.githubSuspicionScore * 100).toFixed(0)}%`}
                    size="small"
                    sx={{
                      bgcolor: ghAnalysis.githubSuspicionScore > 0.5 ? 'rgba(239,68,68,0.1)' : 'rgba(127,86,217,0.1)',
                      color: ghAnalysis.githubSuspicionScore > 0.5 ? '#ef4444' : '#9E77ED',
                      border: `1px solid ${ghAnalysis.githubSuspicionScore > 0.5 ? 'rgba(239,68,68,0.2)' : 'rgba(127,86,217,0.2)'}`,
                      fontWeight: 600,
                    }}
                  />
                )}
              </Stack>

              {ghAnalysis?.commitStats && (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    label={`${ghAnalysis.commitStats.totalCommits} commits`}
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: '#aaa', border: '1px solid rgba(255,255,255,0.06)' }}
                  />
                  <Chip
                    label={`+${ghAnalysis.commitStats.totalAdditions} / -${ghAnalysis.commitStats.totalDeletions}`}
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: '#aaa', border: '1px solid rgba(255,255,255,0.06)' }}
                  />
                  <Chip
                    label={`Avg ${ghAnalysis.commitStats.avgAdditionsPerCommit} lines/commit`}
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: '#aaa', border: '1px solid rgba(255,255,255,0.06)' }}
                  />
                </Stack>
              )}
            </GlassCard>
          </Grid>

          <Grid item xs={12}>
            <GlassCard sx={{ p: 0, overflow: 'hidden' }}>
              <Box sx={{ p: 3, pb: 1.5 }}>
                <Typography sx={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>Recent Commits</Typography>
              </Box>
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={thStyle}>Date</TableCell>
                      <TableCell sx={thStyle}>SHA</TableCell>
                      <TableCell sx={thStyle}>Message</TableCell>
                      <TableCell sx={thStyle}>Author</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {commits.slice(0, 50).map((c, i) => (
                      <TableRow
                        key={c.sha || i}
                        sx={{
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                          '& td': { borderBottom: '1px solid rgba(255,255,255,0.03)' },
                        }}
                      >
                        <TableCell sx={{ whiteSpace: 'nowrap', color: '#888', fontSize: '0.82rem' }}>
                          {c.date ? format(new Date(c.date), 'MMM dd HH:mm') : '\u2014'}
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#9E77ED' }}>
                          {c.sha?.slice(0, 7)}
                        </TableCell>
                        <TableCell sx={{ color: '#ccc', fontSize: '0.82rem' }}>{c.message?.slice(0, 80)}</TableCell>
                        <TableCell sx={{ color: '#888', fontSize: '0.82rem' }}>{c.author}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {commits.length === 0 && (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.85rem', color: '#555' }}>No commits found.</Typography>
                </Box>
              )}
            </GlassCard>
          </Grid>

          {ghAnalysis?.suspiciousCommits?.length > 0 && (
            <Grid item xs={12}>
              <GlassCard sx={{ border: '1px solid rgba(239,68,68,0.15)' }}>
                <Typography sx={{ fontWeight: 600, color: '#ef4444', fontSize: '0.9rem', mb: 2 }}>
                  Suspicious Commits ({ghAnalysis.suspiciousCommits.length})
                </Typography>
                {ghAnalysis.suspiciousCommits.slice(0, 20).map((sc, i) => (
                  <Box
                    key={i}
                    sx={{
                      mb: 1.5,
                      p: 2,
                      borderRadius: '14px',
                      bgcolor: 'rgba(239,68,68,0.04)',
                      border: '1px solid rgba(239,68,68,0.08)',
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                      <Typography sx={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#ef4444', fontWeight: 600 }}>
                        {sc.sha?.slice(0, 7)}
                      </Typography>
                      <Typography sx={{ fontSize: '0.78rem', color: '#aaa' }}>
                        Score: {(sc.score * 100).toFixed(0)}%
                      </Typography>
                    </Stack>
                    <Typography sx={{ fontSize: '0.78rem', color: '#888', mb: 0.8 }}>
                      {sc.message?.slice(0, 100)}
                    </Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {sc.reasons?.map((r, j) => (
                        <Chip
                          key={j}
                          label={r}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.65rem',
                            bgcolor: 'rgba(239,68,68,0.08)',
                            color: '#ef4444',
                            border: '1px solid rgba(239,68,68,0.15)',
                          }}
                        />
                      ))}
                    </Stack>
                  </Box>
                ))}
              </GlassCard>
            </Grid>
          )}
        </Grid>
      </TabPanel>

      {/* Tab: Similarity */}
      <TabPanel value={tab} index={4}>
        <GlassCard sx={{ p: 0, overflow: 'hidden' }}>
          <Box sx={{ p: 3, pb: 1.5 }}>
            <Typography sx={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem' }}>
              Code Similarity with Other Participants
            </Typography>
          </Box>
          {similarities.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.85rem', color: '#555' }}>No similarity matches found.</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={thStyle}>Other Repo</TableCell>
                    <TableCell sx={thStyle}>File 1</TableCell>
                    <TableCell sx={thStyle}>File 2</TableCell>
                    <TableCell sx={thStyle}>Similarity</TableCell>
                    <TableCell sx={thStyle}>Identical?</TableCell>
                    <TableCell sx={thStyle}>Detected</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {similarities.map((m, i) => (
                    <TableRow
                      key={i}
                      sx={{
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                        '& td': { borderBottom: '1px solid rgba(255,255,255,0.03)' },
                      }}
                    >
                      <TableCell sx={{ color: '#ccc', fontSize: '0.82rem' }}>{m.otherRepo}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#9E77ED' }}>{m.file1}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#9E77ED' }}>{m.file2}</TableCell>
                      <TableCell>
                        <Chip
                          label={`${(m.similarity * 100).toFixed(0)}%`}
                          size="small"
                          sx={{
                            height: 22,
                            fontWeight: 700,
                            bgcolor: m.similarity > 0.8 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                            color: m.similarity > 0.8 ? '#ef4444' : '#f59e0b',
                            border: `1px solid ${m.similarity > 0.8 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {m.identicalContent && (
                          <Chip
                            label="IDENTICAL"
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              bgcolor: 'rgba(239,68,68,0.1)',
                              color: '#ef4444',
                              border: '1px solid rgba(239,68,68,0.2)',
                            }}
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ color: '#888', fontSize: '0.82rem' }}>
                        {m.detectedAt ? format(new Date(m.detectedAt), 'MMM dd HH:mm') : '\u2014'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </GlassCard>
      </TabPanel>
    </Box>
  );
}
