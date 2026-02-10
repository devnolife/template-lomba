import React, { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import AvatarGroup from '@mui/material/AvatarGroup';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import PeopleIcon from '@mui/icons-material/People';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EventNoteIcon from '@mui/icons-material/EventNote';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

import { useOverview } from '../hooks/useEvents';
import { useSuspiciousParticipants } from '../hooks/useParticipants';
import useSocket from '../hooks/useSocket';
import useStore from '../store/useStore';
import ParticipantCard from '../components/ParticipantCard';
import AlertNotification from '../components/AlertNotification';

function PerformanceCard({ label, value, trend, icon, loading, color = '#7F56D9' }) {
  return (
    <Card sx={{ bgcolor: '#0C0C0C', border: '1px solid #1E1E1E' }}>
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '16px',
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}
          >
            {React.cloneElement(icon, { sx: { fontSize: 24 } })}
          </Box>
          {trend && (
            <Box
              sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: '20px',
                bgcolor: trend > 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: trend > 0 ? '#22c55e' : '#ef4444',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              {trend > 0 ? '+' : ''}{trend}%
            </Box>
          )}
        </Stack>
        <Typography variant="body2" sx={{ color: '#666666', fontWeight: 500, mb: 0.5 }}>
          {label}
        </Typography>
        {loading ? (
          <Skeleton variant="text" width="60%" height={40} sx={{ bgcolor: '#1E1E1E' }} />
        ) : (
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'white' }}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: overview, isLoading } = useOverview();
  const { data: suspicious } = useSuspiciousParticipants();
  const liveAlerts = useStore((s) => s.liveAlerts);
  const [realtimeCount, setRealtimeCount] = useState(0);

  const { on } = useSocket();

  useEffect(() => {
    const off = on('participant:update', () => {
      setRealtimeCount((c) => c + 1);
    });
    return off;
  }, [on]);

  const stats = overview || {};
  const flagged = suspicious?.participants || [];

  const chartData = flagged.slice(0, 7).map((p) => ({
    name: p.githubUsername || p.machineId?.slice(0, 6),
    score: Math.round((p.suspicionScore || 0) * 100),
  }));

  return (
    <Box>
      {/* Header Section */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', mb: 0.5 }}>
            Dashboard Performances
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: 12, border: '2px solid #0C0C0C' } }}>
              {flagged.map((p) => (
                <Avatar key={p._id} src={`https://github.com/${p.githubUsername}.png`} />
              ))}
            </AvatarGroup>
            <Typography variant="caption" sx={{ color: '#666666', fontWeight: 500 }}>
              {stats.totalParticipants || 0} Participants Active Now
            </Typography>
          </Stack>
        </Box>
        <Button
          variant="contained"
          sx={{
            bgcolor: '#7F56D9',
            borderRadius: '12px',
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            '&:hover': { bgcolor: '#6941C6' },
          }}
        >
          View Full Report
        </Button>
      </Stack>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <PerformanceCard
            label="Total Participants"
            value={stats.totalParticipants}
            icon={<PeopleIcon />}
            loading={isLoading}
            trend={12}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <PerformanceCard
            label="Suspicious Activity"
            value={stats.suspiciousCount}
            icon={<WarningAmberIcon />}
            loading={isLoading}
            trend={-5}
            color="#ef4444"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <PerformanceCard
            label="Total Events"
            value={stats.totalEvents}
            icon={<EventNoteIcon />}
            loading={isLoading}
            trend={24}
            color="#f59e0b"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <PerformanceCard
            label="Real-time Updates"
            value={realtimeCount}
            icon={<TrendingUpIcon />}
            loading={false}
            trend={0}
            color="#22c55e"
          />
        </Grid>
      </Grid>

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Analytics Chart */}
        <Grid item xs={12} md={8}>
          <Card sx={{ bgcolor: '#0C0C0C', border: '1px solid #1E1E1E', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'white' }}>
                    Suspicion Analytics
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#666666' }}>
                    Top suspicion scores by participant
                  </Typography>
                </Box>
                <IconButton sx={{ color: '#666666' }}>
                  <MoreVertIcon />
                </IconButton>
              </Stack>

              <Box sx={{ height: 300, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E1E1E" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#666666', fontSize: 12, fontWeight: 500 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#666666', fontSize: 12, fontWeight: 500 }}
                    />
                    <RTooltip
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{
                        backgroundColor: '#1E1E1E',
                        border: 'none',
                        borderRadius: '12px',
                        color: 'white',
                      }}
                    />
                    <Bar dataKey="score" radius={[6, 6, 0, 0]} barSize={40}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.score > 70 ? '#ef4444' : '#7F56D9'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Activity Feed */}
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: '#0C0C0C', border: '1px solid #1E1E1E', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'white' }}>
                  Live Activity
                </Typography>
                <Typography variant="caption" sx={{ color: '#7F56D9', fontWeight: 700, cursor: 'pointer' }}>
                  See All
                </Typography>
              </Stack>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {liveAlerts.length === 0 ? (
                  <Typography variant="body2" sx={{ color: '#666666', textAlign: 'center', py: 4 }}>
                    No recent activity
                  </Typography>
                ) : (
                  liveAlerts.slice(0, 6).map((alert, idx) => (
                    <Stack key={idx} direction="row" spacing={2} alignItems="center">
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: alert.level === 'critical' ? '#ef4444' : '#f59e0b',
                          flexShrink: 0,
                        }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, fontSize: '0.85rem' }}>
                          {alert.type}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#666666', display: 'block' }}>
                          {alert.participantName || 'Anonymous'} • {new Date(alert.timestamp).toLocaleTimeString()}
                        </Typography>
                      </Box>
                    </Stack>
                  ))
                )}
              </Box>

              <Divider sx={{ my: 3, borderColor: '#1E1E1E' }} />

              <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700, mb: 2 }}>
                Top Suspicious
              </Typography>
              <Stack spacing={1.5}>
                {flagged.slice(0, 3).map((p) => (
                  <ParticipantCard key={p._id} participant={p} compact />
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

