'use client';

import { useEffect, useState, use } from 'react';
import { useAuth } from '../../../context/AuthContext';
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
      fetch(`http://localhost:3001/api/v1/tasks/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then(res => res.json())
      .then(data => setTask(data));

      fetch(`http://localhost:3001/api/v1/evidence?taskId=${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then(res => res.json())
      .then(data => setEvidenceList(data));
    }
  }, [accessToken, id]);

  const updateStatus = async (status: string) => {
    setError(null);
    const res = await fetch(`http://localhost:3001/api/v1/tasks/${id}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const data = await res.json();
      setTask(data);
    } else {
      const e = await res.json();
      setError(e.message);
    }
  };

  const completeTask = async () => {
    setError(null);
    const res = await fetch(`http://localhost:3001/api/v1/tasks/${id}/complete`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ independenceSignal }),
    });
    if (res.ok) {
      const data = await res.json();
      setTask(data);
    } else {
      const e = await res.json();
      setError(e.message);
    }
  };

  const uncompleteTask = async () => {
    setError(null);
    const res = await fetch(`http://localhost:3001/api/v1/tasks/${id}/uncomplete`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (res.ok) {
      const data = await res.json();
      setTask(data);
    } else {
      const e = await res.json();
      setError(e.message);
    }
  };

  const attachEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch(`http://localhost:3001/api/v1/evidence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        taskId: id,
        evidenceType: 'EXTERNAL_URL',
        title: evidenceTitle,
        url: evidenceUrl,
      }),
    });
    if (res.ok) {
      const newEv = await res.json();
      setEvidenceList([newEv, ...evidenceList]);
      setEvidenceTitle('');
      setEvidenceUrl('');
    } else {
      const err = await res.json();
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
