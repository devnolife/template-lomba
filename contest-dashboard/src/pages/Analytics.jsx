import React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';

import { useOverview } from '../hooks/useEvents';
import { useSuspiciousParticipants, useParticipants } from '../hooks/useParticipants';

const COLORS = ['#7F56D9', '#06b6d4', '#9E77ED', '#22d3ee', '#a855f7', '#ec4899', '#6366f1', '#84cc16'];

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

export default function Analytics() {
  const { data: overview, isLoading } = useOverview();
  const { data: suspicious } = useSuspiciousParticipants();
  const { data: allData } = useParticipants({ limit: 500 });

  const stats = overview || {};
  const participants = allData?.participants || [];
  const flagged = suspicious?.participants || [];

  // Suspicion score distribution
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    range: `${(i * 10)}–${((i + 1) * 10)}%`,
    count: 0,
  }));
  participants.forEach((p) => {
    const idx = Math.min(Math.floor((p.suspicionScore ?? 0) * 10), 9);
    buckets[idx].count++;
  });

  // Most common suspicious activities
  const activityCounts = {};
  participants.forEach((p) => {
    if ((p.stats?.pasteCount ?? 0) > 0) activityCounts['Paste'] = (activityCounts['Paste'] || 0) + p.stats.pasteCount;
    if ((p.stats?.typingAnomalies ?? 0) > 0) activityCounts['Typing Anomaly'] = (activityCounts['Typing Anomaly'] || 0) + p.stats.typingAnomalies;
    if ((p.stats?.windowBlurCount ?? 0) > 0) activityCounts['Window Blur'] = (activityCounts['Window Blur'] || 0) + p.stats.windowBlurCount;
    if ((p.stats?.clipboardChanges ?? 0) > 0) activityCounts['Clipboard'] = (activityCounts['Clipboard'] || 0) + p.stats.clipboardChanges;
  });
  const activityData = Object.entries(activityCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Top 15 by events
  const topByEvents = [...participants]
    .sort((a, b) => (b.totalEvents ?? 0) - (a.totalEvents ?? 0))
    .slice(0, 15)
    .map((p) => ({
      name: p.githubUsername || p.machineId?.slice(0, 8),
      events: p.totalEvents ?? 0,
      suspicion: Math.round((p.suspicionScore ?? 0) * 100),
    }));

  // Suspicion vs Paste
  const comparisonData = [...participants]
    .filter((p) => (p.suspicionScore ?? 0) > 0)
    .sort((a, b) => (b.suspicionScore ?? 0) - (a.suspicionScore ?? 0))
    .slice(0, 20)
    .map((p) => ({
      name: p.githubUsername || p.machineId?.slice(0, 8),
      score: Math.round((p.suspicionScore ?? 0) * 100),
      pastes: p.stats?.pasteCount ?? 0,
      anomalies: p.stats?.typingAnomalies ?? 0,
    }));

  if (isLoading) {
    return (
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: '#fff' }}>Analytics</Typography>
        <Grid container spacing={2}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid item xs={12} md={6} key={i}>
              <Skeleton
                variant="rectangular"
                height={300}
                sx={{ borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.03)' }}
              />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  const summaryCards = [
    {
      label: 'Total Participants',
      value: stats.totalParticipants ?? participants.length,
      color: '#7F56D9',
      glow: 'rgba(127,86,217,0.15)',
    },
    {
      label: 'Total Events',
      value: stats.totalEvents ?? 0,
      color: '#06b6d4',
      glow: 'rgba(6,182,212,0.15)',
    },
    {
      label: 'Flagged',
      value: flagged.length,
      color: '#ef4444',
      glow: 'rgba(239,68,68,0.15)',
    },
    {
      label: 'Avg Score',
      value: participants.length > 0
        ? ((participants.reduce((s, p) => s + (p.suspicionScore ?? 0), 0) / participants.length) * 100).toFixed(1) + '%'
        : '0%',
      color: '#f59e0b',
      glow: 'rgba(245,158,11,0.15)',
    },
  ];

  return (
    <Box sx={{ animation: 'fadeInUp 0.5s ease-out' }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: '#fff', letterSpacing: '-0.5px' }}>
        Analytics
      </Typography>

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {summaryCards.map((s) => (
          <Grid item xs={6} md={3} key={s.label}>
            <GlassCard sx={{ textAlign: 'center', py: 2.5 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: s.color,
                  boxShadow: `0 0 12px ${s.glow}`,
                  mx: 'auto',
                  mb: 1.5,
                }}
              />
              <Typography sx={{ fontSize: '0.75rem', color: '#666', mb: 0.5, fontWeight: 500 }}>
                {s.label}
              </Typography>
              <Typography
                sx={{
                  fontSize: '1.8rem',
                  fontWeight: 800,
                  color: '#fff',
                  letterSpacing: '-1px',
                  lineHeight: 1,
                }}
              >
                {s.value}
              </Typography>
            </GlassCard>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2.5}>
        {/* Suspicion distribution */}
        <Grid item xs={12} md={6}>
          <GlassCard>
            <Typography sx={{ fontWeight: 600, mb: 2, color: '#fff', fontSize: '0.95rem' }}>
              Suspicion Score Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={buckets}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="range" tick={axisStyle} />
                <YAxis tick={axisStyle} />
                <RTooltip {...chartTooltipStyle} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {buckets.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i < 4 ? '#22c55e' : i < 7 ? '#f59e0b' : '#ef4444'}
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        </Grid>

        {/* Activity pie */}
        <Grid item xs={12} md={6}>
          <GlassCard>
            <Typography sx={{ fontWeight: 600, mb: 2, color: '#fff', fontSize: '0.95rem' }}>
              Most Common Suspicious Activities
            </Typography>
            {activityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={activityData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%" cy="50%"
                    outerRadius={95}
                    innerRadius={50}
                    strokeWidth={0}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {activityData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
                    ))}
                  </Pie>
                  <Legend
                    wrapperStyle={{ color: '#888', fontSize: '0.75rem' }}
                  />
                  <RTooltip {...chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.85rem', color: '#555' }}>No suspicious activities recorded.</Typography>
              </Box>
            )}
          </GlassCard>
        </Grid>

        {/* Top by events */}
        <Grid item xs={12} md={6}>
          <GlassCard>
            <Typography sx={{ fontWeight: 600, mb: 2, color: '#fff', fontSize: '0.95rem' }}>
              Top Participants by Events
            </Typography>
            {topByEvents.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topByEvents} layout="vertical">
                  <CartesianGrid {...gridStyle} />
                  <XAxis type="number" tick={axisStyle} />
                  <YAxis dataKey="name" type="category" width={80} tick={axisStyle} />
                  <RTooltip {...chartTooltipStyle} />
                  <Bar dataKey="events" radius={[0, 6, 6, 0]}>
                    {topByEvents.map((_, i) => (
                      <Cell key={i} fill={`rgba(127,86,217,${0.4 + (i / topByEvents.length) * 0.5})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.85rem', color: '#555' }}>No data.</Typography>
              </Box>
            )}
          </GlassCard>
        </Grid>

        {/* Comparison */}
        <Grid item xs={12} md={6}>
          <GlassCard>
            <Typography sx={{ fontWeight: 600, mb: 2, color: '#fff', fontSize: '0.95rem' }}>
              Suspicion vs Paste Count (Top 20)
            </Typography>
            {comparisonData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={comparisonData}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="name" tick={{ ...axisStyle, fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={axisStyle} />
                  <RTooltip {...chartTooltipStyle} />
                  <Legend wrapperStyle={{ color: '#888', fontSize: '0.75rem' }} />
                  <Bar dataKey="score" fill="#9E77ED" name="Suspicion %" radius={[6, 6, 0, 0]} fillOpacity={0.8} />
                  <Bar dataKey="pastes" fill="#06b6d4" name="Pastes" radius={[6, 6, 0, 0]} fillOpacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.85rem', color: '#555' }}>No data.</Typography>
              </Box>
            )}
          </GlassCard>
        </Grid>
      </Grid>
    </Box>
  );
}
