import { useQuery } from '@tanstack/react-query';
import { fetchParticipants, fetchParticipant, fetchSuspicious } from '../utils/api';

export function useParticipants(params = {}) {
  return useQuery({
    queryKey: ['participants', params],
    queryFn: () => fetchParticipants(params),
    refetchInterval: 30000, // Auto-refresh every 30s
  });
}

export function useParticipant(id) {
  return useQuery({
    queryKey: ['participant', id],
    queryFn: () => fetchParticipant(id),
    enabled: !!id,
    refetchInterval: 15000,
  });
}

export function useSuspiciousParticipants() {
  return useQuery({
    queryKey: ['suspicious'],
    queryFn: fetchSuspicious,
    refetchInterval: 30000,
  });
}
