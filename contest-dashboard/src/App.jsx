import React, { useMemo, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { Toaster } from 'react-hot-toast';

import useStore from './store/useStore';
import Layout, { RequireAuth } from './components/Layout';

const Login = lazy(() => import('./pages/Login'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Participants = lazy(() => import('./pages/Participants'));
const ParticipantDetail = lazy(() => import('./pages/ParticipantDetail'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Alerts = lazy(() => import('./pages/Alerts'));

function PageLoader() {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: '#050505',
      }}
    >
      <CircularProgress
        size={48}
        thickness={2}
        sx={{
          color: '#7F56D9',
          '& .MuiCircularProgress-circle': { strokeLinecap: 'round' },
        }}
      />
    </Box>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10000, refetchOnWindowFocus: true },
  },
});

export default function App() {
  const darkMode = useStore((s) => s.darkMode);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: 'dark',
          primary: { main: '#7F56D9', light: '#B692F6', dark: '#6941C6' },
          secondary: { main: '#06B6D4', light: '#67E8F9', dark: '#0891B2' },
          error: { main: '#F04438', light: '#FDA29B', dark: '#B42318' },
          warning: { main: '#F79009', light: '#FDB022', dark: '#DC6803' },
          success: { main: '#12B76A', light: '#6CE9A6', dark: '#027A48' },
          background: { default: '#050505', paper: '#0A0A0A' },
          text: { primary: '#F5F5F6', secondary: '#94969C' },
          divider: 'rgba(255,255,255,0.06)',
        },
        typography: {
          fontFamily: '"Plus Jakarta Sans","Inter",sans-serif',
          h1: { fontWeight: 800, letterSpacing: '-0.02em' },
          h2: { fontWeight: 800, letterSpacing: '-0.02em' },
          h3: { fontWeight: 700, letterSpacing: '-0.02em' },
          h4: { fontWeight: 700, letterSpacing: '-0.01em' },
          h5: { fontWeight: 700 },
          h6: { fontWeight: 700 },
          subtitle1: { fontWeight: 600 },
          subtitle2: { fontWeight: 600 },
          button: { fontWeight: 600, textTransform: 'none' },
        },
        shape: { borderRadius: 16 },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                backgroundImage:
                  'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(127,86,217,0.08), transparent)',
              },
            },
          },
          MuiCard: {
            defaultProps: { elevation: 0 },
            styleOverrides: {
              root: {
                background: 'rgba(15,15,15,0.7)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 20,
                transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                '&:hover': {
                  border: '1px solid rgba(127,86,217,0.2)',
                  boxShadow: '0 8px 32px rgba(127,86,217,0.08)',
                },
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: { borderRadius: 12, padding: '10px 24px', fontSize: '0.875rem', transition: 'all 0.2s ease' },
              contained: {
                background: 'linear-gradient(135deg,#7F56D9 0%,#9E77ED 100%)',
                boxShadow: '0 4px 16px rgba(127,86,217,0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg,#6941C6 0%,#7F56D9 100%)',
                  boxShadow: '0 8px 24px rgba(127,86,217,0.4)',
                  transform: 'translateY(-1px)',
                },
              },
              outlined: {
                borderColor: 'rgba(255,255,255,0.1)',
                '&:hover': { borderColor: '#7F56D9', background: 'rgba(127,86,217,0.08)' },
              },
            },
          },
          MuiIconButton: {
            styleOverrides: {
              root: { transition: 'all 0.2s ease', '&:hover': { transform: 'scale(1.05)' } },
            },
          },
          MuiChip: {
            styleOverrides: { root: { borderRadius: 8, fontWeight: 600, fontSize: '0.75rem' } },
          },
          MuiTableCell: {
            styleOverrides: {
              root: { borderColor: 'rgba(255,255,255,0.04)', padding: '14px 16px' },
              head: { fontWeight: 700, color: '#94969C', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
            },
          },
          MuiTableRow: {
            styleOverrides: {
              root: { transition: 'background 0.2s ease', '&:hover': { background: 'rgba(127,86,217,0.04) !important' } },
            },
          },
          MuiTextField: {
            styleOverrides: {
              root: {
                '& .MuiOutlinedInput-root': {
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.03)',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' },
                  '&:hover fieldset': { borderColor: 'rgba(127,86,217,0.3)' },
                  '&.Mui-focused fieldset': { borderColor: '#7F56D9', boxShadow: '0 0 0 3px rgba(127,86,217,0.15)' },
                },
              },
            },
          },
          MuiTooltip: {
            styleOverrides: {
              tooltip: {
                background: 'rgba(15,15,15,0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                fontSize: '0.75rem',
                fontWeight: 500,
              },
            },
          },
        },
      }),
    [darkMode]
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'rgba(15,15,15,0.9)',
              backdropFilter: 'blur(20px)',
              color: '#F5F5F6',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              fontFamily: '"Plus Jakarta Sans",sans-serif',
            },
          }}
        />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route
                element={
                  <RequireAuth>
                    <Layout />
                  </RequireAuth>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/participants" element={<Participants />} />
                <Route path="/participant/:id" element={<ParticipantDetail />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/alerts" element={<Alerts />} />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
