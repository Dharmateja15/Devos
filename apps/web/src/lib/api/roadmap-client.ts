const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface RoadmapMappingDto {
  id: string;
  roadmapNodeId: string;
  userId: string;
  mappingStatus: string;
  confidenceScore: number;
  userConfirmation: boolean;
  journeyId?: string | null;
  taskId?: string | null;
  projectId?: string | null;
  skillId?: string | null;
}

export interface RoadmapNodeDto {
  id: string;
  snapshotId: string;
  externalNodeId: string;
  parentNodeId?: string | null;
  title: string;
  description?: string | null;
  nodeType: 'TOPIC' | 'SUBTOPIC' | 'RESOURCE' | 'ASSESSMENT' | string;
  sortOrder: number;
  dependencies: string[];
  resourceUrls: string[];
  metadata?: Record<string, any> | null;
  mappings?: RoadmapMappingDto[];
}

export interface RoadmapSnapshotDto {
  id: string;
  roadmapId: string;
  sourceType: string;
  sourceUrl?: string | null;
  sourceName?: string | null;
  sourceVersion: string;
  importedAt: string;
  nodes?: RoadmapNodeDto[];
  _count?: { nodes: number };
}

export interface RoadmapDto {
  id: string;
  userId: string;
  title: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | string;
  priority: 'PRIMARY' | 'SECONDARY' | string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  snapshots?: RoadmapSnapshotDto[];
}

export interface ImportRoadmapPayload {
  input: string;
  sourceType?: string;
  sourceName?: string;
  createNewRoadmap?: boolean;
  targetRoadmapId?: string;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

function getHeaders(accessToken?: string | null): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}

export async function fetchRoadmaps(accessToken?: string | null): Promise<RoadmapDto[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/roadmaps`, {
    method: 'GET',
    headers: getHeaders(accessToken),
    credentials: 'include',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorData.message || 'Failed to fetch roadmaps', errorData);
  }

  return res.json();
}

export async function fetchRoadmapById(id: string, accessToken?: string | null): Promise<RoadmapDto> {
  const res = await fetch(`${API_BASE_URL}/api/v1/roadmaps/${id}`, {
    method: 'GET',
    headers: getHeaders(accessToken),
    credentials: 'include',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorData.message || `Failed to fetch roadmap ${id}`, errorData);
  }

  return res.json();
}

export async function importRoadmap(payload: ImportRoadmapPayload, accessToken?: string | null): Promise<RoadmapDto> {
  const res = await fetch(`${API_BASE_URL}/api/v1/roadmaps/import`, {
    method: 'POST',
    headers: getHeaders(accessToken),
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorData.message || 'Failed to import roadmap', errorData);
  }

  return res.json();
}

export async function selfReportMapping(mappingId: string, accessToken?: string | null): Promise<RoadmapMappingDto> {
  const res = await fetch(`${API_BASE_URL}/api/v1/roadmaps/mappings/${mappingId}/self-report`, {
    method: 'POST',
    headers: getHeaders(accessToken),
    credentials: 'include',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorData.message || 'Failed to self-report knowledge mapping', errorData);
  }

  return res.json();
}
