import React from 'react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import BarChartIcon from '@mui/icons-material/BarChart';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import LogoutIcon from '@mui/icons-material/Logout';
import SecurityIcon from '@mui/icons-material/Security';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import SearchIcon from '@mui/icons-material/Search';
import useStore from '../store/useStore';

const SIDEBAR_WIDTH = 260;

const NAV_ITEMS = [
  { label: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { label: 'Participants', icon: <PeopleIcon />, path: '/participants' },
  { label: 'Analytics', icon: <BarChartIcon />, path: '/analytics' },
  { label: 'Alerts', icon: <NotificationsNoneIcon />, path: '/alerts' },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, liveAlerts, user } = useStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const alertCount = liveAlerts.filter((a) => a.level === 'critical').length;
  const currentPage = NAV_ITEMS.find((i) => location.pathname.startsWith(i.path))?.label || 'Dashboard';

  return (
    <Box
      className="noise-bg"
      sx={{
        display: 'flex',
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 20% 50%, rgba(127,86,217,0.06) 0%, #050505 70%)',
        p: 1.5,
        gap: 1.5,
      }}
    >
      {/* ── Sidebar ── */}
      <Box
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(180deg, rgba(127,86,217,0.08) 0%, rgba(10,10,10,0.95) 40%)',
          backdropFilter: 'blur(24px)',
          borderRadius: '20px',
          border: '1px solid rgba(127,86,217,0.12)',
          p: 2,
          position: 'relative',
          overflow: 'hidden',
          animation: 'fadeInUp 0.5s ease-out',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(127,86,217,0.4), transparent)',
          },
        }}
      >
        {/* Brand */}
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 1, pt: 2, pb: 3 }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #7F56D9, #9E77ED)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 0 20px rgba(127,86,217,0.4), 0 0 40px rgba(127,86,217,0.15)',
              animation: 'pulseGlow 3s ease-in-out infinite',
            }}
          >
            <SecurityIcon fontSize="small" />
          </Box>
          <Box>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: '1.1rem',
                letterSpacing: '-0.5px',
                background: 'linear-gradient(135deg, #fff 30%, #9E77ED)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1.2,
              }}
            >
              MONITOR
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: '#555', letterSpacing: '2px', fontWeight: 500 }}>
              PROCTORING
            </Typography>
          </Box>
        </Stack>

        {/* Navigation */}
        <Box sx={{ flex: 1, mt: 1 }}>
          {NAV_ITEMS.map((item) => {
            const active = location.pathname.startsWith(item.path);
            return (
              <Box
                key={item.path}
                onClick={() => navigate(item.path)}
                sx={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2,
                  py: 1.4,
                  mb: 0.5,
                  borderRadius: '14px',
                  cursor: 'pointer',
                  color: active ? '#fff' : '#666',
                  bgcolor: active ? 'rgba(127,86,217,0.12)' : 'transparent',
                  transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                  '&:hover': {
                    bgcolor: active ? 'rgba(127,86,217,0.15)' : 'rgba(255,255,255,0.03)',
                    color: active ? '#fff' : '#9E77ED',
                  },
                  ...(active && {
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 3,
                      height: 20,
                      borderRadius: '0 4px 4px 0',
                      background: 'linear-gradient(180deg, #7F56D9, #9E77ED)',
                      boxShadow: '0 0 8px rgba(127,86,217,0.6)',
                    },
                  }),
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    color: active ? '#9E77ED' : 'inherit',
                    transition: 'color 0.25s',
                    '& .MuiSvgIcon-root': { fontSize: '1.25rem' },
                  }}
                >
                  {item.label === 'Alerts' && alertCount > 0 ? (
                    <Badge
                      badgeContent={alertCount}
                      color="error"
                      sx={{
                        '& .MuiBadge-badge': {
                          fontSize: '0.65rem',
                          height: 16,
                          minWidth: 16,
                        },
                      }}
                    >
                      {item.icon}
                    </Badge>
                  ) : (
                    item.icon
                  )}
                </Box>
                <Typography
                  sx={{
                    fontSize: '0.88rem',
                    fontWeight: active ? 600 : 500,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {item.label}
                </Typography>
                {active && (
                  <Box
                    sx={{
                      ml: 'auto',
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: '#7F56D9',
                      boxShadow: '0 0 8px rgba(127,86,217,0.8)',
                      animation: 'dotPulse 2s ease-in-out infinite',
                    }}
                  />
                )}
              </Box>
            );
          })}
        </Box>

        {/* Logout */}
        <Box
          onClick={handleLogout}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            py: 1.4,
            borderRadius: '14px',
            cursor: 'pointer',
            color: '#555',
            transition: 'all 0.25s',
            '&:hover': {
              bgcolor: 'rgba(239,68,68,0.08)',
              color: '#ef4444',
            },
            '& .MuiSvgIcon-root': { fontSize: '1.2rem' },
          }}
        >
          <LogoutIcon />
          <Typography sx={{ fontSize: '0.88rem', fontWeight: 500 }}>Logout</Typography>
        </Box>
      </Box>

      {/* ── Main Content Area ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backdropFilter: 'blur(20px)',
            background: 'rgba(10,10,10,0.6)',
            border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: '16px',
            px: 3,
            py: 1.5,
            position: 'sticky',
            top: 12,
            zIndex: 10,
            animation: 'fadeInUp 0.4s ease-out',
          }}
        >
          <Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                color: '#fff',
                letterSpacing: '-0.5px',
                lineHeight: 1.2,
              }}
            >
              {currentPage}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#555', mt: 0.2 }}>
              Contest Proctoring System
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.5} alignItems="center">
            {/* Search */}
            <IconButton
              sx={{
                bgcolor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#888',
                borderRadius: '12px',
                p: 1,
                '&:hover': { bgcolor: 'rgba(127,86,217,0.1)', color: '#9E77ED' },
                transition: 'all 0.2s',
              }}
            >
              <SearchIcon fontSize="small" />
            </IconButton>

            {/* Download */}
            <IconButton
              sx={{
                bgcolor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#888',
                borderRadius: '12px',
                p: 1,
                '&:hover': { bgcolor: 'rgba(127,86,217,0.1)', color: '#9E77ED' },
                transition: 'all 0.2s',
              }}
            >
              <FileDownloadOutlinedIcon fontSize="small" />
            </IconButton>

            {/* Notifications */}
            <IconButton
              sx={{
                bgcolor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#888',
                borderRadius: '12px',
                p: 1,
                '&:hover': { bgcolor: 'rgba(127,86,217,0.1)', color: '#9E77ED' },
                transition: 'all 0.2s',
              }}
            >
              <Badge
                variant="dot"
                color="error"
                invisible={alertCount === 0}
                sx={{ '& .MuiBadge-dot': { width: 8, height: 8, borderRadius: '50%' } }}
              >
                <NotificationsNoneIcon fontSize="small" />
              </Badge>
            </IconButton>

            {/* Divider */}
            <Box sx={{ width: 1, height: 28, bgcolor: 'rgba(255,255,255,0.06)', mx: 0.5 }} />

            {/* User Profile Chip */}
            <Stack
              direction="row"
              spacing={1.2}
              alignItems="center"
              sx={{
                bgcolor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '14px',
                pl: 0.8,
                pr: 2,
                py: 0.6,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: 'rgba(127,86,217,0.08)',
                  borderColor: 'rgba(127,86,217,0.2)',
                },
              }}
            >
              <Avatar
                src={user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'admin'}`}
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '10px',
                  border: '2px solid rgba(127,86,217,0.3)',
                }}
              />
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.82rem', color: '#fff', lineHeight: 1.2 }}>
                  {user?.displayName || user?.username || 'Admin'}
                </Typography>
                <Chip
                  label={user?.provider === 'github' ? `@${user.username}` : 'Admin'}
                  size="small"
                  sx={{
                    height: 16,
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    background: 'linear-gradient(135deg, rgba(127,86,217,0.25), rgba(158,119,237,0.15))',
                    color: '#9E77ED',
                    border: 'none',
                    mt: 0.2,
                    '& .MuiChip-label': { px: 1 },
                  }}
                />
              </Box>
            </Stack>
          </Stack>
        </Box>

        {/* Page Content */}
        <Box
          sx={{
            flex: 1,
            background: 'rgba(10,10,10,0.5)',
            backdropFilter: 'blur(16px)',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.04)',
            overflow: 'auto',
            p: 3,
            animation: 'fadeInUp 0.6s ease-out',
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: 'rgba(127,86,217,0.2)',
              borderRadius: 3,
              '&:hover': { bgcolor: 'rgba(127,86,217,0.4)' },
            },
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}

export function RequireAuth({ children }) {
  const token = useStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}
