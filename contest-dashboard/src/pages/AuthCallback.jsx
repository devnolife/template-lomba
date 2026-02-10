import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import SecurityIcon from '@mui/icons-material/Security';
import { exchangeGithubCode } from '../utils/api';
import useStore from '../store/useStore';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuth } = useStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const code = searchParams.get('code');

    if (!code) {
      setError('No authorization code received from GitHub.');
      setLoading(false);
      return;
    }

    exchangeGithubCode(code)
      .then((data) => {
        setAuth(data.token, data.user);
        navigate('/dashboard', { replace: true });
      })
      .catch((err) => {
        setError(
          err.response?.data?.error || 'Authentication failed. Please try again.'
        );
        setLoading(false);
      });
  }, [searchParams, navigate, setAuth]);

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
      {/* Animated gradient orb */}
      <Box
        sx={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(127,86,217,0.15) 0%, transparent 70%)',
          top: '-10%',
          left: '-10%',
          animation: 'float 8s ease-in-out infinite',
          filter: 'blur(60px)',
        }}
      />

      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
        }}
      >
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
              background:
                'linear-gradient(90deg, transparent, rgba(127,86,217,0.4), transparent)',
            },
          }}
        >
          {/* Logo */}
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
              mb: 3,
              boxShadow:
                '0 0 30px rgba(127,86,217,0.4), 0 0 60px rgba(127,86,217,0.15)',
              animation: 'pulseGlow 3s ease-in-out infinite',
            }}
          >
            <SecurityIcon sx={{ fontSize: 32 }} />
          </Box>

          {loading ? (
            <>
              <CircularProgress
                size={40}
                thickness={2}
                sx={{
                  color: '#7F56D9',
                  mb: 2,
                  '& .MuiCircularProgress-circle': { strokeLinecap: 'round' },
                }}
              />
              <Typography
                sx={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', mb: 1 }}
              >
                Authenticating with GitHub...
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: '#555' }}>
                Please wait while we verify your account.
              </Typography>
            </>
          ) : (
            <>
              {/* Error state */}
              <Box
                sx={{
                  mb: 3,
                  p: 2,
                  borderRadius: '12px',
                  bgcolor: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                }}
              >
                <Typography
                  sx={{ fontSize: '0.9rem', color: '#ef4444', fontWeight: 500 }}
                >
                  {error}
                </Typography>
              </Box>
              <Button
                variant="contained"
                fullWidth
                onClick={() => navigate('/login')}
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
                  transition: 'all 0.2s ease',
                }}
              >
                Back to Login
              </Button>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
