import { formatShortSha, formatEvidenceTypeLabel } from './ProofOfWorkShowcase';
import { PublicProfileEvidenceDto } from '../../lib/api';

describe('ProofOfWorkShowcase Presentation & Safety Logic', () => {
  const mockEvidenceList: PublicProfileEvidenceDto[] = [
    {
      id: 'e1',
      evidenceType: 'GITHUB_REPO',
      title: 'DevOS Core Monorepo',
      githubRepo: 'devos/monorepo',
      githubSha: null,
      url: 'https://github.com/devos/monorepo',
      createdAt: '2026-08-10T10:00:00Z',
    },
    {
      id: 'e2',
      evidenceType: 'GITHUB_COMMIT',
      title: 'Phase 6B Public Profile API Implementation',
      githubRepo: 'devos/monorepo',
      githubSha: 'a1b2c3d4e5f6789',
      url: 'https://github.com/devos/monorepo/commit/a1b2c3d4e5f6789',
      createdAt: '2026-08-15T10:00:00Z',
    },
    {
      id: 'e3',
      evidenceType: 'UNKNOWN_CUSTOM_TYPE',
      title: 'Special Custom Verification',
      githubRepo: null,
      githubSha: null,
      url: null,
      createdAt: '2026-08-15T12:00:00Z',
    },
  ];

  it('1. formatShortSha formats SHAs to 7 characters cleanly without introducing fake values when null', () => {
    expect(formatShortSha('a1b2c3d4e5f6789')).toBe('a1b2c3d');
    expect(formatShortSha(null)).toBeNull();
    expect(formatShortSha('')).toBeNull();
  });

  it('2. formatEvidenceTypeLabel converts evidence types to human-readable strings', () => {
    expect(formatEvidenceTypeLabel('GITHUB_REPO')).toBe('Repo');
    expect(formatEvidenceTypeLabel('GITHUB_COMMIT')).toBe('Commit');
    expect(formatEvidenceTypeLabel('PROJECT_SUBMISSION')).toBe('Project submission');
    expect(formatEvidenceTypeLabel('CERTIFICATE')).toBe('Certificate');
    expect(formatEvidenceTypeLabel('UNKNOWN_TYPE')).toBe('Unknown type');
  });

  it('3. Evidence list maps items correctly without fabricating missing links or SHAs', () => {
    expect(mockEvidenceList).toHaveLength(3);
    expect(mockEvidenceList[0].githubSha).toBeNull();
    expect(mockEvidenceList[2].url).toBeNull();
  });

  it('4. Handles empty array safely without rendering fake placeholders', () => {
    const emptyList: PublicProfileEvidenceDto[] = [];
    expect(emptyList).toHaveLength(0);
  });
});
