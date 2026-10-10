import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('catalog combines filters, sorts by import time, and preserves recommended pagination', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), '5k-catalog-test-'));
  process.env.NODE_ENV = 'test';
  process.env.DATA_FILE = path.join(directory, 'db.json');
  process.env.MEDIA_DIR = path.join(directory, 'media');
  process.env.CHUNK_DIR = path.join(directory, 'chunks');
  process.env.JWT_SECRET = 'catalog-test-secret';
  process.env.ADMIN_INITIAL_PASSWORD = 'catalog-test-password';
  const make = (id, duration, imported) => ({ id, title: 'alpha '+id, description: 'demo', tags: ['CategoryA'], duration,
    thumbnail: 'https://example.test/cover.jpg', playbackUrl: 'https://example.test/video.m3u8', views: 1, aspectRatio: 'landscape',
    isAdult: true, status: 'draft', categoryIds: [], createdAt: '2026-01-01T00:00:00Z',
    externalSource: { remoteId: id, sourceKey: 'test', importedAt: imported, remoteUpdatedAt: '2099-01-01T00:00:00Z' } });
  const videos = [make('1', 659, '2026-01-01T00:00:00Z'), make('2',660,'2026-01-02T00:00:00Z'), make('3',1859,'2026-01-03T00:00:00Z'), make('4',1860,'2026-01-04T00:00:00Z'), make('5',1,'2026-01-05T00:00:00Z')];
  await writeFile(path.join(directory,'collected-catalog.json'), JSON.stringify({ videos }));
  await writeFile(path.join(directory,'collected-taxonomy.json'), JSON.stringify({ version:1, initialized:true, categories:[{id:'cat-a',name:'CategoryA',createdAt:'2026-01-01'},{id:'cat-b',name:'CategoryB',createdAt:'2026-01-01'}], assignments:{'1':'cat-a','2':'cat-a','3':'cat-b','4':'cat-a','5':'cat-a'} }));
  const { app } = await import('../dist/index.js');
  const server = await new Promise(resolve => { const instance = app.listen(0,'127.0.0.1',()=>resolve(instance)); });
  const base = `http://127.0.0.1:${server.address().port}/api/v1/collected-videos`;
  const query = async params => (await (await fetch(base+'?'+new URLSearchParams(params))).json()).data;
  try {
    assert.deepEqual((await query({duration:'short'})).items.map(v=>v.id), ['1']);
    assert.deepEqual((await query({duration:'medium'})).items.map(v=>v.id), ['2','3']);
    assert.deepEqual((await query({duration:'long'})).items.map(v=>v.id), ['4']);
    const combined=await query({duration:'medium',category:'cat-a',q:'alpha',sort:'latest'});
    assert.equal(combined.total,1); assert.equal(combined.items[0].duration,600);
    assert.deepEqual((await query({sort:'latest'})).items.map(v=>v.id), ['5','4','3','2','1']);
    assert.deepEqual((await query({})).items.map(v=>v.id), ['1','2','3','4','5']);
    assert.equal((await query({q:'missing',duration:'long'})).total,0);
    assert.equal((await fetch(base+'?duration=invalid')).status,400);
    const topics=(await (await fetch(base+'/topics')).json()).data;
    assert.equal(topics.version,'interest-v1');
    assert.ok(topics.topics.length);
    assert.ok(topics.topics.every(topic=>topic.videos.length>=3));
    const bootstrap=(await (await fetch(base+'/bootstrap')).json()).data;
    assert.deepEqual((await query({seed:'static-pool-0'})).items.map(v=>v.id), bootstrap.pools[0].items.map(v=>v.id));
    const first=await query({seed:'static-pool-0',pageSize:2,page:1}),second=await query({seed:'static-pool-0',pageSize:2,page:2});
    assert.equal(new Set([...first.items,...second.items].map(v=>v.id)).size,4);
    const related=await query({relatedTo:'1',seed:'random'});
    assert.deepEqual(related.items.map(v=>v.id),['2','4','5','3']);
    const r1=await query({relatedTo:'1',pageSize:2,page:1}),r2=await query({relatedTo:'1',pageSize:2,page:2});
    assert.deepEqual([...r1.items,...r2.items].map(v=>v.id),related.items.map(v=>v.id));
    assert.equal((await fetch(base+'?relatedTo=missing')).status,404);
  } finally {
    await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
    const resolved=path.resolve(directory);
    assert.ok(resolved.startsWith(path.resolve(tmpdir())+path.sep)&&path.basename(resolved).startsWith('5k-catalog-test-'));
    await rm(resolved,{recursive:true,force:true});
  }
});
