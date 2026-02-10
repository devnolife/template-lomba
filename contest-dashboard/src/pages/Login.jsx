import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import SecurityIcon from '@mui/icons-material/Security';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import GitHubIcon from '@mui/icons-material/GitHub';
import { login as loginApi, getGithubAuthUrl, getGithubAuthConfig } from '../utils/api';
import useStore from '../store/useStore';

export default function Login() {
  const navigate = useNavigate();
  const { setAuth, token } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubConfigured, setGithubConfigured] = useState(false);

  useEffect(() => {
    // Check if GitHub OAuth is configured
    getGithubAuthConfig()
      .then((data) => setGithubConfigured(data.configured))
      .catch(() => setGithubConfigured(false));
  }, []);

  if (token) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await loginApi(username, password);
      setAuth(data.token, { username, provider: 'local' });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    setError('');
    setGithubLoading(true);
    try {
      const data = await getGithubAuthUrl();
      window.location.href = data.url;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to initiate GitHub login.');
      setGithubLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#050505',
        position: 'relative',
        overflow: 'hidden',
        p: 2,
      }}
    >
      {/* Animated gradient orbs */}
      <Box
        sx={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(127,86,217,0.15) 0%, transparent 70%)',
          top: '-10%',
          left: '-10%',
          animation: 'float 8s ease-in-out infinite',
          filter: 'blur(60px)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)',
          bottom: '-5%',
          right: '-5%',
          animation: 'float 10s ease-in-out infinite reverse',
          filter: 'blur(60px)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(127,86,217,0.08) 0%, transparent 70%)',
          top: '60%',
          left: '50%',
          animation: 'float 12s ease-in-out infinite',
          filter: 'blur(80px)',
        }}
      />

      {/* Login Card */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 420,
          width: '100%',
          animation: 'fadeInScale 0.6s ease-out',
        }}
      >
        {/* Glassmorphism card */}
        <Box
          sx={{
            background: 'rgba(12,12,12,0.8)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(127,86,217,0.15)',
            borderRadius: '24px',
            p: 5,
            position: 'relative',
            overflow: 'hidden',
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
          {/* Logo */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '20px',
                background: 'linear-gradient(135deg, #7F56D9, #9E77ED)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                mb: 2.5,
                boxShadow: '0 0 30px rgba(127,86,217,0.4), 0 0 60px rgba(127,86,217,0.15)',
                animation: 'pulseGlow 3s ease-in-out infinite',
              }}
            >
              <SecurityIcon sx={{ fontSize: 32 }} />
            </Box>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: '1.5rem',
                letterSpacing: '-0.5px',
                background: 'linear-gradient(135deg, #fff 30%, #9E77ED)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 0.5,
              }}
            >
              Contest Monitor
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: '#555' }}>
              Admin Dashboard Login
            </Typography>
          </Box>

          {/* Error */}
          {error && (
            <Box
              sx={{
                mb: 2.5,
                p: 1.5,
                borderRadius: '12px',
                bgcolor: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: '#ef4444',
                  flexShrink: 0,
                  boxShadow: '0 0 8px rgba(239,68,68,0.6)',
                }}
              />
              <Typography sx={{ fontSize: '0.82rem', color: '#ef4444' }}>{error}</Typography>
            </Box>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <TextField
              label="Username"
              fullWidth
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              sx={{
                mb: 2.5,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '14px',
                  bgcolor: 'rgba(255,255,255,0.02)',
                },
              }}
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              sx={{
                mb: 3.5,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '14px',
                  bgcolor: 'rgba(255,255,255,0.02)',
                },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              startIcon={!loading && <LockOutlinedIcon />}
              sx={{
                py: 1.5,
                borderRadius: '14px',
                fontWeight: 700,
                fontSize: '0.95rem',
                textTransform: 'none',
                background: 'linear-gradient(135deg, #7F56D9, #9E77ED)',
                boxShadow: '0 4px 20px rgba(127,86,217,0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #6941C6, #7F56D9)',
                  boxShadow: '0 6px 30px rgba(127,86,217,0.4)',
                  transform: 'translateY(-1px)',
                },
                '&:active': { transform: 'translateY(0)' },
                transition: 'all 0.2s ease',
                '&.Mui-disabled': {
                  background: 'rgba(127,86,217,0.3)',
                },
              }}
            >
              {loading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Sign In'}
            </Button>
          </form>

          {/* GitHub OAuth */}
          {githubConfigured && (
            <>
              <Divider
                sx={{
                  my: 3,
                  '&::before, &::after': {
                    borderColor: 'rgba(255,255,255,0.06)',
                  },
                }}
              >
                <Typography sx={{ fontSize: '0.75rem', color: '#555', px: 1 }}>
                  OR
                </Typography>
              </Divider>

              <Button
                variant="outlined"
                fullWidth
                size="large"
                disabled={githubLoading}
                startIcon={!githubLoading && <GitHubIcon />}
                onClick={handleGithubLogin}
                sx={{
                  py: 1.5,
                  borderRadius: '14px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  textTransform: 'none',
                  color: '#fff',
                  borderColor: 'rgba(255,255,255,0.12)',
                  bgcolor: 'rgba(255,255,255,0.03)',
                  '&:hover': {
                    borderColor: 'rgba(255,255,255,0.25)',
                    bgcolor: 'rgba(255,255,255,0.06)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 20px rgba(255,255,255,0.05)',
                  },
                  '&:active': { transform: 'translateY(0)' },
                  transition: 'all 0.2s ease',
                  '&.Mui-disabled': {
                    color: 'rgba(255,255,255,0.3)',
                    borderColor: 'rgba(255,255,255,0.06)',
                  },
                }}
              >
                {githubLoading ? (
                  <CircularProgress size={24} sx={{ color: '#fff' }} />
                ) : (
                  'Sign in with GitHub'
                )}
              </Button>
            </>
          )}
        </Box>

        {/* Footer text */}
        <Typography sx={{ textAlign: 'center', mt: 3, fontSize: '0.75rem', color: '#444' }}>
          Proctoring System v2.0
        </Typography>
      </Box>
    </Box>
  );
}
