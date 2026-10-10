import test from 'node:test';
import assert from 'node:assert/strict';
import { crowdScores, buildTopics } from '../dist/services/topicRanking.js';
const now = Date.parse('2026-09-15T10:00:00Z');
const event = (name, device, overrides = {}) => ({ eventName: name, installId: device, videoId: 'a', eventTime: new Date(now).toISOString(), metadata: {}, ...overrides });

test('crowd ranking deduplicates devices, ignores old completion and uses exposure-normalized signals', () => {
  const one = crowdScores(Array.from({length:100},()=>event('favorite_add','one')),now).get('a');
  assert.equal(one.eligible,false);
  assert.equal(crowdScores(Array.from({length:10},(_,i)=>event('video_impression',String(i))),now).get('a').eligible,false);
  assert.equal(crowdScores([event('video_complete','one'),event('playback_error','one')],now).size,0);
  const events = Array.from({length:5},(_,i)=>event('recommendation_watch',String(i),{value:60,metadata:{measurement:'watch_seconds_v3',duration:100}}));
  const score = crowdScores(events,now).get('a');
  assert.equal(score.eligible,true);
  assert.deepEqual(crowdScores([...events,...events],now).get('a'),score);
  const diluted=crowdScores([...events,...Array.from({length:30},(_,i)=>event('video_impression','cold'+i))],now).get('a');
  assert.ok(diluted.score<score.score);
  const negative=crowdScores([...events,event('recommendation_hide','0')],now).get('a');
  assert.ok(negative.score<score.score);
  assert.deepEqual(crowdScores([...events,event('recommendation_hide','0'),event('recommendation_restore','0')],now).get('a'),score);
  assert.equal(crowdScores([event('favorite_add','one',{eventTime:'2025-01-01'})],now).size,0);
});

test('topics use recent catalog fallback with no unsupported crowd claims or private identities', () => {
  const videos=Array.from({length:4},(_,i)=>({id:String(i),title:'Video '+i,thumbnail:'',tags:['tag'],duration:100,views:999999,aspectRatio:'landscape',createdAt:`2026-09-0${i+1}T00:00:00Z`}));
  const result=buildTopics(videos,{categories:[{id:'cat',name:'Category'}],assignments:{0:'cat',1:'cat',2:'cat',3:'cat'}},[],now);
  assert.equal(result.topics[0].crowdReady,false);
  assert.deepEqual(result.topics[0].videos.map(video=>video.id),['3','2','1','0']);
  assert.ok(!JSON.stringify(result).includes('installId'));
});
