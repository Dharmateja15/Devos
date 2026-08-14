'use client';

import { useEffect, useState, use } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { apiFetch } from '../../../lib/api';
import Link from 'next/link';

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { accessToken } = useAuth();
  const [task, setTask] = useState<any>(null);
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [independenceSignal, setIndependenceSignal] = useState<string>('INDEPENDENT');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceTitle, setEvidenceTitle] = useState('');

  useEffect(() => {
    if (accessToken) {
      apiFetch(`/api/v1/tasks/${id}`, { accessToken })
        .then(data => setTask(data))
        .catch(err => setError(err.message));

      apiFetch(`/api/v1/evidence?taskId=${id}`, { accessToken })
        .then(data => setEvidenceList(data))
        .catch(err => setError(err.message));
    }
  }, [accessToken, id]);

  const updateStatus = async (status: string) => {
    setError(null);
    try {
      const data = await apiFetch(`/api/v1/tasks/${id}`, {
        method: 'PATCH',
        accessToken,
        body: JSON.stringify({ status }),
      });
      setTask(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const completeTask = async () => {
    setError(null);
    try {
      const data = await apiFetch(`/api/v1/tasks/${id}/complete`, {
        method: 'POST',
        accessToken,
        body: JSON.stringify({ independenceSignal }),
      });
      setTask(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const uncompleteTask = async () => {
    setError(null);
    try {
      const data = await apiFetch(`/api/v1/tasks/${id}/uncomplete`, {
        method: 'POST',
        accessToken,
      });
      setTask(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const attachEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const newEv = await apiFetch(`/api/v1/evidence`, {
        method: 'POST',
        accessToken,
        body: JSON.stringify({
          taskId: id,
          evidenceType: 'EXTERNAL_URL',
          title: evidenceTitle,
          url: evidenceUrl,
        }),
      });
      setEvidenceList([newEv, ...evidenceList]);
      setEvidenceTitle('');
      setEvidenceUrl('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!task) return <div>Loading...</div>;

  return (
    <div style={{ padding: 20 }}>
      <Link href={`/milestones/${task.milestoneId}`}>← Back to Milestone</Link>
      <h1>{task.title}</h1>
      <p>Status: {task.status}</p>
      {task.completedAt && <p>Completed At: {new Date(task.completedAt).toLocaleString()}</p>}
      
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button onClick={() => updateStatus('TODO')} disabled={task.status === 'TODO'}>Mark TODO</button>
        <button onClick={() => updateStatus('IN_PROGRESS')} disabled={task.status === 'IN_PROGRESS'}>Mark IN_PROGRESS</button>
        <button onClick={() => updateStatus('SKIPPED')} disabled={task.status === 'SKIPPED'}>Mark SKIPPED</button>
        
        <select 
          value={independenceSignal} 
          onChange={(e) => setIndependenceSignal(e.target.value)}
          disabled={task.status === 'DONE'}
        >
          <option value="INDEPENDENT">Independent</option>
          <option value="GUIDED">Guided</option>
          <option value="AI_ASSISTED">AI Assisted</option>
        </select>

        <button onClick={completeTask} disabled={task.status === 'DONE'}>Complete Task</button>
        <button onClick={uncompleteTask} disabled={task.status !== 'DONE'}>Uncomplete Task (5m window)</button>
      </div>

      <div style={{ marginTop: '30px' }}>
        <h3>Evidence</h3>
        <form onSubmit={attachEvidence} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <input 
            type="text" 
            placeholder="Title" 
            value={evidenceTitle} 
            onChange={e => setEvidenceTitle(e.target.value)} 
            required 
          />
          <input 
            type="url" 
            placeholder="URL" 
            value={evidenceUrl} 
            onChange={e => setEvidenceUrl(e.target.value)} 
            required 
          />
          <button type="submit">Attach Evidence</button>
        </form>

        <ul>
          {evidenceList.map(ev => (
            <li key={ev.id}>
              <a href={ev.url} target="_blank" rel="noreferrer">{ev.title}</a> 
              <span style={{ marginLeft: 10, fontSize: '0.8em', color: 'gray' }}>
                ({ev.evidenceType})
              </span>
            </li>
          ))}
          {evidenceList.length === 0 && <p>No evidence attached.</p>}
        </ul>
      </div>
    </div>
  );
}
