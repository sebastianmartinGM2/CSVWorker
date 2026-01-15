import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from './index';

describe('API endpoints', () => {
  it('POST /convert-download-json returns a JSON file attachment', async () => {
    const csv = 'name,age\nAlice,30\nBob,25\n';
    const res = await request(app)
      .post('/convert-download-json')
      .attach('file', Buffer.from(csv, 'utf8') as any, 'test.csv');

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-type']).toMatch(/application\/(json)/);
    const body = res.body;
    expect(body).toHaveProperty('records');
    expect(Array.isArray(body.records)).toBe(true);
    expect(body.records.length).toBe(2);
  });
});
