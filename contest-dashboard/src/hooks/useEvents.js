import { useQuery } from '@tanstack/react-query';
import {
  fetchOverview,
  fetchGithubAnalysis,
  fetchGithubCommits,
  fetchGithubOverview,
} from '../utils/api';

export function useOverview() {
  return useQuery({
    queryKey: ['overview'],
    queryFn: fetchOverview,
    refetchInterval: 30000,
  });
}

export function useGithubAnalysis(participantId) {
  return useQuery({
    queryKey: ['github-analysis', participantId],
    queryFn: () => fetchGithubAnalysis(participantId),
    enabled: !!participantId,
  });
}

export function useGithubCommits(participantId) {
  return useQuery({
    queryKey: ['github-commits', participantId],
    queryFn: () => fetchGithubCommits(participantId),
    enabled: !!participantId,
  });
}

export function useGithubOverviewData() {
  return useQuery({
    queryKey: ['github-overview'],
    queryFn: fetchGithubOverview,
    refetchInterval: 60000,
  });
}
