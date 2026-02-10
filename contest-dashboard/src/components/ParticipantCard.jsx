import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import PersonIcon from '@mui/icons-material/Person';
import SuspicionMeter from './SuspicionMeter';

function statusColor(lastActive) {
  if (!lastActive) return '#666666';
  const diff = Date.now() - new Date(lastActive).getTime();
  if (diff < 2 * 60 * 1000) return '#22c55e';   // < 2 min
  if (diff < 10 * 60 * 1000) return '#f59e0b';  // < 10 min
  return '#ef4444';
}

export default function ParticipantCard({ participant, compact = false }) {
  const navigate = useNavigate();
  const { _id, githubUsername, machineId, suspicionScore, lastActive, totalEvents } = participant;
  const displayName = githubUsername || machineId?.slice(0, 12) || 'Unknown';

  if (compact) {
    return (
      <Box
        onClick={() => navigate(`/participant/${_id}`)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1.5,
          borderRadius: '16px',
          bgcolor: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid #1E1E1E',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' },
          transition: 'all 0.2s',
        }}
      >
        <Avatar
          src={`https://github.com/${githubUsername}.png`}
          sx={{ width: 32, height: 32, bgcolor: '#7F56D9' }}
        >
          <PersonIcon sx={{ fontSize: 18 }} />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, fontSize: '0.8rem' }} noWrap>
            {displayName}
          </Typography>
          <Typography variant="caption" sx={{ color: '#666666' }}>
            Score: {Math.round((suspicionScore || 0) * 100)}%
          </Typography>
        </Box>
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: statusColor(lastActive),
          }}
        />
      </Box>
    );
  }

  return (
    <Card
      sx={{
        bgcolor: '#0C0C0C',
        border: '1px solid #1E1E1E',
        borderRadius: '20px',
        transition: 'all 0.2s',
        '&:hover': { transform: 'translateY(-2px)', borderColor: '#7F56D9' },
      }}
    >
      <CardActionArea onClick={() => navigate(`/participant/${_id}`)} sx={{ p: 0.5 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Avatar
              src={`https://github.com/${githubUsername}.png`}
              sx={{ width: 44, height: 44, bgcolor: '#7F56D9' }}
            >
              <PersonIcon />
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 700 }} noWrap>
                {displayName}
              </Typography>
              <Typography variant="caption" sx={{ color: '#666666' }}>
                {totalEvents ?? 0} total events collected
              </Typography>
            </Box>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: statusColor(lastActive),
                boxShadow: `0 0 10px ${statusColor(lastActive)}`,
              }}
            />
          </Stack>
          <SuspicionMeter score={suspicionScore ?? 0} size="small" />
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

